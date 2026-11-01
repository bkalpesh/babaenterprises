import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Administrative passcode configured via server environment variable (never exposed to client)
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'BabaAdmin#2026!Secure';

// In-memory rate limiting store for authentication attempts
interface RateLimitEntry {
  count: number;
  lockUntil: number;
}

const loginAttempts = new Map<string, RateLimitEntry>();
const MAX_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes lockout

// Clean up stale rate limit entries every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts.entries()) {
    if (entry.lockUntil < now && entry.count === 0) {
      loginAttempts.delete(ip);
    }
  }
}, 30 * 60 * 1000);

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
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer();
