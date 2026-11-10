import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Determine server port:
// 1. Explicit CLI flag: --port <num> (highest priority, used by AI Studio dev runner)
// 2. Development mode default: 3000 (AI Studio proxy requires port 3000)
// 3. Production environment: PORT env var (Cloud Run / deployment ingress) or 3000
function resolvePort(): number {
  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    const val = Number(process.argv[portArgIndex + 1]);
    if (!isNaN(val) && val > 0) return val;
  }
  if (process.env.NODE_ENV !== 'production') {
    return 3000;
  }
  if (process.env.PORT) {
    const val = Number(process.env.PORT);
    if (!isNaN(val) && val > 0) return val;
  }
  return 3000;
}

const PORT = resolvePort();

// Administrative passcode configured via server environment variable (never exposed to client)
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE;

// In-memory rate limiting store for authentication attempts
interface RateLimitEntry {
  count: number;
  lockUntil: number;
}

const loginAttempts = new Map<string, RateLimitEntry>();
const MAX_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes lockout

// Clean up stale rate limit entries every 30 minutes
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts.entries()) {
    if (entry.lockUntil < now && entry.count === 0) {
      loginAttempts.delete(ip);
    }
  }
}, 30 * 60 * 1000);
cleanupTimer.unref();

app.use(express.json());

// Helper for constant-time string comparison against timing attacks
function safeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

// Secure Admin Authentication API Endpoint
app.post('/api/admin/login', (req, res) => {
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'unknown-client';
  const now = Date.now();
  const attempts = loginAttempts.get(clientIp) || { count: 0, lockUntil: 0 };

  // Check if IP is currently locked out
  if (attempts.lockUntil > now) {
    const remainingMinutes = Math.ceil((attempts.lockUntil - now) / (60 * 1000));
    return res.status(429).json({
      success: false,
      error: `Too many failed login attempts. Access locked for security. Please try again in ${remainingMinutes} minute(s).`,
      retryAfterMinutes: remainingMinutes
    });
  }

  const { passcode } = req.body || {};

  if (!passcode || typeof passcode !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Admin passcode is required.'
    });
  }

  if (!ADMIN_PASSCODE) {
    return res.status(500).json({
      success: false,
      error: 'Authentication service unavailable: ADMIN_PASSCODE environment variable is not configured.'
    });
  }

  // Validate passcode securely on the server
  const isValid = safeCompare(passcode.trim(), ADMIN_PASSCODE);

  if (!isValid) {
    attempts.count += 1;
    if (attempts.count >= MAX_ATTEMPTS) {
      attempts.lockUntil = now + LOCK_TIME_MS;
      attempts.count = 0; // Reset count for next lockout window after expiry
      loginAttempts.set(clientIp, attempts);
      return res.status(429).json({
        success: false,
        error: `Maximum failed attempts reached. Account locked for 15 minutes.`,
        retryAfterMinutes: 15
      });
    }

    loginAttempts.set(clientIp, attempts);
    const remainingAttempts = MAX_ATTEMPTS - attempts.count;
    return res.status(401).json({
      success: false,
      error: `Invalid admin passcode. Access denied. (${remainingAttempts} attempt(s) remaining before lockout)`,
      remainingAttempts
    });
  }

  // Successful login: clear failed attempts and issue a session token
  loginAttempts.delete(clientIp);
  const sessionToken = crypto.randomBytes(32).toString('hex');

  return res.status(200).json({
    success: true,
    token: sessionToken,
    message: 'Authentication successful.'
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false // Prevent separate WebSocket port collisions in containerized environments
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    const indexPath = path.resolve(distPath, 'index.html');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(503).send('Application is building. Please refresh in a few moments.');
      }
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use.`);
      process.exit(1);
    } else {
      console.error('Server listen error:', err);
    }
  });

  const gracefulShutdown = (signal: string) => {
    console.log(`Received ${signal}. Shutting down server gracefully...`);
    server.close(() => {
      console.log('Server stopped cleanly.');
      process.exit(0);
    });
    setTimeout(() => {
      console.warn('Forcing process exit after timeout.');
      process.exit(0);
    }, 2000).unref();
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
