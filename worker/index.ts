// ==============================================================================
// BABA ENTERPRISES — CLOUDFLARE WORKER BACKEND ENGINE
// Target: babaenterprises-staging
// Hardened Authentication, Timing-Safe Comparison, Rate Limiting, R2 Protection
// ==============================================================================

import type {
  Env,
  BusinessSettings,
  DBProduct,
  DBEnquiry,
  DBInvoice,
  DBInvoiceItem,
  DBQuotation,
  DBQuotationItem,
  DBQuotationDispatch,
  ExecutionContext,
  DBCustomer,
} from './types.ts';
import {
  computeLineItem,
  computeTotals,
  getFinancialYear,
  getQuotationPrefix,
  getInvoicePrefix,
} from './financials.ts';
import { validateGSTINChecksum, validateGSTINStateMatch } from './gstin.ts';
import { generateInvoiceHTML, generateQuotationPDF } from './pdf.ts';

// ------------------------------------------------------------------------------
// Cryptographically Secure Helpers & Timing-Safe Comparison
// ------------------------------------------------------------------------------

/**
 * Constant-time string comparison using SHA-256 digests to prevent timing attacks
 */
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const hashA = await crypto.subtle.digest('SHA-256', enc.encode(a));
  const hashB = await crypto.subtle.digest('SHA-256', enc.encode(b));
  const bufA = new Uint8Array(hashA);
  const bufB = new Uint8Array(hashB);
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) {
    diff |= bufA[i] ^ bufB[i];
  }
  return diff === 0;
}

/**
 * Creates an HMAC-SHA256 signed stateless session token with 24-hour expiry
 */
async function createSignedToken(secret: string): Promise<string> {
  const enc = new TextEncoder();
  const payload = JSON.stringify({
    role: 'admin',
    iat: Date.now(),
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  });
  const b64Payload = btoa(payload);

  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(b64Payload));
  const b64Sig = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return `${b64Payload}.${b64Sig}`;
}

/**
 * Verifies HMAC-SHA256 session token across any Cloudflare edge isolate
 */
async function verifySignedToken(token: string, secret: string): Promise<boolean> {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const [b64Payload, b64Sig] = parts;

    const payload = JSON.parse(atob(b64Payload));
    if (!payload.exp || Date.now() > payload.exp) {
      return false; // Expired
    }

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigBytes = Uint8Array.from(atob(b64Sig), (c) => c.charCodeAt(0));
    return await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(b64Payload));
  } catch {
    return false;
  }
}

// In-memory rate limiting store for brute-force defense
interface RateLimitEntry {
  count: number;
  lockUntil: number;
}
const loginAttempts = new Map<string, RateLimitEntry>();
const MAX_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip: string): { locked: boolean; remainingMinutes: number } {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (entry && entry.lockUntil > now) {
    const remainingMinutes = Math.ceil((entry.lockUntil - now) / 60000);
    return { locked: true, remainingMinutes };
  }
  return { locked: false, remainingMinutes: 0 };
}

function recordFailedAttempt(ip: string): number {
  const now = Date.now();
  const entry = loginAttempts.get(ip) || { count: 0, lockUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockUntil = now + LOCK_TIME_MS;
    entry.count = 0;
  }
  loginAttempts.set(ip, entry);
  return MAX_ATTEMPTS - entry.count;
}

function clearRateLimit(ip: string): void {
  loginAttempts.delete(ip);
}

// ------------------------------------------------------------------------------
// Standard JSON Responses
// ------------------------------------------------------------------------------

function jsonResponse(data: any, status: number = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Idempotency-Key',
      ...headers,
    },
  });
}

function errorResponse(message: string, status: number = 400): Response {
  return jsonResponse({ success: false, error: message }, status);
}

async function checkAdminAuth(request: Request, env: Env): Promise<boolean> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return false;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  const token = match[1].trim();
  if (!token) return false;
  // Fail closed if required JWT_SECRET or ADMIN_PASSCODE is not configured
  if (!env.JWT_SECRET || !env.ADMIN_PASSCODE) return false;
  return await verifySignedToken(token, env.JWT_SECRET);
}

async function getAuthActor(request: Request, env: Env): Promise<string> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return 'ADMIN_STAGING';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token || !env.JWT_SECRET) return 'ADMIN_STAGING';
  try {
    const isValid = await verifySignedToken(token, env.JWT_SECRET);
    if (!isValid) return 'ADMIN_STAGING';
    const parts = token.split('.');
    if (parts.length >= 2) {
      const payload = JSON.parse(atob(parts[0]));
      return payload.actor || payload.user || payload.email || payload.role || 'ADMIN_STAGING';
    }
  } catch {}
  return 'ADMIN_STAGING';
}

// ------------------------------------------------------------------------------
// Main Cloudflare Worker Fetch Handler
// ------------------------------------------------------------------------------

export const worker = {
  async fetch(request: Request, env: Env, _ctx?: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const clientIp = request.headers.get('cf-connecting-ip') || 'unknown-client';

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Idempotency-Key',
        },
      });
    }

    try {
      // ------------------------------------------------------------------------
      // 1. ADMIN AUTHENTICATION (Timing-Safe, Rate-Limited, Stateless JWT)
      // ------------------------------------------------------------------------
      if (url.pathname === '/api/admin/login' && method === 'POST') {
        // Rate limiting check
        const { locked, remainingMinutes } = checkRateLimit(clientIp);
        if (locked) {
          return jsonResponse(
            {
              success: false,
              error: `Too many failed login attempts. Access temporarily locked for 15 minutes. Please try again in ${remainingMinutes} minute(s).`,
              retryAfterMinutes: remainingMinutes,
            },
            429
          );
        }

        // Fail closed if required secrets are missing
        if (!env.ADMIN_PASSCODE || !env.JWT_SECRET) {
          return errorResponse(
            'Authentication service unavailable: ADMIN_PASSCODE and JWT_SECRET must be configured in environment secrets.',
            500
          );
        }

        const body = (await request.json()) as { passcode?: string };
        const configuredPasscode = env.ADMIN_PASSCODE;

        if (!body.passcode || typeof body.passcode !== 'string') {
          return errorResponse('Admin passcode is required.', 400);
        }

        // Timing-safe constant-time comparison
        const isMatch = await timingSafeEqual(body.passcode.trim(), configuredPasscode.trim());
        if (!isMatch) {
          const remainingAttempts = recordFailedAttempt(clientIp);
          return jsonResponse(
            {
              success: false,
              error: `Invalid admin passcode. Access denied. (${remainingAttempts > 0 ? remainingAttempts : 0} attempt(s) remaining before lockout)`,
            },
            401
          );
        }

        // Successful login
        clearRateLimit(clientIp);
        const token = await createSignedToken(env.JWT_SECRET);

        return jsonResponse({
          success: true,
          token,
          message: 'Authentication successful. Session active for 24 hours.',
        });
      }

      if (url.pathname === '/api/admin/logout' && method === 'POST') {
        return jsonResponse({ success: true, message: 'Logged out successfully.' });
      }

      if (url.pathname === '/api/admin/verify' && method === 'GET') {
        const isAuth = await checkAdminAuth(request, env);
        return jsonResponse({ authenticated: isAuth }, isAuth ? 200 : 401);
      }

      // ------------------------------------------------------------------------
      // 2. BUSINESS SETTINGS
      // ------------------------------------------------------------------------
      if (url.pathname === '/api/business-settings') {
        if (method === 'GET') {
          const row = await env.DB.prepare('SELECT * FROM business_settings WHERE id = 1').first<BusinessSettings>();
          return jsonResponse({ success: true, settings: row });
        }
        if (method === 'PUT') {
          if (!(await checkAdminAuth(request, env))) return errorResponse('Unauthorized', 401);
          const b = (await request.json()) as Partial<BusinessSettings>;
          await env.DB.prepare(`
            UPDATE business_settings SET
              address_line1 = coalesce(?, address_line1),
              address_line2 = coalesce(?, address_line2),
              city = coalesce(?, city),
              pincode = coalesce(?, pincode),
              phone_primary = coalesce(?, phone_primary),
              phone_secondary = coalesce(?, phone_secondary),
              email = coalesce(?, email),
              bank_name = coalesce(?, bank_name),
              bank_branch = coalesce(?, bank_branch),
              bank_account_no = coalesce(?, bank_account_no),
              bank_ifsc = coalesce(?, bank_ifsc),
              default_payment_terms = coalesce(?, default_payment_terms),
              default_invoice_notes = coalesce(?, default_invoice_notes),
              updated_at = datetime('now')
            WHERE id = 1
          `).bind(
            b.address_line1 || null,
            b.address_line2 || null,
            b.city || null,
            b.pincode || null,
            b.phone_primary || null,
            b.phone_secondary || null,
            b.email || null,
            b.bank_name || null,
            b.bank_branch || null,
            b.bank_account_no || null,
            b.bank_ifsc || null,
            b.default_payment_terms || null,
            b.default_invoice_notes || null
          ).run();

          const updated = await env.DB.prepare('SELECT * FROM business_settings WHERE id = 1').first();
          return jsonResponse({ success: true, settings: updated });
        }
      }

      // ------------------------------------------------------------------------
      // 3. PRODUCTS CATALOGUE
      // ------------------------------------------------------------------------
      if (url.pathname === '/api/products') {
        if (method === 'GET') {
          const results = await env.DB.prepare('SELECT * FROM products ORDER BY sort_order ASC, created_at ASC').all<DBProduct>();
          return jsonResponse({ success: true, products: results.results });
        }
        if (method === 'POST') {
          if (!(await checkAdminAuth(request, env))) return errorResponse('Unauthorized', 401);
          const p = (await request.json()) as any;
          const id = 'prod-' + crypto.randomUUID().slice(0, 8);
          await env.DB.prepare(`
            INSERT INTO products (
              id, name, slug, category, category_label, image_url,
              short_description, full_description, hsn_code, unit_price_paise, gst_rate_bps,
              applications_json, materials_json, features_json, is_active, sort_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            id, p.name, p.slug || id, p.category, p.category_label || p.categoryLabel, p.image_url || p.image || null,
            p.short_description || p.shortDescription, p.full_description || p.fullDescription,
            p.hsn_code || p.hsnCode || null, p.unit_price_paise ?? 0, p.gst_rate_bps ?? null,
            JSON.stringify(p.applications || []), JSON.stringify(p.materialsSupported || p.materials || []),
            JSON.stringify(p.features || []), p.is_active ?? 1, p.sort_order ?? 0
          ).run();
          const created = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
          return jsonResponse({ success: true, product: created }, 201);
        }
      }

      if (url.pathname.startsWith('/api/products/') && method === 'PUT') {
        if (!(await checkAdminAuth(request, env))) return errorResponse('Unauthorized', 401);
        const prodId = url.pathname.replace('/api/products/', '');
        const p = (await request.json()) as any;
        await env.DB.prepare(`
          UPDATE products SET
            name = coalesce(?, name),
            unit_price_paise = coalesce(?, unit_price_paise),
            gst_rate_bps = ?,
            hsn_code = coalesce(?, hsn_code),
            short_description = coalesce(?, short_description),
            full_description = coalesce(?, full_description),
            is_active = coalesce(?, is_active),
            updated_at = datetime('now')
          WHERE id = ?
        `).bind(
          p.name || null,
          p.unit_price_paise ?? null,
          p.gst_rate_bps !== undefined ? p.gst_rate_bps : null,
          p.hsn_code || null,
          p.short_description || null,
          p.full_description || null,
          p.is_active !== undefined ? p.is_active : null,
          prodId
        ).run();
        const updated = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(prodId).first();
        return jsonResponse({ success: true, product: updated });
      }

      // ------------------------------------------------------------------------
      // 4. CUSTOMER REFERENCES
      // ------------------------------------------------------------------------
      if (url.pathname === '/api/references') {
        if (method === 'GET') {
          const isAdmin = await checkAdminAuth(request, env);
          if (isAdmin) {
            const refs = await env.DB.prepare('SELECT * FROM customer_references ORDER BY sort_order ASC').all();
            return jsonResponse({ success: true, references: refs.results });
          } else {
            // Unverified references must NEVER be presented publicly as confirmed customers
            const refs = await env.DB.prepare(
              'SELECT * FROM customer_references WHERE is_verified = 1 AND is_active = 1 ORDER BY sort_order ASC'
            ).all();
            return jsonResponse({ success: true, references: refs.results });
          }
        }
        if (method === 'POST') {
          if (!(await checkAdminAuth(request, env))) return errorResponse('Unauthorized', 401);
          const r = (await request.json()) as any;
          const id = 'ref-' + crypto.randomUUID().slice(0, 8);
          await env.DB.prepare(`
            INSERT INTO customer_references (id, name, short_name, category, sector, logo_url, logo_alt, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
          `).bind(id, r.name, r.short_name || r.shortName, r.category, r.sector, r.logo_url || null, r.logo_alt || null).run();
          const created = await env.DB.prepare('SELECT * FROM customer_references WHERE id = ?').bind(id).first();
          return jsonResponse({ success: true, reference: created }, 201);
        }
      }

      // ------------------------------------------------------------------------
      // 5. ENQUIRIES (RFQs) — WITH DEDUPLICATION SUPPORT
      // ------------------------------------------------------------------------
      if (url.pathname === '/api/enquiries') {
        if (method === 'GET') {
          if (!(await checkAdminAuth(request, env))) return errorResponse('Unauthorized', 401);
          const res = await env.DB.prepare('SELECT * FROM enquiries ORDER BY created_at DESC').all<DBEnquiry>();
          return jsonResponse({ success: true, enquiries: res.results });
        }
        if (method === 'POST') {
          const body = (await request.json()) as any;
          if (!body.company_name || !body.mobile || !body.product_category) {
            return errorResponse('Company name, mobile, and product category are required.');
          }

          // Check for duplicate retry using client reference or clientEnquiryId
          if (body.client_enquiry_id) {
            const existing = await env.DB.prepare('SELECT * FROM enquiries WHERE id = ?')
              .bind(body.client_enquiry_id)
              .first<DBEnquiry>();
            if (existing) {
              return jsonResponse({
                success: true,
                enquiry: existing,
                referenceNumber: existing.reference_number,
                message: 'Enquiry already synchronized (deduplicated).',
              });
            }
          }

          const id = body.client_enquiry_id || 'enq-' + crypto.randomUUID().slice(0, 8);
          const dateStr = new Date().toISOString().slice(2, 4);
          const countRow = await env.DB.prepare('SELECT count(*) as cnt FROM enquiries').first<{ cnt: number }>();
          const count = (countRow?.cnt || 0) + 846;
          const refNumber = `BE-${dateStr}-${String(count).padStart(4, '0')}`;

          await env.DB.prepare(`
            INSERT INTO enquiries (
              id, reference_number, company_name, contact_person, email, mobile,
              product_category, quantity_required, technical_requirements, message,
              drawing_file_key, drawing_file_name, drawing_file_size, drawing_content_type
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            id, refNumber, body.company_name, body.contact_person || '', body.email || '', body.mobile,
            body.product_category, body.quantity_required || 'Standard Batch', body.technical_requirements || null,
            body.message || null, body.drawing_file_key || null, body.drawing_file_name || null,
            body.drawing_file_size || null, body.drawing_content_type || null
          ).run();

          const created = await env.DB.prepare('SELECT * FROM enquiries WHERE id = ?').bind(id).first();
          return jsonResponse({ success: true, enquiry: created, referenceNumber: refNumber }, 201);
        }
      }

      if (url.pathname.startsWith('/api/enquiries/') && method === 'PATCH') {
        if (!(await checkAdminAuth(request, env))) return errorResponse('Unauthorized', 401);
        const enqId = url.pathname.replace('/api/enquiries/', '');
        const b = (await request.json()) as any;
        await env.DB.prepare(`
          UPDATE enquiries SET
            status = coalesce(?, status),
            internal_notes = coalesce(?, internal_notes),
            updated_at = datetime('now')
          WHERE id = ?
        `).bind(b.status || null, b.internal_notes !== undefined ? b.internal_notes : null, enqId).run();
        const updated = await env.DB.prepare('SELECT * FROM enquiries WHERE id = ?').bind(enqId).first();
        return jsonResponse({ success: true, enquiry: updated });
      }

      // ------------------------------------------------------------------------
      // 6. DRAWING UPLOADS & PROTECTED R2 ACCESS
      // ------------------------------------------------------------------------
      if (url.pathname === '/api/upload-drawing' && method === 'POST') {
        const contentType = request.headers.get('content-type') || '';
        if (contentType.includes('multipart/form-data')) {
          const formData = await request.formData();
          const file = formData.get('file') as File | null;
          if (!file) return errorResponse('No file uploaded.');

          // Strict file size limit (10MB)
          if (file.size > 10 * 1024 * 1024) {
            return errorResponse('File size exceeds maximum limit of 10MB.');
          }

          // Strict extension validation
          const ext = file.name.split('.').pop()?.toLowerCase();
          const allowedExts = ['pdf', 'jpg', 'jpeg', 'png', 'dwg', 'dxf', 'step', 'stp'];
          if (!ext || !allowedExts.includes(ext)) {
            return errorResponse('Unsupported file extension. Allowed formats: PDF, JPG, PNG, DWG, DXF, STEP.');
          }

          const fileKey = `drawings/${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${ext}`;
          const arrayBuffer = await file.arrayBuffer();

          if (env.DOCUMENTS_BUCKET) {
            await env.DOCUMENTS_BUCKET.put(fileKey, arrayBuffer, {
              httpMetadata: { contentType: file.type || 'application/octet-stream' },
              customMetadata: { originalName: file.name },
            });
          }

          return jsonResponse({
            success: true,
            fileKey,
            fileName: file.name,
            fileSize: file.size,
            contentType: file.type,
          });
        }
        return errorResponse('Multipart form data required.');
      }

      // PROTECTED R2 DRAWING DOWNLOAD (Requires Admin Authorization)
      if (url.pathname.startsWith('/api/drawings/') && method === 'GET') {
        if (!(await checkAdminAuth(request, env))) {
          return errorResponse('Unauthorized: Administrative authorization required to download CAD drawing assets.', 401);
        }
        const fileKey = decodeURIComponent(url.pathname.replace('/api/drawings/', ''));
        if (!env.DOCUMENTS_BUCKET) return errorResponse('R2 bucket unavailable', 503);
        const obj = await env.DOCUMENTS_BUCKET.get(fileKey);
        if (!obj) return errorResponse('Drawing file not found', 404);

        const headers = new Headers();
        obj.writeHttpMetadata(headers);
        headers.set('etag', obj.httpEtag);
        headers.set('Content-Disposition', `inline; filename="${obj.customMetadata?.originalName || 'drawing'}"`);
        return new Response(obj.body, { headers });
      }

      // ------------------------------------------------------------------------
      // 6.5 CUSTOMER MASTER ENGINE (Billing Directory, Statutory Validation, Soft-Delete)
      // ------------------------------------------------------------------------
      if (url.pathname === '/api/customers' && method === 'GET') {
        if (!(await checkAdminAuth(request, env))) return errorResponse('Unauthorized', 401);
        const q = url.searchParams.get('q')?.trim().toLowerCase();
        const activeFilter = url.searchParams.get('active');

        let sql = 'SELECT * FROM customers';
        const conditions: string[] = [];
        const params: any[] = [];

        if (activeFilter === '1') {
          conditions.push('is_active = 1');
        } else if (activeFilter === '0') {
          conditions.push('is_active = 0');
        }

        if (q) {
          conditions.push('(lower(legal_name) LIKE ? OR lower(coalesce(trade_name, "")) LIKE ? OR lower(coalesce(gstin, "")) LIKE ? OR lower(mobile) LIKE ? OR lower(contact_person) LIKE ? OR lower(city) LIKE ?)');
          const term = `%${q}%`;
          params.push(term, term, term, term, term, term);
        }

        if (conditions.length > 0) {
          sql += ' WHERE ' + conditions.join(' AND ');
        }
        sql += ' ORDER BY legal_name ASC';

        try {
          const stmt = env.DB.prepare(sql);
          const res = params.length > 0 ? await stmt.bind(...params).all<DBCustomer>() : await stmt.all<DBCustomer>();
          return jsonResponse({ success: true, customers: res.results || [] });
        } catch (err: any) {
          if (err?.message?.includes('no such table: customers')) {
            return jsonResponse({ success: true, customers: [], warning: 'Customer master table pending migration 0003.' });
          }
          throw err;
        }
      }

      if (url.pathname.match(/^\/api\/customers\/[^/]+$/) && method === 'GET') {
        if (!(await checkAdminAuth(request, env))) return errorResponse('Unauthorized', 401);
        const custId = url.pathname.split('/')[3];
        const cust = await env.DB.prepare('SELECT * FROM customers WHERE id = ?').bind(custId).first<DBCustomer>();
        if (!cust) return errorResponse('Customer not found.', 404);
        return jsonResponse({ success: true, customer: cust });
      }

      if (url.pathname === '/api/customers' && method === 'POST') {
        if (!(await checkAdminAuth(request, env))) return errorResponse('Unauthorized', 401);
        const b = (await request.json()) as any;

        const legalName = b.legal_name?.trim() || b.legalName?.trim();
        if (!legalName || legalName.length < 2) {
          return errorResponse('Legal business name is required (minimum 2 characters).', 422);
        }

        const billingAddress = b.billing_address?.trim() || b.billingAddress?.trim() || null;
        const city = b.city?.trim() || null;

        const rawStateCode = (b.state_code?.trim() || b.stateCode?.trim() || '');
        if (!rawStateCode || rawStateCode.length !== 2 || !/^[0-9]{2}$/.test(rawStateCode)) {
          return errorResponse('Valid 2-digit State Code is required.', 422);
        }
        const stateCode = rawStateCode;
        const state = b.state?.trim() || null;

        const pincode = b.pincode?.trim() || null;
        if (pincode && !/^[1-9][0-9]{5}$/.test(pincode)) {
          return errorResponse('Valid 6-digit PIN code is required.', 422);
        }

        const contactPerson = b.contact_person?.trim() || b.contactPerson?.trim() || null;
        const mobile = b.mobile?.trim() || null;
        if (mobile && !/^[0-9]{10,12}$/.test(mobile.replace(/[-+ ]/g, ''))) {
          return errorResponse('Valid 10-to-12 digit mobile number is required.', 422);
        }

        const gstinRaw = b.gstin?.trim() ? b.gstin.trim().toUpperCase() : null;
        let regType = b.gst_registration_type || b.gstRegistrationType || (gstinRaw ? 'Regular' : 'Unregistered');
        const allowedTypes = ['Regular', 'Composition', 'Unregistered', 'Consumer', 'Overseas'];
        if (!allowedTypes.includes(regType)) {
          regType = gstinRaw ? 'Regular' : 'Unregistered';
        }

        if (gstinRaw) {
          if (!validateGSTINChecksum(gstinRaw)) {
            return errorResponse('Invalid GSTIN format or checksum per statutory specifications.', 422);
          }
          if (!validateGSTINStateMatch(gstinRaw, stateCode)) {
            return errorResponse(`GSTIN state prefix (${gstinRaw.slice(0, 2)}) does not match state code (${stateCode}).`, 422);
          }
          // Prevent duplicate GSTIN
          const duplicate = await env.DB.prepare('SELECT id, legal_name FROM customers WHERE gstin = ?').bind(gstinRaw).first<{ id: string; legal_name: string }>();
          if (duplicate) {
            return errorResponse(`Customer with GSTIN ${gstinRaw} already exists (${duplicate.legal_name}).`, 409);
          }
        }

        const custId = 'cust-' + crypto.randomUUID().slice(0, 8);
        const tradeName = b.trade_name?.trim() || b.tradeName?.trim() || null;
        const country = b.country?.trim() || 'India';
        const email = b.email?.trim() || null;
        const notes = b.notes?.trim() || null;

        await env.DB.prepare(`
          INSERT INTO customers (
            id, legal_name, trade_name, gstin, gst_registration_type,
            billing_address, city, state, state_code, pincode, country,
            contact_person, mobile, email, notes, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `).bind(
          custId, legalName, tradeName, gstinRaw, regType,
          billingAddress, city, state, stateCode, pincode, country,
          contactPerson, mobile, email, notes
        ).run();

        const created = await env.DB.prepare('SELECT * FROM customers WHERE id = ?').bind(custId).first<DBCustomer>();
        return jsonResponse({ success: true, customer: created }, 201);
      }

      if (url.pathname.match(/^\/api\/customers\/[^/]+$/) && method === 'PUT') {
        if (!(await checkAdminAuth(request, env))) return errorResponse('Unauthorized', 401);
        const custId = url.pathname.split('/')[3];
        const existing = await env.DB.prepare('SELECT * FROM customers WHERE id = ?').bind(custId).first<DBCustomer>();
        if (!existing) return errorResponse('Customer not found.', 404);

        const b = (await request.json()) as any;
        const legalName = b.legal_name?.trim() || b.legalName?.trim() || existing.legal_name;
        const billingAddress = b.billing_address?.trim() || b.billingAddress?.trim() || existing.billing_address;
        const city = b.city?.trim() || existing.city;
        const state = b.state?.trim() || existing.state;
        const stateCode = b.state_code?.trim() || b.stateCode?.trim() || existing.state_code;
        const pincode = b.pincode?.trim() || existing.pincode;
        const contactPerson = b.contact_person?.trim() || b.contactPerson?.trim() || existing.contact_person;
        const mobile = b.mobile?.trim() || existing.mobile;
        const tradeName = b.trade_name !== undefined ? (b.trade_name?.trim() || null) : (b.tradeName !== undefined ? (b.tradeName?.trim() || null) : existing.trade_name);
        const country = b.country?.trim() || existing.country || 'India';
        const email = b.email !== undefined ? (b.email?.trim() || null) : existing.email;
        const notes = b.notes !== undefined ? (b.notes?.trim() || null) : existing.notes;
        const regType = b.gst_registration_type || b.gstRegistrationType || existing.gst_registration_type;

        let gstinRaw = b.gstin !== undefined ? (b.gstin?.trim() ? b.gstin.trim().toUpperCase() : null) : existing.gstin;

        if (gstinRaw) {
          if (!validateGSTINChecksum(gstinRaw)) {
            return errorResponse('Invalid GSTIN format or checksum per statutory specifications.', 422);
          }
          if (!validateGSTINStateMatch(gstinRaw, stateCode)) {
            return errorResponse(`GSTIN state prefix (${gstinRaw.slice(0, 2)}) does not match state code (${stateCode}).`, 422);
          }
          const duplicate = await env.DB.prepare('SELECT id, legal_name FROM customers WHERE gstin = ? AND id != ?').bind(gstinRaw, custId).first<{ id: string; legal_name: string }>();
          if (duplicate) {
            return errorResponse(`Another customer with GSTIN ${gstinRaw} already exists (${duplicate.legal_name}).`, 409);
          }
        }

        await env.DB.prepare(`
          UPDATE customers SET
            legal_name = ?, trade_name = ?, gstin = ?, gst_registration_type = ?,
            billing_address = ?, city = ?, state = ?, state_code = ?, pincode = ?, country = ?,
            contact_person = ?, mobile = ?, email = ?, notes = ?, updated_at = datetime('now')
          WHERE id = ?
        `).bind(
          legalName, tradeName, gstinRaw, regType,
          billingAddress, city, state, stateCode, pincode, country,
          contactPerson, mobile, email, notes, custId
        ).run();

        const updated = await env.DB.prepare('SELECT * FROM customers WHERE id = ?').bind(custId).first<DBCustomer>();
        return jsonResponse({ success: true, customer: updated });
      }

      if (url.pathname.match(/^\/api\/customers\/[^/]+$/) && method === 'DELETE') {
        if (!(await checkAdminAuth(request, env))) return errorResponse('Unauthorized', 401);
        const custId = url.pathname.split('/')[3];
        const existing = await env.DB.prepare('SELECT * FROM customers WHERE id = ?').bind(custId).first<DBCustomer>();
        if (!existing) return errorResponse('Customer not found.', 404);

        // Check if customer is associated with financial documents (quotations or invoices)
        let quoteCount = 0;
        let invCount = 0;
        try {
          const qRow = await env.DB.prepare('SELECT count(*) as c FROM quotations WHERE customer_id = ?').bind(custId).first<{ c: number }>();
          quoteCount = qRow?.c || 0;
        } catch {}
        try {
          const iRow = await env.DB.prepare('SELECT count(*) as c FROM invoices WHERE customer_id = ?').bind(custId).first<{ c: number }>();
          invCount = iRow?.c || 0;
        } catch {}

        if (quoteCount > 0 || invCount > 0) {
          // Soft delete (deactivation) to preserve historical financial document integrity
          await env.DB.prepare("UPDATE customers SET is_active = 0, updated_at = datetime('now') WHERE id = ?").bind(custId).run();
          return jsonResponse({
            success: true,
            deactivated: true,
            message: `Customer is associated with ${quoteCount} quotation(s) and ${invCount} invoice(s). Record has been safely deactivated rather than permanently deleted.`
          });
        }

        await env.DB.prepare('DELETE FROM customers WHERE id = ?').bind(custId).run();
        return jsonResponse({ success: true, message: 'Customer record deleted successfully.' });
      }

      if (url.pathname.match(/^\/api\/customers\/[^/]+\/toggle-active$/) && method === 'PATCH') {
        if (!(await checkAdminAuth(request, env))) return errorResponse('Unauthorized', 401);
        const custId = url.pathname.split('/')[3];
        const existing = await env.DB.prepare('SELECT * FROM customers WHERE id = ?').bind(custId).first<DBCustomer>();
        if (!existing) return errorResponse('Customer not found.', 404);

        const newStatus = existing.is_active === 1 ? 0 : 1;
        await env.DB.prepare("UPDATE customers SET is_active = ?, updated_at = datetime('now') WHERE id = ?").bind(newStatus, custId).run();
        const updated = await env.DB.prepare('SELECT * FROM customers WHERE id = ?').bind(custId).first<DBCustomer>();
        return jsonResponse({ success: true, customer: updated });
      }

      // ------------------------------------------------------------------------
      // 7. QUOTATIONS ENGINE (Configurable Prefix, Customer Linkage, Resilient Allocation)
      // ------------------------------------------------------------------------
      if (url.pathname === '/api/quotations') {
        if (method === 'GET') {
          if (!(await checkAdminAuth(request, env))) return errorResponse('Unauthorized', 401);
          const quotes = await env.DB.prepare('SELECT * FROM quotations ORDER BY created_at DESC').all<DBQuotation>();
          return jsonResponse({ success: true, quotations: quotes.results });
        }
        if (method === 'POST') {
          if (!(await checkAdminAuth(request, env))) return errorResponse('Unauthorized', 401);
          const b = (await request.json()) as any;

          // Determine inter-state status dynamically from state codes or GSTIN prefix
          const sellerStateCode = env.SELLER_STATE_CODE?.trim() || '27';
          const buyerStateCode = b.buyer_state_code
            ? String(b.buyer_state_code).trim()
            : (b.buyer_gstin && String(b.buyer_gstin).trim().length >= 2 ? String(b.buyer_gstin).trim().substring(0, 2) : sellerStateCode);
          const buyerStateName = b.buyer_state_name ? String(b.buyer_state_name).trim() : (b.buyerStateName ? String(b.buyerStateName).trim() : null);
          const isInterstate = buyerStateCode !== sellerStateCode;

          // Compute items
          const rawItems = b.items || [];
          if (rawItems.length === 0) return errorResponse('At least one item is required.');

          const computedItems = rawItems.map((it: any) =>
            computeLineItem(
              {
                productId: it.productId || null,
                itemDescription: it.itemDescription || it.name,
                hsnCode: it.hsnCode ? String(it.hsnCode).trim() : (it.hsn_code ? String(it.hsn_code).trim() : null),
                quantityMicrounits: Number(it.quantityMicrounits || Number(it.quantity || 1) * 1_000_000),
                unitOfMeasure: it.unitOfMeasure || 'NOS',
                unitPricePaise: Number(it.unitPricePaise || Math.round(Number(it.rate || 0) * 100)),
                discountBps: Number(it.discountBps || 0),
                gstRateBps: it.gstRateBps !== undefined && it.gstRateBps !== null ? Number(it.gstRateBps) : (it.gst_rate_bps !== undefined && it.gst_rate_bps !== null ? Number(it.gst_rate_bps) : null),
              },
              !!isInterstate
            )
          );

          const totals = computeTotals(computedItems, true);
          const quoteId = 'qt-' + crypto.randomUUID().slice(0, 8);

          const todayStr = new Date().toISOString().slice(0, 10);
          const quotationDate = b.quotation_date || todayStr;
          const fy = b.financial_year || getFinancialYear(quotationDate);
          const prefix = getQuotationPrefix(fy);

          // Resilient sequence allocation: query quotation_sequence_log, with graceful fallback if table not yet migrated
          let nextSeq = 1;
          let hasSeqLogTable = true;
          try {
            const maxSeqRow = await env.DB.prepare(
              'SELECT coalesce(max(sequence_number), 0) as maxSeq FROM quotation_sequence_log WHERE financial_year = ?'
            )
              .bind(fy)
              .first<{ maxSeq: number }>();
            nextSeq = (maxSeqRow?.maxSeq || 0) + 1;
          } catch (err: any) {
            if (err?.message?.includes('no such table: quotation_sequence_log')) {
              hasSeqLogTable = false;
              const fallbackRow = await env.DB.prepare(
                'SELECT coalesce(max(sequence_number), 0) as maxSeq FROM quotations WHERE financial_year = ?'
              )
                .bind(fy)
                .first<{ maxSeq: number }>();
              nextSeq = (fallbackRow?.maxSeq || 0) + 1;
            } else {
              throw err;
            }
          }

          const quoteNumber = `${prefix}${String(nextSeq).padStart(4, '0')}`;
          const validUntilDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
          const customerId = b.customer_id || b.customerId || null;

          // Build batch operations with optional customer_id and sequence log
          const batchOps: any[] = [];

          // Try insert with customer_id column (Migration 0003)
          let inserted = false;
          try {
            const stmts = [
              env.DB.prepare(`
                INSERT INTO quotations (
                  id, quotation_number, quotation_prefix, sequence_number, financial_year,
                  quotation_date, valid_until, buyer_name, buyer_company,
                  buyer_gstin, buyer_state_code, buyer_state_name, buyer_address, buyer_phone, buyer_email,
                  status, subtotal_gross_paise, total_discount_paise, taxable_amount_paise,
                  cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_tax_paise,
                  round_off_paise, total_amount_paise, payment_terms, delivery_terms, notes,
                  is_interstate, customer_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(
                quoteId,
                quoteNumber,
                prefix,
                nextSeq,
                fy,
                quotationDate,
                b.valid_until || validUntilDate,
                b.buyer_name,
                b.buyer_company || null,
                b.buyer_gstin || null,
                buyerStateCode,
                buyerStateName,
                b.buyer_address || null,
                b.buyer_phone || null,
                b.buyer_email || null,
                totals.subtotalGrossPaise,
                totals.totalDiscountPaise,
                totals.taxableAmountPaise,
                totals.cgstAmountPaise,
                totals.sgstAmountPaise,
                totals.igstAmountPaise,
                totals.totalTaxPaise,
                totals.roundOffPaise,
                totals.totalInvoiceAmountPaise,
                b.payment_terms || null,
                b.delivery_terms || null,
                b.notes || null,
                isInterstate ? 1 : 0,
                customerId
              ),
            ];

            computedItems.forEach((it: any, idx: number) => {
              stmts.push(
                env.DB.prepare(`
                  INSERT INTO quotation_items (
                    id, quotation_id, line_number, product_id, item_description, hsn_code,
                    quantity_microunits, unit_of_measure, unit_price_paise, gross_amount_paise,
                    discount_bps, discount_amount_paise, taxable_amount_paise, gst_rate_bps,
                    cgst_rate_bps, sgst_rate_bps, igst_rate_bps,
                    cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_amount_paise
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(
                  'qti-' + crypto.randomUUID().slice(0, 8),
                  quoteId,
                  idx + 1,
                  it.productId,
                  it.itemDescription,
                  it.hsnCode,
                  it.quantityMicrounits,
                  it.unitOfMeasure,
                  it.unitPricePaise,
                  it.grossAmountPaise,
                  it.discountBps,
                  it.discountAmountPaise,
                  it.taxableAmountPaise,
                  it.gstRateBps,
                  it.cgstRateBps,
                  it.sgstRateBps,
                  it.igstRateBps,
                  it.cgstAmountPaise,
                  it.sgstAmountPaise,
                  it.igstAmountPaise,
                  it.totalAmountPaise
                )
              );
            });

            if (hasSeqLogTable) {
              stmts.push(
                env.DB.prepare(`
                  INSERT INTO quotation_sequence_log (financial_year, sequence_number, quotation_id)
                  VALUES (?, ?, ?)
                `).bind(fy, nextSeq, quoteId)
              );
            }

            await env.DB.batch(stmts);
          } catch (err: any) {
            // Backward-compatibility fallback if customer_id column not yet added to quotations
            const errStr = String(err?.message || err);
            if (errStr.includes('customer_id')) {
              const legacyStmts = [
                env.DB.prepare(`
                  INSERT INTO quotations (
                    id, quotation_number, quotation_prefix, sequence_number, financial_year,
                    quotation_date, valid_until, buyer_name, buyer_company,
                    buyer_gstin, buyer_state_code, buyer_state_name, buyer_address, buyer_phone, buyer_email,
                    status, subtotal_gross_paise, total_discount_paise, taxable_amount_paise,
                    cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_tax_paise,
                    round_off_paise, total_amount_paise, payment_terms, delivery_terms, notes
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(
                  quoteId,
                  quoteNumber,
                  prefix,
                  nextSeq,
                  fy,
                  quotationDate,
                  b.valid_until || validUntilDate,
                  b.buyer_name,
                  b.buyer_company || null,
                  b.buyer_gstin || null,
                  buyerStateCode,
                  buyerStateName,
                  b.buyer_address || null,
                  b.buyer_phone || null,
                  b.buyer_email || null,
                  totals.subtotalGrossPaise,
                  totals.totalDiscountPaise,
                  totals.taxableAmountPaise,
                  totals.cgstAmountPaise,
                  totals.sgstAmountPaise,
                  totals.igstAmountPaise,
                  totals.totalTaxPaise,
                  totals.roundOffPaise,
                  totals.totalInvoiceAmountPaise,
                  b.payment_terms || null,
                  b.delivery_terms || null,
                  b.notes || null
                ),
              ];

              if (hasSeqLogTable) {
                legacyStmts.push(
                  env.DB.prepare(`
                    INSERT INTO quotation_sequence_log (financial_year, sequence_number, quotation_id)
                    VALUES (?, ?, ?)
                  `).bind(fy, nextSeq, quoteId)
                );
              }

              computedItems.forEach((it: any, idx: number) => {
                legacyStmts.push(
                  env.DB.prepare(`
                    INSERT INTO quotation_items (
                      id, quotation_id, line_number, product_id, item_description, hsn_code,
                      quantity_microunits, unit_of_measure, unit_price_paise, gross_amount_paise,
                      discount_bps, discount_amount_paise, taxable_amount_paise, gst_rate_bps,
                      cgst_rate_bps, sgst_rate_bps, igst_rate_bps,
                      cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_amount_paise
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  `).bind(
                    'qti-' + crypto.randomUUID().slice(0, 8),
                    quoteId,
                    idx + 1,
                    it.productId,
                    it.itemDescription,
                    it.hsnCode,
                    it.quantityMicrounits,
                    it.unitOfMeasure,
                    it.unitPricePaise,
                    it.grossAmountPaise,
                    it.discountBps,
                    it.discountAmountPaise,
                    it.taxableAmountPaise,
                    it.gstRateBps,
                    it.cgstRateBps,
                    it.sgstRateBps,
                    it.igstRateBps,
                    it.cgstAmountPaise,
                    it.sgstAmountPaise,
                    it.igstAmountPaise,
                    it.totalAmountPaise
                  )
                );
              });

              await env.DB.batch(legacyStmts);
              inserted = true;
            } else {
              throw err;
            }
          }

          const created = await env.DB.prepare('SELECT * FROM quotations WHERE id = ?').bind(quoteId).first<DBQuotation>();
          return jsonResponse({ success: true, quotation: created }, 201);
        }
      }

      if (url.pathname.match(/^\/api\/quotations\/[^/]+$/) && method === 'GET') {
        if (!(await checkAdminAuth(request, env))) return errorResponse('Unauthorized', 401);
        const quoteId = url.pathname.split('/')[3];
        const quote = await env.DB.prepare('SELECT * FROM quotations WHERE id = ?').bind(quoteId).first<DBQuotation>();
        if (!quote) return errorResponse('Quotation not found.', 404);
        const items = await env.DB.prepare('SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY line_number ASC').bind(quoteId).all();
        return jsonResponse({ success: true, quotation: quote, items: items.results || [] });
      }

      // Generate once, persist the binary in R2, and serve the saved object on subsequent requests.
      if (url.pathname.match(/^\/api\/quotations\/[^/]+\/pdf$/) && method === 'GET') {
        if (!(await checkAdminAuth(request, env))) return errorResponse('Unauthorized', 401);
        if (!env.DOCUMENTS_BUCKET) return errorResponse('Quotation PDF storage is unavailable.', 503);

        const quoteId = url.pathname.split('/')[3];
        const quote = await env.DB.prepare('SELECT * FROM quotations WHERE id = ?').bind(quoteId).first<DBQuotation>();
        if (!quote) return errorResponse('Quotation not found.', 404);

        const filename = `Quotation-${(quote.quotation_number || quote.id).replace(/[^a-zA-Z0-9._-]/g, '-')}.pdf`;
        if (quote.pdf_r2_key) {
          const saved = await env.DOCUMENTS_BUCKET.get(quote.pdf_r2_key);
          if (saved) return new Response(saved.body, {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `inline; filename="${filename}"`,
              'Cache-Control': 'private, no-store',
              'X-Content-Type-Options': 'nosniff',
            },
          });
        }

        const settings = await env.DB.prepare('SELECT * FROM business_settings WHERE id = 1').first<BusinessSettings>();
        if (!settings) return errorResponse('Business settings are not configured.', 503);
        const itemRows = await env.DB.prepare(
          'SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY line_number ASC'
        ).bind(quoteId).all<DBQuotationItem>();
        if (!itemRows.results?.length) return errorResponse('Quotation has no line items.', 422);

        const pdfBytes = generateQuotationPDF(settings, quote, itemRows.results);
        const objectKey = `quotation-pdfs/${quoteId}.pdf`;
        await env.DOCUMENTS_BUCKET.put(objectKey, pdfBytes, {
          httpMetadata: { contentType: 'application/pdf', cacheControl: 'private, no-store' },
          customMetadata: { quotationId: quoteId, quotationNumber: quote.quotation_number || quote.id },
        });

        const generatedAt = new Date().toISOString();
        await env.DB.prepare(`
          UPDATE quotations SET pdf_r2_key = ?, pdf_generated_at = ?, updated_at = datetime('now')
          WHERE id = ?
        `).bind(objectKey, generatedAt, quoteId).run();

        await env.DB.prepare(`
          INSERT INTO audit_logs (id, entity_type, entity_id, action, actor, details_json)
          VALUES (?, 'QUOTATION', ?, 'QUOTATION_PDF_GENERATED', ?, ?)
        `).bind(
          'audit-' + crypto.randomUUID().slice(0, 8),
          quoteId,
          await getAuthActor(request, env),
          JSON.stringify({ r2_key: objectKey, generated_at: generatedAt, byte_length: pdfBytes.length })
        ).run();

        return new Response(pdfBytes, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${filename}"`,
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      }

      if (url.pathname.match(/^\/api\/quotations\/[^/]+$/) && method === 'PUT') {
        if (!(await checkAdminAuth(request, env))) return errorResponse('Unauthorized', 401);
        const quoteId = url.pathname.split('/')[3];
        const quote = await env.DB.prepare('SELECT * FROM quotations WHERE id = ?').bind(quoteId).first<DBQuotation>();
        if (!quote) return errorResponse('Quotation not found.', 404);

        if (quote.status === 'Converted') {
          return errorResponse('Cannot edit a quotation that has already been converted into an invoice.', 400);
        }

        const b = (await request.json()) as any;
        const sellerStateCode = env.SELLER_STATE_CODE?.trim() || '27';
        const buyerStateCode = b.buyer_state_code
          ? String(b.buyer_state_code).trim()
          : (b.buyer_gstin && String(b.buyer_gstin).trim().length >= 2 ? String(b.buyer_gstin).trim().substring(0, 2) : sellerStateCode);
        const buyerStateName = b.buyer_state_name ? String(b.buyer_state_name).trim() : (b.buyerStateName ? String(b.buyerStateName).trim() : quote.buyer_state_name);
        const isInterstate = buyerStateCode !== sellerStateCode;

        const rawItems = b.items || [];
        if (rawItems.length === 0) return errorResponse('At least one line item is required.');

        const computedItems = rawItems.map((it: any) =>
          computeLineItem(
            {
              productId: it.productId || it.product_id || null,
              itemDescription: it.itemDescription || it.item_description || it.name,
              hsnCode: it.hsnCode ? String(it.hsnCode).trim() : (it.hsn_code ? String(it.hsn_code).trim() : null),
              quantityMicrounits: Number(it.quantityMicrounits || Number(it.quantity || 1) * 1_000_000),
              unitOfMeasure: it.unitOfMeasure || it.unit_of_measure || 'NOS',
              unitPricePaise: Number(it.unitPricePaise || it.unit_price_paise || Math.round(Number(it.rate || 0) * 100)),
              discountBps: Number(it.discountBps || it.discount_bps || 0),
              gstRateBps: it.gstRateBps !== undefined && it.gstRateBps !== null ? Number(it.gstRateBps) : (it.gst_rate_bps !== undefined && it.gst_rate_bps !== null ? Number(it.gst_rate_bps) : null),
            },
            !!isInterstate
          )
        );

        const applyRoundOff = b.apply_round_off !== undefined ? (b.apply_round_off ? true : false) : (b.applyRoundOff ? true : true);
        const totals = computeTotals(computedItems, applyRoundOff);
        const customerId = b.customer_id || b.customerId || quote.customer_id || null;

        const batchStmts: any[] = [
          env.DB.prepare('DELETE FROM quotation_items WHERE quotation_id = ?').bind(quoteId),
          env.DB.prepare(`
            UPDATE quotations SET
              buyer_name = ?,
              buyer_company = ?,
              buyer_gstin = ?,
              buyer_state_code = ?,
              buyer_state_name = ?,
              buyer_address = ?,
              buyer_pincode = ?,
              buyer_phone = ?,
              buyer_email = ?,
              subtotal_gross_paise = ?,
              total_discount_paise = ?,
              taxable_amount_paise = ?,
              cgst_amount_paise = ?,
              sgst_amount_paise = ?,
              igst_amount_paise = ?,
              total_tax_paise = ?,
              round_off_paise = ?,
              total_amount_paise = ?,
              payment_terms = ?,
              delivery_terms = ?,
              notes = ?,
              is_interstate = ?,
              customer_id = ?,
              pdf_r2_key = NULL,
              pdf_generated_at = NULL,
              updated_at = datetime('now')
            WHERE id = ?
          `).bind(
            b.buyer_name || b.buyerName || quote.buyer_name,
            b.buyer_company || b.buyerCompany || null,
            b.buyer_gstin || b.buyerGstin || null,
            buyerStateCode,
            buyerStateName,
            b.buyer_address || b.buyerAddress || null,
            b.buyer_pincode || b.buyerPincode || null,
            b.buyer_phone || b.buyerPhone || null,
            b.buyer_email || b.buyerEmail || null,
            totals.subtotalGrossPaise,
            totals.totalDiscountPaise,
            totals.taxableAmountPaise,
            totals.cgstAmountPaise,
            totals.sgstAmountPaise,
            totals.igstAmountPaise,
            totals.totalTaxPaise,
            totals.roundOffPaise,
            totals.totalInvoiceAmountPaise,
            b.payment_terms || b.paymentTerms || null,
            b.delivery_terms || b.deliveryTerms || null,
            b.notes || null,
            isInterstate ? 1 : 0,
            customerId,
            quoteId
          )
        ];

        computedItems.forEach((it: any, idx: number) => {
          batchStmts.push(
            env.DB.prepare(`
              INSERT INTO quotation_items (
                id, quotation_id, line_number, product_id, item_description, hsn_code,
                quantity_microunits, unit_of_measure, unit_price_paise, gross_amount_paise,
                discount_bps, discount_amount_paise, taxable_amount_paise, gst_rate_bps,
                cgst_rate_bps, sgst_rate_bps, igst_rate_bps,
                cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_amount_paise
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              'qti-' + crypto.randomUUID().slice(0, 8),
              quoteId,
              idx + 1,
              it.productId,
              it.itemDescription,
              it.hsnCode,
              it.quantityMicrounits,
              it.unitOfMeasure,
              it.unitPricePaise,
              it.grossAmountPaise,
              it.discountBps,
              it.discountAmountPaise,
              it.taxableAmountPaise,
              it.gstRateBps,
              it.cgstRateBps,
              it.sgstRateBps,
              it.igstRateBps,
              it.cgstAmountPaise,
              it.sgstAmountPaise,
              it.igstAmountPaise,
              it.totalAmountPaise
            )
          );
        });

        const actor = await getAuthActor(request, env);
        batchStmts.push(
          env.DB.prepare(`
            INSERT INTO audit_logs (id, entity_type, entity_id, action, actor, details_json)
            VALUES (?, 'QUOTATION', ?, 'QUOTATION_EDITED', ?, ?)
          `).bind(
            'audit-' + crypto.randomUUID().slice(0, 8),
            quoteId,
            actor,
            JSON.stringify({ updated_by: actor, updated_at: new Date().toISOString() })
          )
        );

        await env.DB.batch(batchStmts);
        if (quote.pdf_r2_key && env.DOCUMENTS_BUCKET) {
          try { await env.DOCUMENTS_BUCKET.delete(quote.pdf_r2_key); } catch { /* Orphan cleanup can be retried independently. */ }
        }
        const updatedQuote = await env.DB.prepare('SELECT * FROM quotations WHERE id = ?').bind(quoteId).first<DBQuotation>();
        return jsonResponse({ success: true, quotation: updatedQuote });
      }

      // ------------------------------------------------------------------------
      // 7B. QUOTATION DISPATCH & STATUS TRANSITIONS
      // ------------------------------------------------------------------------
      if (url.pathname.match(/^\/api\/quotations\/[^/]+\/send$/) && method === 'POST') {
        if (!(await checkAdminAuth(request, env))) return errorResponse('Unauthorized', 401);
        const actor = await getAuthActor(request, env);
        const quoteId = url.pathname.split('/')[3];
        const body = (await request.json()) as {
          recipient_email?: string;
          recipient_name?: string;
          custom_message?: string;
        };

        if (!body.recipient_email || !body.recipient_email.includes('@')) {
          return errorResponse('Valid recipient email address is required for quotation dispatch.');
        }

        const quote = await env.DB.prepare('SELECT * FROM quotations WHERE id = ?')
          .bind(quoteId)
          .first<DBQuotation>();
        if (!quote) return errorResponse('Quotation not found.', 404);

        const recipient = body.recipient_name
          ? `${body.recipient_name.trim()} <${body.recipient_email.trim()}>`
          : body.recipient_email.trim();
        const sentAt = new Date().toISOString();

        // Determine durable idempotency key from header or default deterministic quotation key
        const idempotencyKey = request.headers.get('X-Idempotency-Key') ||
          request.headers.get('Idempotency-Key') ||
          `disp-${quote.id}-${quote.sequence_number || 1}`;

        // Check for existing dispatch records for this idempotency key or quotation
        const existingDispatch = await env.DB.prepare(
          'SELECT * FROM quotation_dispatches WHERE idempotency_key = ? OR quotation_id = ? ORDER BY initiated_at DESC LIMIT 1'
        ).bind(idempotencyKey, quoteId).first<DBQuotationDispatch>();

        // 7.B RECIPIENT VALIDATION BEFORE ANY RECOVERY OR RETRY BRANCH:
        // Validate recipient before ANY existing-dispatch recovery branch.
        // Recovery must use the original persisted recipient. It must never synchronize a quotation to Sent using a different recipient supplied by a later request.
        if (existingDispatch) {
          if (existingDispatch.recipient_email.toLowerCase() !== body.recipient_email.trim().toLowerCase()) {
            return errorResponse(
              `Cannot alter recipient to '${body.recipient_email.trim()}' under existing dispatch record. Original recipient was '${existingDispatch.recipient_email}'. Create a new quotation or request a distinct dispatch key.`,
              422
            );
          }
        }

        // IDEMPOTENT RECOVERY & DUPLICATE PROTECTION:
        // If an existing dispatch was already ACCEPTED by the provider:
        if (existingDispatch && existingDispatch.dispatch_status === 'ACCEPTED') {
          // If the quotation is already in Sent status, return the existing dispatch result idempotently
          if (quote.status === 'Sent') {
            return jsonResponse({
              success: true,
              quotation: quote,
              dispatch: existingDispatch,
              idempotent: true,
              message: 'Quotation was already dispatched and confirmed by provider (idempotent response; duplicate email prevented).',
            });
          }

          // Recovery must use the original persisted recipient, not whatever was passed in the retry request
          const originalRecipient = existingDispatch.recipient_name
            ? `${existingDispatch.recipient_name.trim()} <${existingDispatch.recipient_email.trim()}>`
            : existingDispatch.recipient_email.trim();

          // If the quotation is still in Draft (Provider accepted, but database update previously failed):
          // RECOVER: Complete the pending quotation status update and audit log without sending another email.
          await env.DB.batch([
            env.DB.prepare(`
              UPDATE quotations SET
                status = 'Sent',
                dispatch_id = ?,
                sent_at = coalesce(sent_at, ?),
                sent_to_recipient = ?,
                updated_at = datetime('now')
              WHERE id = ?
            `).bind(existingDispatch.id, existingDispatch.completed_at || sentAt, originalRecipient, quoteId),
            env.DB.prepare(`
              INSERT INTO audit_logs (id, entity_type, entity_id, action, actor, details_json)
              VALUES (?, 'QUOTATION', ?, 'DISPATCH_RECOVERED_SYNC', ?, ?)
            `).bind(
              'audit-' + crypto.randomUUID().slice(0, 8),
              quoteId,
              actor,
              JSON.stringify({
                dispatch_id: existingDispatch.id,
                provider_message_id: existingDispatch.provider_message_id,
                recipient: originalRecipient,
                recovery_note: 'Recovered pending quotation status after prior provider acceptance (original persisted recipient preserved)',
              })
            ),
          ]);

          const updatedQuote = await env.DB.prepare('SELECT * FROM quotations WHERE id = ?').bind(quoteId).first<DBQuotation>();
          return jsonResponse({
            success: true,
            quotation: updatedQuote,
            dispatch: existingDispatch,
            recovered: true,
            message: 'Recovered and synchronized pending quotation status after prior provider acceptance (duplicate email prevented).',
          });
        }

        // DISPATCH SAFETY & RECOVERY CONSTRAINTS:
        if (existingDispatch) {
          // 1. Unresolved In-Flight Transmission Protection:
          // Do NOT automatically resend merely because an arbitrary duration elapsed.
          // If a dispatch is still in TRANSMITTING status, automatic resending is blocked to prevent duplicate emails.
          if (existingDispatch.dispatch_status === 'TRANSMITTING') {
            return errorResponse(
              'Dispatch transmission is currently in progress or previous attempt outcome is unresolved (status: TRANSMITTING). Automatic resending is blocked to prevent duplicate transmissions. Please wait or perform administrative reconciliation.',
              409
            );
          }

          // 2. Outbound Payload & Recipient Invariance:
          // Prevent retrying with an altered recipient under the same dispatch / idempotency key.
          if (existingDispatch.recipient_email.toLowerCase() !== body.recipient_email.trim().toLowerCase()) {
            return errorResponse(
              `Cannot alter recipient to '${body.recipient_email.trim()}' under existing dispatch key. Original recipient was '${existingDispatch.recipient_email}'. Create a new quotation or request a distinct dispatch key.`,
              422
            );
          }

          // 3. Provider Idempotency Retention Window Check (Resend 24-Hour Cache Window):
          // Resend retains Idempotency-Key records for 24 hours (86,400,000 ms).
          // If a retry is attempted after the provider's 24-hour retention window, safe reconciliation cannot be guaranteed
          // at the provider layer. Require manual review rather than risking duplicate transmission.
          const dispatchAgeMs = Date.now() - new Date(existingDispatch.initiated_at).getTime();
          if (dispatchAgeMs > 86400000) {
            return errorResponse(
              'Provider 24-hour idempotency retention window has expired for this dispatch record. The upstream email transport can no longer guarantee duplicate prevention for this key. Manual administrative review is required before re-attempting dispatch.',
              422
            );
          }
        }

        if (quote.status !== 'Draft') {
          return errorResponse(`Quotation is already in ${quote.status} status. Only Draft quotations can be dispatched.`);
        }

        // 6. GST AND HSN SAFETY VALIDATION BEFORE DISPATCH:
        // Never dispatch a quotation with missing GST classification or HSN
        const quoteItems = await env.DB.prepare(
          'SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY line_number ASC'
        ).bind(quoteId).all<DBQuotationItem>();

        if (!quoteItems.results || quoteItems.results.length === 0) {
          return errorResponse('Quotation must contain at least one line item before dispatch.', 422);
        }

        for (const it of quoteItems.results) {
          if (it.gst_rate_bps === null || it.gst_rate_bps === undefined) {
            return errorResponse(
              `Quotation item ${it.line_number} ("${it.item_description}") has unconfirmed (NULL) GST rate. Administrator must specify a confirmed GST rate before dispatch.`,
              422
            );
          }
          if (!it.hsn_code || it.hsn_code.trim().length < 4) {
            return errorResponse(
              `Quotation item ${it.line_number} ("${it.item_description}") has unconfirmed (NULL) HSN code. Administrator must specify a verified 4-to-8 digit HSN code before dispatch.`,
              422
            );
          }
        }

        // STAGING CREDENTIAL ISOLATION:
        // Use ONLY dedicated STAGING_EMAIL_API_KEY. Do not fall back to generic or production credentials.
        const stagingApiKey = env.STAGING_EMAIL_API_KEY;

        if (stagingApiKey) {
          // LIVE / STAGING EMAIL PROVIDER INTEGRATION WITH OUTBOX PATTERN
          // DURABLE IDEMPOTENCY KEY GUARANTEE:
          // A retry of the same dispatch MUST reuse the exact same provider_idempotency_key.
          // It must NEVER generate a new key on retry.
          const dispatchId = existingDispatch ? existingDispatch.id : ('disp-' + crypto.randomUUID().slice(0, 8));
          const providerIdempotencyKey = existingDispatch?.provider_idempotency_key || `baba-qt-disp-${quote.id}`;

          if (existingDispatch) {
            // Safe retry: update existing dispatch record with TRANSMITTING status, increment retry count, KEEP SAME provider_idempotency_key
            await env.DB.prepare(`
              UPDATE quotation_dispatches SET
                dispatch_status = 'TRANSMITTING',
                retry_count = retry_count + 1,
                initiated_at = datetime('now'),
                error_message = NULL
              WHERE id = ?
            `).bind(dispatchId).run();

            // Record every retry attempt in audit log
            await env.DB.prepare(`
              INSERT INTO audit_logs (id, entity_type, entity_id, action, actor, details_json)
              VALUES (?, 'QUOTATION', ?, 'DISPATCH_RETRY_ATTEMPTED', ?, ?)
            `).bind(
              'audit-' + crypto.randomUUID().slice(0, 8),
              quoteId,
              actor,
              JSON.stringify({
                dispatch_id: dispatchId,
                retry_count: existingDispatch.retry_count + 1,
                provider_idempotency_key: providerIdempotencyKey,
                recipient,
                previous_status: existingDispatch.dispatch_status,
              })
            ).run();
          } else {
            // Initial dispatch: insert new durable record with TRANSMITTING status before outbound network request
            await env.DB.prepare(`
              INSERT INTO quotation_dispatches (
                id, quotation_id, idempotency_key, recipient_email, recipient_name,
                dispatch_status, provider_name, provider_idempotency_key, retry_count,
                initiated_at, initiated_by
              ) VALUES (?, ?, ?, ?, ?, 'TRANSMITTING', 'RESEND_STAGING', ?, 0, datetime('now'), ?)
            `).bind(
              dispatchId,
              quoteId,
              idempotencyKey,
              body.recipient_email.trim(),
              body.recipient_name ? body.recipient_name.trim() : null,
              providerIdempotencyKey,
              actor
            ).run();
          }

          let providerAccepted = false;
          let providerMessageId: string | null = null;
          let providerError: string | null = null;
          let isTimeout = false;

          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            isTimeout = true;
            controller.abort();
          }, 10000); // 10-second timeout

          try {
            const providerResp = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${stagingApiKey}`,
                'Content-Type': 'application/json',
                'Idempotency-Key': providerIdempotencyKey,
              },
              body: JSON.stringify({
                from: 'BABA ENTERPRISES <quotations@babaenterprises.com>',
                to: [body.recipient_email.trim()],
                subject: `Quotation ${quote.quotation_number} from BABA ENTERPRISES`,
                text: `Dear Customer,\n\nPlease find details for quotation ${quote.quotation_number}.\nTotal Amount: Rs. ${(quote.total_amount_paise / 100).toFixed(2)}\n\nBABA ENTERPRISES\nBhosari, Pune\n\nNote: Binary PDF is not attached to this email transmission.`,
              }),
              signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (providerResp.ok) {
              const resData = (await providerResp.json()) as { id?: string };
              // 7.A: Never fabricate a provider message ID using a timestamp or generated fallback.
              // A quotation may become Sent only if the provider returns a genuine, non-empty message ID and a successful response.
              if (resData && typeof resData.id === 'string' && resData.id.trim().length > 0) {
                providerAccepted = true;
                providerMessageId = resData.id.trim();
              } else {
                providerAccepted = false;
                providerError = 'Provider returned successful HTTP response but missing or empty message ID.';
              }
            } else {
              const errBody = await providerResp.text();
              providerError = `HTTP ${providerResp.status}: ${errBody}`;
            }
          } catch (err: any) {
            clearTimeout(timeoutId);
            if (isTimeout || err.name === 'AbortError') {
              isTimeout = true;
              providerError = 'Provider request timed out after 10000ms. Transmission outcome unknown.';
            } else {
              providerError = err.message || 'Network transport failure';
            }
          }

          // Case A: Provider timed out with unknown outcome
          if (isTimeout) {
            await env.DB.prepare(`
              UPDATE quotation_dispatches SET
                dispatch_status = 'TIMED_OUT',
                error_message = ?,
                completed_at = datetime('now')
              WHERE id = ?
            `).bind(providerError, dispatchId).run();

            await env.DB.prepare(`
              INSERT INTO audit_logs (id, entity_type, entity_id, action, actor, details_json)
              VALUES (?, 'QUOTATION', ?, 'DISPATCH_TIMED_OUT', ?, ?)
            `).bind(
              'audit-' + crypto.randomUUID().slice(0, 8),
              quoteId,
              actor,
              JSON.stringify({
                dispatch_id: dispatchId,
                quotation_number: quote.quotation_number,
                recipient,
                error: providerError,
              })
            ).run();

            return errorResponse(`Email dispatch timed out with provider. Transmission outcome is unknown. Quotation strictly remains in Draft for safe review.`, 504);
          }

          // Case B: Provider rejected transmission (HTTP 4xx/5xx or network error)
          if (!providerAccepted) {
            await env.DB.prepare(`
              UPDATE quotation_dispatches SET
                dispatch_status = 'FAILED',
                error_message = ?,
                completed_at = datetime('now')
              WHERE id = ?
            `).bind(providerError, dispatchId).run();

            await env.DB.prepare(`
              INSERT INTO audit_logs (id, entity_type, entity_id, action, actor, details_json)
              VALUES (?, 'QUOTATION', ?, 'DISPATCH_FAILED', ?, ?)
            `).bind(
              'audit-' + crypto.randomUUID().slice(0, 8),
              quoteId,
              actor,
              JSON.stringify({
                dispatch_id: dispatchId,
                quotation_number: quote.quotation_number,
                recipient,
                error: providerError,
                attempted_at: sentAt,
              })
            ).run();

            return errorResponse(`Email transport provider rejected dispatch: ${providerError}. Quotation strictly remains in Draft.`, 502);
          }

          // Case C: Provider ACCEPTED transmission
          // Step 1: Record durable ACCEPTED state in quotation_dispatches first
          const completedAt = new Date().toISOString();
          await env.DB.prepare(`
            UPDATE quotation_dispatches SET
              dispatch_status = 'ACCEPTED',
              provider_message_id = ?,
              completed_at = ?
            WHERE id = ?
          `).bind(providerMessageId, completedAt, dispatchId).run();

          // Step 2: Update quotation to Sent and insert audit log
          await env.DB.batch([
            env.DB.prepare(`
              UPDATE quotations SET
                status = 'Sent',
                dispatch_id = ?,
                sent_at = ?,
                sent_to_recipient = ?,
                updated_at = datetime('now')
              WHERE id = ?
            `).bind(dispatchId, sentAt, recipient, quoteId),
            env.DB.prepare(`
              INSERT INTO audit_logs (id, entity_type, entity_id, action, actor, details_json)
              VALUES (?, 'QUOTATION', ?, 'DISPATCH_TRANSMITTED', ?, ?)
            `).bind(
              'audit-' + crypto.randomUUID().slice(0, 8),
              quoteId,
              actor,
              JSON.stringify({
                quotation_number: quote.quotation_number,
                sent_to: recipient,
                sent_at: sentAt,
                dispatch_id: dispatchId,
                provider_message_id: providerMessageId,
                transport_provider: 'RESEND_STAGING',
                transmission_status: 'ACCEPTED_BY_PROVIDER',
                pdf_attached: false,
                note: 'Accepted by provider; external inbox delivery is subject to recipient MTA acceptance.',
              })
            ),
          ]);

          const updatedQuote = await env.DB.prepare('SELECT * FROM quotations WHERE id = ?')
            .bind(quoteId)
            .first<DBQuotation>();

          return jsonResponse({
            success: true,
            quotation: updatedQuote,
            dispatch: {
              dispatch_id: dispatchId,
              status: 'Sent',
              provider_accepted: true,
              provider_message_id: providerMessageId,
              sent_at: sentAt,
              sent_to_recipient: recipient,
              pdf_attached: false,
              transport_note: 'Accepted by email provider; external inbox delivery is subject to recipient MTA acceptance.',
            },
          });
        } else {
          // STAGING SAFETY MODE (NO STAGING_EMAIL_API_KEY CONFIGURED)
          // Reuse an existing dispatch row on retries: idempotency_key is UNIQUE.
          // A simulated dispatch is not a real customer transmission and keeps the quote Draft.
          if (existingDispatch && existingDispatch.dispatch_status === 'SIMULATED') {
            return jsonResponse({
              success: true,
              status: 'Draft',
              simulated: true,
              dispatch_id: existingDispatch.id,
              dispatch: existingDispatch,
              idempotent: true,
              message: 'This quotation dispatch was already simulated in staging. No duplicate record was created; quotation remains Draft.',
              quotation: quote,
            });
          }

          const simDispatchId = existingDispatch?.id || ('disp-sim-' + crypto.randomUUID().slice(0, 8));
          const simulationProviderKey = existingDispatch?.provider_idempotency_key || ('sim-' + crypto.randomUUID());
          const simulationStatements = [];

          if (existingDispatch) {
            // Recover a prior failed/timed-out attempt in place; preserve its unique key and history.
            simulationStatements.push(env.DB.prepare(`
              UPDATE quotation_dispatches SET
                dispatch_status = 'SIMULATED',
                provider_name = 'STAGING_SIMULATION',
                provider_idempotency_key = ?,
                initiated_at = datetime('now'),
                completed_at = datetime('now'),
                error_message = NULL
              WHERE id = ?
            `).bind(simulationProviderKey, simDispatchId));
          } else {
            simulationStatements.push(env.DB.prepare(`
              INSERT INTO quotation_dispatches (
                id, quotation_id, idempotency_key, recipient_email, recipient_name,
                dispatch_status, provider_name, provider_idempotency_key,
                initiated_at, completed_at, initiated_by
              ) VALUES (?, ?, ?, ?, ?, 'SIMULATED', 'STAGING_SIMULATION', ?, datetime('now'), datetime('now'), ?)
            `).bind(
              simDispatchId,
              quoteId,
              idempotencyKey,
              body.recipient_email.trim(),
              body.recipient_name ? body.recipient_name.trim() : null,
              simulationProviderKey,
              actor
            ));
          }

          simulationStatements.push(env.DB.prepare(`
            INSERT INTO audit_logs (id, entity_type, entity_id, action, actor, details_json)
            VALUES (?, 'QUOTATION', ?, 'DISPATCH_SIMULATED', ?, ?)
          `).bind(
            'audit-' + crypto.randomUUID().slice(0, 8),
            quoteId,
            actor,
            JSON.stringify({
              dispatch_id: simDispatchId,
              quotation_number: quote.quotation_number,
              attempted_recipient: recipient,
              attempted_at: sentAt,
              reason: 'NO_ACTIVE_STAGING_EMAIL_API_KEY',
              status: 'DRAFT_MAINTAINED',
              recovered_existing_dispatch: !!existingDispatch,
              pdf_attached: false,
            })
          ));

          await env.DB.batch(simulationStatements);

          return jsonResponse({
            success: true,
            status: 'Draft',
            simulated: true,
            dispatch_id: simDispatchId,
            idempotent: !!existingDispatch,
            message: 'Staging environment has no active STAGING_EMAIL_API_KEY configured. Simulation recorded or safely recovered in quotation_dispatches and audit_logs. Quotation strictly remains in Draft status. PDF binary dispatch is not claimed/implemented.',
            quotation: quote,
          });
        }
      }

      if (url.pathname.match(/^\/api\/quotations\/[^/]+\/status$/) && method === 'PATCH') {
        if (!(await checkAdminAuth(request, env))) return errorResponse('Unauthorized: Valid administrator authorization token is required.', 401);
        const actor = await getAuthActor(request, env);
        const quoteId = url.pathname.split('/')[3];
        const body = (await request.json()) as {
          status?: string;
          reason?: string;
          approval_evidence?: string;
          admin_confirmation?: string;
          rejection_reason?: string;
          expiry_reason?: string;
        };

        if (!body.status) return errorResponse('Target status is required.');

        // Guard against bypassing the verified dispatch workflow
        if (body.status === 'Sent') {
          return errorResponse(
            "Direct status transition to 'Sent' is prohibited. Quotations must be dispatched through the /api/quotations/:id/send endpoint with verified transport.",
            403
          );
        }

        if (body.status === 'Draft') {
          return errorResponse('Cannot revert active or resolved quotation to Draft.', 400);
        }

        if (body.status === 'Converted') {
          return errorResponse(
            'Quotation conversion must be executed through /api/quotations/:id/convert-to-invoice to generate the corresponding invoice atomically.',
            400
          );
        }

        const allowedTransitions = ['Accepted', 'Rejected', 'Expired'];
        if (!allowedTransitions.includes(body.status)) {
          return errorResponse(`Invalid target status '${body.status}'. Permitted transitions on this endpoint: ${allowedTransitions.join(', ')}.`, 400);
        }

        const quote = await env.DB.prepare('SELECT * FROM quotations WHERE id = ?')
          .bind(quoteId)
          .first<DBQuotation>();
        if (!quote) return errorResponse('Quotation not found.', 404);

        // Precondition: Quotation must be Sent before being Accepted, Rejected, or Expired
        if (quote.status !== 'Sent') {
          return errorResponse(
            `Quotation must be in 'Sent' status before transitioning to '${body.status}'. Current status is '${quote.status}'.`,
            400
          );
        }

        // Rigorous Evidence and Authorization Validation per Target Status
        let evidenceSummary = '';

        if (body.status === 'Accepted') {
          const evidence = (body.approval_evidence || body.admin_confirmation || body.reason || '').trim();
          if (!evidence || evidence.length < 10) {
            return errorResponse(
              "Transition to 'Accepted' requires verified client approval evidence or documented administrator confirmation (minimum 10 characters, e.g. PO number, confirmation email date, or letter reference).",
              400
            );
          }
          evidenceSummary = evidence;
        } else if (body.status === 'Rejected') {
          const rejReason = (body.rejection_reason || body.reason || '').trim();
          if (!rejReason || rejReason.length < 5) {
            return errorResponse(
              "Transition to 'Rejected' requires a documented rejection reason (minimum 5 characters).",
              400
            );
          }
          evidenceSummary = rejReason;
        } else if (body.status === 'Expired') {
          const today = new Date().toISOString().split('T')[0];
          const isPastValidity = quote.valid_until && quote.valid_until < today;
          const expReason = (body.expiry_reason || body.reason || '').trim();
          if (!isPastValidity && (!expReason || expReason.length < 10)) {
            return errorResponse(
              `Quotation validity period (${quote.valid_until}) has not expired yet. Premature expiration requires documented administrator justification (minimum 10 characters).`,
              400
            );
          }
          evidenceSummary = isPastValidity ? (expReason || 'VALIDITY_EXPIRED') : expReason;
        }

        // ATOMIC D1 BATCH: Update status and insert audit log together with authenticated actor
        await env.DB.batch([
          env.DB.prepare(`
            UPDATE quotations SET
              status = ?,
              updated_at = datetime('now')
            WHERE id = ?
          `).bind(body.status, quoteId),
          env.DB.prepare(`
            INSERT INTO audit_logs (id, entity_type, entity_id, action, actor, details_json)
            VALUES (?, 'QUOTATION', ?, ?, ?, ?)
          `).bind(
            'audit-' + crypto.randomUUID().slice(0, 8),
            quoteId,
            `STATUS_TRANSITION_${body.status.toUpperCase()}`,
            actor,
            JSON.stringify({
              previous_status: quote.status,
              new_status: body.status,
              evidence_or_reason: evidenceSummary,
              authorized_by: actor,
              timestamp: new Date().toISOString(),
            })
          ),
        ]);

        const updatedQuote = await env.DB.prepare('SELECT * FROM quotations WHERE id = ?')
          .bind(quoteId)
          .first<DBQuotation>();

        return jsonResponse({ success: true, quotation: updatedQuote });
      }

      // Convert Quotation to Invoice (Idempotent & Transactional)
      if (url.pathname.match(/^\/api\/quotations\/[^/]+\/convert-to-invoice$/) && method === 'POST') {
        if (!(await checkAdminAuth(request, env))) return errorResponse('Unauthorized', 401);
        const quoteId = url.pathname.split('/')[3];
        const quote = await env.DB.prepare('SELECT * FROM quotations WHERE id = ?').bind(quoteId).first<DBQuotation>();
        if (!quote) return errorResponse('Quotation not found.', 404);

        // 1. Idempotency Check: Return existing converted invoice if already converted
        if (quote.status === 'Converted' && quote.converted_invoice_id) {
          const existingInv = await env.DB.prepare('SELECT * FROM invoices WHERE id = ?')
            .bind(quote.converted_invoice_id)
            .first();
          return jsonResponse({
            success: true,
            invoice: existingInv,
            message: 'Quotation was already converted (idempotent response).',
          });
        }

        // 2. Prevent duplicate invoice creation if another invoice references this quotation
        const alreadyReferenced = await env.DB.prepare(
          'SELECT id FROM invoices WHERE reference_quotation_id = ?'
        ).bind(quote.id).first<{ id: string }>();
        if (alreadyReferenced) {
          const existingInv = await env.DB.prepare('SELECT * FROM invoices WHERE id = ?')
            .bind(alreadyReferenced.id)
            .first();
          return jsonResponse({
            success: true,
            invoice: existingInv,
            message: 'Quotation was already converted into invoice (idempotent response).',
          });
        }

        // 3. Status Gate: Strictly verify only Accepted quotations can be converted
        if (quote.status !== 'Accepted') {
          return errorResponse(
            `Only Accepted quotations can be converted into invoices. Quotation is currently in '${quote.status}' status.`,
            422
          );
        }

        const qItems = await env.DB.prepare(
          'SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY line_number ASC'
        )
          .bind(quoteId)
          .all<DBQuotationItem>();
        if (!qItems.results || qItems.results.length === 0) {
          return errorResponse('Quotation has no items.');
        }

        // Validate that quotation items have confirmed GST and HSN before converting
        for (const it of qItems.results) {
          if (it.gst_rate_bps === null || it.gst_rate_bps === undefined) {
            return errorResponse(
              `Quotation line item ${it.line_number} ("${it.item_description}") has unconfirmed (NULL) GST rate. All items must have confirmed GST rates before converting to invoice.`,
              422
            );
          }
          if (!it.hsn_code || it.hsn_code.trim().length < 4) {
            return errorResponse(
              `Quotation line item ${it.line_number} ("${it.item_description}") has unconfirmed (NULL) HSN code. All items must have verified 4-to-8 digit HSN codes before converting to invoice.`,
              422
            );
          }
        }

        // Fail closed if required seller configuration is missing
        if (!env.SELLER_GSTIN || !env.SELLER_STATE_CODE) {
          return errorResponse(
            'Seller configuration missing: SELLER_GSTIN and SELLER_STATE_CODE must be configured in environment.',
            500
          );
        }

        const invoiceId = 'inv-' + crypto.randomUUID().slice(0, 8);
        const isInterstate = quote.buyer_state_code !== env.SELLER_STATE_CODE ? 1 : 0;
        const targetFY = quote.financial_year || getFinancialYear(quote.quotation_date);
        const invoicePrefix = getInvoicePrefix(targetFY);

        const customerId = (quote as any).customer_id || null;

        // ATOMIC D1 BATCH: Insert invoice with exact quotation amounts, update quotation, and insert line items
        try {
          await env.DB.batch([
            env.DB.prepare(`
              INSERT INTO invoices (
                id, status, financial_year, invoice_prefix, seller_gstin, seller_state_code,
                buyer_name, buyer_trade_name, buyer_address, buyer_state_name, buyer_state_code, buyer_pincode,
                buyer_gstin, is_interstate, place_of_supply, reference_quotation_id, customer_id,
                subtotal_gross_paise, total_discount_paise, taxable_amount_paise,
                cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_tax_paise,
                apply_round_off, round_off_paise, total_invoice_amount_paise
              ) VALUES (?, 'Draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              invoiceId,
              targetFY,
              invoicePrefix,
              env.SELLER_GSTIN,
              env.SELLER_STATE_CODE,
              quote.buyer_name,
              quote.buyer_company,
              quote.buyer_address,
              quote.buyer_state_name,
              quote.buyer_state_code,
              quote.buyer_pincode || null,
              quote.buyer_gstin,
              isInterstate,
              quote.buyer_state_name + ' (' + quote.buyer_state_code + ')',
              quote.id,
              customerId,
              quote.subtotal_gross_paise,
              quote.total_discount_paise,
              quote.taxable_amount_paise,
              quote.cgst_amount_paise,
              quote.sgst_amount_paise,
              quote.igst_amount_paise,
              quote.total_tax_paise,
              quote.apply_round_off,
              quote.round_off_paise,
              quote.total_amount_paise
            ),
            env.DB.prepare(`
              UPDATE quotations SET status = 'Converted', converted_invoice_id = ?, updated_at = datetime('now') WHERE id = ?
            `).bind(invoiceId, quote.id),
            ...qItems.results.map((it: DBQuotationItem) =>
              env.DB.prepare(`
              INSERT INTO invoice_items (
                id, invoice_id, line_number, product_id, item_description, hsn_code,
                quantity_microunits, unit_of_measure, unit_price_paise, gross_amount_paise,
                discount_bps, discount_amount_paise, taxable_amount_paise, gst_rate_bps,
                cgst_rate_bps, sgst_rate_bps, igst_rate_bps,
                cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_amount_paise
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                'ivi-' + crypto.randomUUID().slice(0, 8),
                invoiceId,
                it.line_number,
                it.product_id,
                it.item_description,
                it.hsn_code,
                it.quantity_microunits,
                it.unit_of_measure,
                it.unit_price_paise,
                it.gross_amount_paise,
                it.discount_bps,
                it.discount_amount_paise,
                it.taxable_amount_paise,
                it.gst_rate_bps,
                it.cgst_rate_bps,
                it.sgst_rate_bps,
                it.igst_rate_bps,
                it.cgst_amount_paise,
                it.sgst_amount_paise,
                it.igst_amount_paise,
                it.total_amount_paise
              )
            ),
          ]);
        } catch (err: any) {
          const errStr = String(err?.message || err);
          if (errStr.includes('customer_id')) {
            await env.DB.batch([
              env.DB.prepare(`
                INSERT INTO invoices (
                  id, status, financial_year, invoice_prefix, seller_gstin, seller_state_code,
                  buyer_name, buyer_trade_name, buyer_address, buyer_state_name, buyer_state_code, buyer_pincode,
                  buyer_gstin, is_interstate, place_of_supply, reference_quotation_id,
                  subtotal_gross_paise, total_discount_paise, taxable_amount_paise,
                  cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_tax_paise,
                  apply_round_off, round_off_paise, total_invoice_amount_paise
                ) VALUES (?, 'Draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(
                invoiceId,
                targetFY,
                invoicePrefix,
                env.SELLER_GSTIN,
                env.SELLER_STATE_CODE,
                quote.buyer_name,
                quote.buyer_company,
                quote.buyer_address,
                quote.buyer_state_name,
                quote.buyer_state_code,
                quote.buyer_pincode || null,
                quote.buyer_gstin,
                isInterstate,
                quote.buyer_state_name + ' (' + quote.buyer_state_code + ')',
                quote.id,
                quote.subtotal_gross_paise,
                quote.total_discount_paise,
                quote.taxable_amount_paise,
                quote.cgst_amount_paise,
                quote.sgst_amount_paise,
                quote.igst_amount_paise,
                quote.total_tax_paise,
                quote.apply_round_off,
                quote.round_off_paise,
                quote.total_amount_paise
              ),
              env.DB.prepare(`
                UPDATE quotations SET status = 'Converted', converted_invoice_id = ?, updated_at = datetime('now') WHERE id = ?
              `).bind(invoiceId, quote.id),
              ...qItems.results.map((it: DBQuotationItem) =>
                env.DB.prepare(`
                INSERT INTO invoice_items (
                  id, invoice_id, line_number, product_id, item_description, hsn_code,
                  quantity_microunits, unit_of_measure, unit_price_paise, gross_amount_paise,
                  discount_bps, discount_amount_paise, taxable_amount_paise, gst_rate_bps,
                  cgst_rate_bps, sgst_rate_bps, igst_rate_bps,
                  cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_amount_paise
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(
                  'ivi-' + crypto.randomUUID().slice(0, 8),
                  invoiceId,
                  it.line_number,
                  it.product_id,
                  it.item_description,
                  it.hsn_code,
                  it.quantity_microunits,
                  it.unit_of_measure,
                  it.unit_price_paise,
                  it.gross_amount_paise,
                  it.discount_bps,
                  it.discount_amount_paise,
                  it.taxable_amount_paise,
                  it.gst_rate_bps,
                  it.cgst_rate_bps,
                  it.sgst_rate_bps,
                  it.igst_rate_bps,
                  it.cgst_amount_paise,
                  it.sgst_amount_paise,
                  it.igst_amount_paise,
                  it.total_amount_paise
                )
              ),
            ]);
          } else {
            throw err;
          }
        }

        const createdInvoice = await env.DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(invoiceId).first();
        return jsonResponse({ success: true, invoice: createdInvoice }, 201);
      }

      // ------------------------------------------------------------------------
      // 8. INVOICES ENGINE (Draft, Inseparable Sequence Reservation, Cancellation)
      // ------------------------------------------------------------------------
      if (url.pathname === '/api/invoices') {
        if (method === 'GET') {
          if (!(await checkAdminAuth(request, env))) return errorResponse('Unauthorized', 401);
          const invoices = await env.DB.prepare('SELECT * FROM invoices ORDER BY created_at DESC').all<DBInvoice>();
          return jsonResponse({ success: true, invoices: invoices.results });
        }
        if (method === 'POST') {
          if (!(await checkAdminAuth(request, env))) return errorResponse('Unauthorized', 401);
          const b = (await request.json()) as any;
          const sellerStateCode = env.SELLER_STATE_CODE?.trim() || '27';
          const buyerStateCode = b.buyer_state_code ? String(b.buyer_state_code).trim() : (b.buyer_gstin && String(b.buyer_gstin).trim().length >= 2 ? String(b.buyer_gstin).trim().substring(0, 2) : sellerStateCode);
          const isInterstate = b.is_interstate ?? (buyerStateCode !== sellerStateCode ? 1 : 0);

          const rawItems = b.items || [];
          if (rawItems.length === 0) return errorResponse('At least one item is required.');

          const computedItems = rawItems.map((it: any) =>
            computeLineItem(
              {
                productId: it.productId || null,
                itemDescription: it.itemDescription || it.name,
                hsnCode: it.hsnCode ? String(it.hsnCode).trim() : (it.hsn_code ? String(it.hsn_code).trim() : null),
                quantityMicrounits: Number(it.quantityMicrounits || Number(it.quantity || 1) * 1_000_000),
                unitOfMeasure: it.unitOfMeasure || 'NOS',
                unitPricePaise: Number(it.unitPricePaise || Math.round(Number(it.rate || 0) * 100)),
                discountBps: Number(it.discountBps || 0),
                gstRateBps: it.gstRateBps !== undefined && it.gstRateBps !== null ? Number(it.gstRateBps) : (it.gst_rate_bps !== undefined && it.gst_rate_bps !== null ? Number(it.gst_rate_bps) : null),
              },
              !!isInterstate
            )
          );

          // Fail closed if required seller configuration is missing
          if (!env.SELLER_GSTIN || !env.SELLER_STATE_CODE) {
            return errorResponse(
              'Seller configuration missing: SELLER_GSTIN and SELLER_STATE_CODE must be configured in environment.',
              500
            );
          }

          const totals = computeTotals(computedItems, b.apply_round_off !== 0);
          const invoiceId = 'inv-' + crypto.randomUUID().slice(0, 8);
          const targetFY = b.financial_year || getFinancialYear(b.invoice_date);
          const invoicePrefix = getInvoicePrefix(targetFY);
          const customerId = b.customer_id || null;
          const buyerStateName = b.buyer_state_name || null;
          const placeOfSupply = b.place_of_supply || (buyerStateName && buyerStateCode ? `${buyerStateName} (${buyerStateCode})` : (buyerStateName || null));

          try {
            await env.DB.batch([
              env.DB.prepare(`
                INSERT INTO invoices (
                  id, status, financial_year, invoice_prefix, seller_gstin, seller_state_code,
                  buyer_name, buyer_trade_name, buyer_address, buyer_city,
                  buyer_state_name, buyer_state_code, buyer_pincode, buyer_gstin,
                  is_interstate, place_of_supply, customer_id,
                  subtotal_gross_paise, total_discount_paise, taxable_amount_paise,
                  cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_tax_paise,
                  apply_round_off, round_off_paise, total_invoice_amount_paise
                ) VALUES (?, 'Draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(
                invoiceId,
                targetFY,
                invoicePrefix,
                env.SELLER_GSTIN,
                env.SELLER_STATE_CODE,
                b.buyer_name || null,
                b.buyer_trade_name || null,
                b.buyer_address || null,
                b.buyer_city || null,
                buyerStateName,
                buyerStateCode,
                b.buyer_pincode || null,
                b.buyer_gstin || null,
                isInterstate ? 1 : 0,
                placeOfSupply,
                customerId,
                totals.subtotalGrossPaise,
                totals.totalDiscountPaise,
                totals.taxableAmountPaise,
                totals.cgstAmountPaise,
                totals.sgstAmountPaise,
                totals.igstAmountPaise,
                totals.totalTaxPaise,
                totals.applyRoundOff ? 1 : 0,
                totals.roundOffPaise,
                totals.totalInvoiceAmountPaise
              ),
              ...computedItems.map((it: any, idx: number) =>
                env.DB.prepare(`
                INSERT INTO invoice_items (
                  id, invoice_id, line_number, product_id, item_description, hsn_code,
                  quantity_microunits, unit_of_measure, unit_price_paise, gross_amount_paise,
                  discount_bps, discount_amount_paise, taxable_amount_paise, gst_rate_bps,
                  cgst_rate_bps, sgst_rate_bps, igst_rate_bps,
                  cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_amount_paise
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(
                  'ivi-' + crypto.randomUUID().slice(0, 8),
                  invoiceId,
                  idx + 1,
                  it.productId,
                  it.itemDescription,
                  it.hsnCode,
                  it.quantityMicrounits,
                  it.unitOfMeasure,
                  it.unitPricePaise,
                  it.grossAmountPaise,
                  it.discountBps,
                  it.discountAmountPaise,
                  it.taxableAmountPaise,
                  it.gstRateBps,
                  it.cgstRateBps,
                  it.sgstRateBps,
                  it.igstRateBps,
                  it.cgstAmountPaise,
                  it.sgstAmountPaise,
                  it.igstAmountPaise,
                  it.totalAmountPaise
                )
              ),
            ]);
          } catch (colErr: any) {
            if (String(colErr).includes('customer_id')) {
              // Backward compatible fallback if customer_id migration has not yet executed on D1
              await env.DB.batch([
                env.DB.prepare(`
                  INSERT INTO invoices (
                    id, status, financial_year, invoice_prefix, seller_gstin, seller_state_code,
                    buyer_name, buyer_trade_name, buyer_address, buyer_city,
                    buyer_state_name, buyer_state_code, buyer_pincode, buyer_gstin,
                    is_interstate, place_of_supply,
                    subtotal_gross_paise, total_discount_paise, taxable_amount_paise,
                    cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_tax_paise,
                    apply_round_off, round_off_paise, total_invoice_amount_paise
                  ) VALUES (?, 'Draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(
                  invoiceId,
                  targetFY,
                  invoicePrefix,
                  env.SELLER_GSTIN,
                  env.SELLER_STATE_CODE,
                  b.buyer_name || null,
                  b.buyer_trade_name || null,
                  b.buyer_address || null,
                  b.buyer_city || null,
                  buyerStateName,
                  buyerStateCode,
                  b.buyer_pincode || null,
                  b.buyer_gstin || null,
                  isInterstate ? 1 : 0,
                  placeOfSupply,
                  totals.subtotalGrossPaise,
                  totals.totalDiscountPaise,
                  totals.taxableAmountPaise,
                  totals.cgstAmountPaise,
                  totals.sgstAmountPaise,
                  totals.igstAmountPaise,
                  totals.totalTaxPaise,
                  totals.applyRoundOff ? 1 : 0,
                  totals.roundOffPaise,
                  totals.totalInvoiceAmountPaise
                ),
                ...computedItems.map((it: any, idx: number) =>
                  env.DB.prepare(`
                  INSERT INTO invoice_items (
                    id, invoice_id, line_number, product_id, item_description, hsn_code,
                    quantity_microunits, unit_of_measure, unit_price_paise, gross_amount_paise,
                    discount_bps, discount_amount_paise, taxable_amount_paise, gst_rate_bps,
                    cgst_rate_bps, sgst_rate_bps, igst_rate_bps,
                    cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_amount_paise
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(
                    'ivi-' + crypto.randomUUID().slice(0, 8),
                    invoiceId,
                    idx + 1,
                    it.productId,
                    it.itemDescription,
                    it.hsnCode,
                    it.quantityMicrounits,
                    it.unitOfMeasure,
                    it.unitPricePaise,
                    it.grossAmountPaise,
                    it.discountBps,
                    it.discountAmountPaise,
                    it.taxableAmountPaise,
                    it.gstRateBps,
                    it.cgstRateBps,
                    it.sgstRateBps,
                    it.igstRateBps,
                    it.cgstAmountPaise,
                    it.sgstAmountPaise,
                    it.igstAmountPaise,
                    it.totalAmountPaise
                  )
                ),
              ]);
            } else {
              throw colErr;
            }
          }

          const created = await env.DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(invoiceId).first();
          return jsonResponse({ success: true, invoice: created }, 201);
        }
      }

      if (url.pathname.match(/^\/api\/invoices\/[^/]+$/) && method === 'GET') {
        if (!(await checkAdminAuth(request, env))) return errorResponse('Unauthorized', 401);
        const invoiceId = url.pathname.split('/')[3];
        const invoice = await env.DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(invoiceId).first<DBInvoice>();
        if (!invoice) return errorResponse('Invoice not found.', 404);
        const items = await env.DB.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY line_number ASC').bind(invoiceId).all();
        return jsonResponse({ success: true, invoice: invoice, items: items.results || [] });
      }

      if (url.pathname.match(/^\/api\/invoices\/[^/]+$/) && method === 'PUT') {
        if (!(await checkAdminAuth(request, env))) return errorResponse('Unauthorized', 401);
        const invoiceId = url.pathname.split('/')[3];
        const invoice = await env.DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(invoiceId).first<DBInvoice>();
        if (!invoice) return errorResponse('Invoice not found.', 404);

        if (invoice.status !== 'Draft') {
          return errorResponse(`Only Draft tax invoices can be edited. Invoice is currently in '${invoice.status}' status and is legally locked.`, 403);
        }

        const b = (await request.json()) as any;
        const sellerStateCode = env.SELLER_STATE_CODE?.trim() || '27';
        const buyerStateCode = b.buyer_state_code
          ? String(b.buyer_state_code).trim()
          : (b.buyer_gstin && String(b.buyer_gstin).trim().length >= 2 ? String(b.buyer_gstin).trim().substring(0, 2) : sellerStateCode);
        const isInterstate = b.is_interstate ?? (buyerStateCode !== sellerStateCode ? 1 : 0);

        const rawItems = b.items || [];
        if (rawItems.length === 0) return errorResponse('At least one line item is required.');

        const computedItems = rawItems.map((it: any) =>
          computeLineItem(
            {
              productId: it.productId || it.product_id || null,
              itemDescription: it.itemDescription || it.item_description || it.name,
              hsnCode: it.hsnCode ? String(it.hsnCode).trim() : (it.hsn_code ? String(it.hsn_code).trim() : null),
              quantityMicrounits: Number(it.quantityMicrounits || Number(it.quantity || 1) * 1_000_000),
              unitOfMeasure: it.unitOfMeasure || it.unit_of_measure || 'NOS',
              unitPricePaise: Number(it.unitPricePaise || it.unit_price_paise || Math.round(Number(it.rate || 0) * 100)),
              discountBps: Number(it.discountBps || it.discount_bps || 0),
              gstRateBps: it.gstRateBps !== undefined && it.gstRateBps !== null ? Number(it.gstRateBps) : (it.gst_rate_bps !== undefined && it.gst_rate_bps !== null ? Number(it.gst_rate_bps) : null),
            },
            !!isInterstate
          )
        );

        const applyRoundOff = b.apply_round_off !== undefined ? (b.apply_round_off ? 1 : 0) : (b.applyRoundOff ? 1 : 1);
        const totals = computeTotals(computedItems, applyRoundOff === 1);
        const customerId = b.customer_id || b.customerId || invoice.customer_id || null;
        const buyerStateName = b.buyer_state_name || invoice.buyer_state_name || null;
        const placeOfSupply = b.place_of_supply || (buyerStateName && buyerStateCode ? `${buyerStateName} (${buyerStateCode})` : (buyerStateName || null));

        const batchStmts: any[] = [
          env.DB.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').bind(invoiceId),
          env.DB.prepare(`
            UPDATE invoices SET
              buyer_name = ?,
              buyer_trade_name = ?,
              buyer_gstin = ?,
              buyer_state_code = ?,
              buyer_state_name = ?,
              buyer_address = ?,
              buyer_city = ?,
              buyer_pincode = ?,
              place_of_supply = ?,
              customer_id = ?,
              subtotal_gross_paise = ?,
              total_discount_paise = ?,
              taxable_amount_paise = ?,
              cgst_amount_paise = ?,
              sgst_amount_paise = ?,
              igst_amount_paise = ?,
              total_tax_paise = ?,
              apply_round_off = ?,
              round_off_paise = ?,
              total_invoice_amount_paise = ?,
              is_interstate = ?,
              notes = ?,
              updated_at = datetime('now')
            WHERE id = ?
          `).bind(
            b.buyer_name || b.buyerName || invoice.buyer_name,
            b.buyer_trade_name || b.buyerTradeName || null,
            b.buyer_gstin || b.buyerGstin || null,
            buyerStateCode,
            buyerStateName,
            b.buyer_address || b.buyerAddress || null,
            b.buyer_city || b.buyerCity || null,
            b.buyer_pincode || b.buyerPincode || null,
            placeOfSupply,
            customerId,
            totals.subtotalGrossPaise,
            totals.totalDiscountPaise,
            totals.taxableAmountPaise,
            totals.cgstAmountPaise,
            totals.sgstAmountPaise,
            totals.igstAmountPaise,
            totals.totalTaxPaise,
            applyRoundOff,
            totals.roundOffPaise,
            totals.totalInvoiceAmountPaise,
            isInterstate ? 1 : 0,
            b.notes || null,
            invoiceId
          )
        ];

        computedItems.forEach((it: any, idx: number) => {
          batchStmts.push(
            env.DB.prepare(`
              INSERT INTO invoice_items (
                id, invoice_id, line_number, product_id, item_description, hsn_code,
                quantity_microunits, unit_of_measure, unit_price_paise, gross_amount_paise,
                discount_bps, discount_amount_paise, taxable_amount_paise, gst_rate_bps,
                cgst_rate_bps, sgst_rate_bps, igst_rate_bps,
                cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_amount_paise
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              'ivi-' + crypto.randomUUID().slice(0, 8),
              invoiceId,
              idx + 1,
              it.productId,
              it.itemDescription,
              it.hsnCode,
              it.quantityMicrounits,
              it.unitOfMeasure,
              it.unitPricePaise,
              it.grossAmountPaise,
              it.discountBps,
              it.discountAmountPaise,
              it.taxableAmountPaise,
              it.gstRateBps,
              it.cgstRateBps,
              it.sgstRateBps,
              it.igstRateBps,
              it.cgstAmountPaise,
              it.sgstAmountPaise,
              it.igstAmountPaise,
              it.totalAmountPaise
            )
          );
        });

        const actor = await getAuthActor(request, env);
        batchStmts.push(
          env.DB.prepare(`
            INSERT INTO audit_logs (id, entity_type, entity_id, action, actor, details_json)
            VALUES (?, 'INVOICE', ?, 'INVOICE_EDITED', ?, ?)
          `).bind(
            'audit-' + crypto.randomUUID().slice(0, 8),
            invoiceId,
            actor,
            JSON.stringify({ updated_by: actor, updated_at: new Date().toISOString() })
          )
        );

        await env.DB.batch(batchStmts);
        const updatedInvoice = await env.DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(invoiceId).first();
        return jsonResponse({ success: true, invoice: updatedInvoice });
      }

      // ISSUE INVOICE (Inseparable sequence reservation and status transition via trigger)
      if (url.pathname.match(/^\/api\/invoices\/[^/]+\/issue$/) && method === 'POST') {
        if (!(await checkAdminAuth(request, env))) return errorResponse('Unauthorized', 401);
        const invId = url.pathname.split('/')[3];
        const invoice = await env.DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(invId).first<DBInvoice>();
        if (!invoice) return errorResponse('Invoice not found.', 404);
        if (invoice.status !== 'Draft') {
          return errorResponse(`Invoice is already ${invoice.status}. Only Draft invoices can be issued.`);
        }

        // 6. GST AND HSN SAFETY: Never issue an invoice with missing GST classification or HSN
        const invItems = await env.DB.prepare(
          'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY line_number ASC'
        ).bind(invId).all<DBInvoiceItem>();

        if (!invItems.results || invItems.results.length === 0) {
          return errorResponse('Invoice must contain at least one line item before issuance.', 422);
        }

        for (const it of invItems.results) {
          if (it.gst_rate_bps === null || it.gst_rate_bps === undefined) {
            return errorResponse(
              `Invoice item ${it.line_number} ("${it.item_description}") has unconfirmed (NULL) GST rate. Administrator must specify a confirmed GST rate before invoice issuance.`,
              422
            );
          }
          if (!it.hsn_code || it.hsn_code.trim().length < 4) {
            return errorResponse(
              `Invoice item ${it.line_number} ("${it.item_description}") has unconfirmed (NULL) HSN code. Administrator must specify a verified 4-to-8 digit HSN code before invoice issuance.`,
              422
            );
          }
        }

        // Validate buyer GSTIN if present (optional for B2C, but must match Luhn Mod-36 if provided)
        if (invoice.buyer_gstin) {
          if (!validateGSTINChecksum(invoice.buyer_gstin)) {
            return errorResponse('Invalid buyer GSTIN checksum (statutory Mod-36 Luhn check failed).');
          }
          if (invoice.buyer_state_code && !validateGSTINStateMatch(invoice.buyer_gstin, invoice.buyer_state_code)) {
            return errorResponse('Buyer GSTIN state prefix does not match buyer state code.');
          }
        }

        // Derive or validate financial year from stored record or invoice date (never fall back to a hardcoded string)
        const fy = invoice.financial_year || getFinancialYear(invoice.invoice_date);
        const expectedPrefix = getInvoicePrefix(fy);

        if (invoice.invoice_prefix !== expectedPrefix || invoice.financial_year !== fy) {
          await env.DB.prepare(
            "UPDATE invoices SET financial_year = ?, invoice_prefix = ?, updated_at = datetime('now') WHERE id = ?"
          ).bind(fy, expectedPrefix, invId).run();
        }

        let nextSequence: number;
        try {
          const maxSeqRow = await env.DB.prepare(
            'SELECT coalesce(max(sequence_number), 0) as maxSeq FROM invoice_sequence_log WHERE financial_year = ?'
          )
            .bind(fy)
            .first<{ maxSeq: number }>();
          nextSequence = (maxSeqRow?.maxSeq || 0) + 1;

          // Inserting into invoice_sequence_log triggers trg_execute_invoice_issuance_on_sequence_reservation
          // which asserts buyer details, line items, non-NULL GST rates, and financial balancing,
          // and updates invoice status to 'Issued' with official number BE/YY-YY/XXXX.
          await env.DB.prepare(`
            INSERT INTO invoice_sequence_log (financial_year, sequence_number, invoice_id, allocated_by)
            VALUES (?, ?, ?, 'ADMIN_STAGING')
          `).bind(fy, nextSequence, invId).run();
        } catch (seqErr: any) {
          if (String(seqErr).includes('no such table: invoice_sequence_log')) {
            // Resilient fallback if staging D1 sequence log table not yet applied
            const maxSeqRow = await env.DB.prepare(
              'SELECT coalesce(max(sequence_number), 0) as maxSeq FROM invoices WHERE financial_year = ? AND sequence_number IS NOT NULL'
            ).bind(fy).first<{ maxSeq: number }>();
            nextSequence = (maxSeqRow?.maxSeq || 0) + 1;
            const fullInvNumber = `${expectedPrefix}${String(nextSequence).padStart(4, '0')}`;
            await env.DB.prepare(`
              UPDATE invoices SET
                status = 'Issued',
                sequence_number = ?,
                invoice_number = ?,
                issued_at = datetime('now'),
                updated_at = datetime('now')
              WHERE id = ?
            `).bind(nextSequence, fullInvNumber, invId).run();
          } else {
            throw seqErr;
          }
        }

        const issued = await env.DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(invId).first<DBInvoice>();
        return jsonResponse({ success: true, invoice: issued });
      }

      // CANCEL INVOICE
      if (url.pathname.match(/^\/api\/invoices\/[^/]+\/cancel$/) && method === 'POST') {
        if (!(await checkAdminAuth(request, env))) return errorResponse('Unauthorized', 401);
        const invId = url.pathname.split('/')[3];
        const b = (await request.json()) as { reason?: string; cancelled_by?: string };
        if (!b.reason || b.reason.trim().length < 5) {
          return errorResponse('Cancellation reason (min 5 chars) is mandatory.');
        }

        await env.DB.prepare(`
          UPDATE invoices SET
            status = 'Cancelled',
            cancellation_reason = ?,
            cancelled_at = datetime('now'),
            cancelled_by = ?,
            updated_at = datetime('now')
          WHERE id = ?
        `).bind(b.reason.trim(), b.cancelled_by?.trim() || 'ADMIN_STAGING', invId).run();

        const cancelled = await env.DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(invId).first();
        return jsonResponse({ success: true, invoice: cancelled });
      }

      // PRINT-READY HTML INVOICE (Protected: Requires Admin Authorization)
      if (url.pathname.match(/^\/api\/invoices\/[^/]+\/html$/) && method === 'GET') {
        if (!(await checkAdminAuth(request, env))) {
          return errorResponse('Unauthorized: Administrative authorization required to view invoice HTML.', 401);
        }
        const invId = url.pathname.split('/')[3];
        const invoice = await env.DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(invId).first<DBInvoice>();
        if (!invoice) return errorResponse('Invoice not found.', 404);

        const settings = await env.DB.prepare('SELECT * FROM business_settings WHERE id = 1').first<BusinessSettings>();
        const items = await env.DB.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY line_number ASC')
          .bind(invId)
          .all<DBInvoiceItem>();

        const html = generateInvoiceHTML(settings!, invoice, items.results);
        return new Response(html, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }

      // ------------------------------------------------------------------------
      // 9. STATIC SPA ASSET FALLBACK
      // ------------------------------------------------------------------------
      if (env.ASSETS) {
        return await env.ASSETS.fetch(request);
      }

      return new Response('BABA ENTERPRISES Staging API Service is operational.', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    } catch (err: any) {
      return jsonResponse({ success: false, error: err.message || 'Internal Server Error' }, 500);
    }
  },
};

export {
  checkAdminAuth,
  createSignedToken,
  verifySignedToken,
  timingSafeEqual,
  jsonResponse,
  errorResponse,
};

export default worker;
