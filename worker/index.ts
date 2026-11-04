// ==============================================================================
// BABA ENTERPRISES — CLOUDFLARE WORKER BACKEND ENGINE
// Target: babaenterprises-staging
// Hardened Authentication, Timing-Safe Comparison, Rate Limiting, R2 Protection
// ==============================================================================

import {
  Env,
  BusinessSettings,
  DBProduct,
  DBEnquiry,
  DBInvoice,
  DBInvoiceItem,
  DBQuotation,
  DBQuotationItem,
  ExecutionContext,
} from './types';
import { computeLineItem, computeTotals } from './financials';
import { validateGSTINChecksum, validateGSTINStateMatch } from './gstin';
import { generateInvoiceHTML } from './pdf';

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
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;
  const secret = env.JWT_SECRET || env.ADMIN_PASSCODE || 'BabaEnterprises#StagingSecret2026';
  return await verifySignedToken(token, secret);
}

// ------------------------------------------------------------------------------
// Main Cloudflare Worker Fetch Handler
// ------------------------------------------------------------------------------

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
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

        const body = (await request.json()) as { passcode?: string };
        const configuredPasscode = env.ADMIN_PASSCODE || 'BabaAdmin#2026!Secure';

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
        const secret = env.JWT_SECRET || env.ADMIN_PASSCODE || 'BabaEnterprises#StagingSecret2026';
        const token = await createSignedToken(secret);

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
          const refs = await env.DB.prepare('SELECT * FROM customer_references ORDER BY sort_order ASC').all();
          return jsonResponse({ success: true, references: refs.results });
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
      // 7. QUOTATIONS ENGINE (Configurable Prefix)
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
          const isInterstate = b.buyer_state_code && b.buyer_state_code !== '27';

          // Compute items
          const rawItems = b.items || [];
          if (rawItems.length === 0) return errorResponse('At least one item is required.');

          const computedItems = rawItems.map((it: any) =>
            computeLineItem(
              {
                productId: it.productId || null,
                itemDescription: it.itemDescription || it.name,
                hsnCode: it.hsnCode || '4016',
                quantityMicrounits: Number(it.quantityMicrounits || Number(it.quantity || 1) * 1_000_000),
                unitOfMeasure: it.unitOfMeasure || 'NOS',
                unitPricePaise: Number(it.unitPricePaise || Math.round(Number(it.rate || 0) * 100)),
                discountBps: Number(it.discountBps || 0),
                gstRateBps: Number(it.gstRateBps !== undefined ? it.gstRateBps : 1800),
              },
              !!isInterstate
            )
          );

          const totals = computeTotals(computedItems, true);
          const quoteId = 'qt-' + crypto.randomUUID().slice(0, 8);

          // Configurable quotation prefix (default: BE/QT/26-27/)
          const prefix = env.GST_INVOICE_PREFIX ? env.GST_INVOICE_PREFIX.replace('BE/', 'BE/QT/') : 'BE/QT/26-27/';
          const fy = '2026-27';
          const maxSeqRow = await env.DB.prepare(
            'SELECT coalesce(max(sequence_number), 0) as maxSeq FROM quotation_sequence_log WHERE financial_year = ?'
          )
            .bind(fy)
            .first<{ maxSeq: number }>();
          const nextSeq = (maxSeqRow?.maxSeq || 0) + 1;
          const quoteNumber = `${prefix}${String(nextSeq).padStart(4, '0')}`;
          const todayStr = new Date().toISOString().slice(0, 10);
          const validUntilDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

          await env.DB.batch([
            env.DB.prepare(`
              INSERT INTO quotations (
                id, quotation_number, quotation_date, valid_until, buyer_name, buyer_company,
                buyer_gstin, buyer_state_code, buyer_state_name, buyer_address, buyer_phone, buyer_email,
                status, subtotal_amount_paise, discount_amount_paise, taxable_amount_paise,
                cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_tax_paise,
                round_off_paise, total_amount_paise, payment_terms, delivery_terms, notes
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              quoteId,
              quoteNumber,
              b.quotation_date || todayStr,
              b.valid_until || validUntilDate,
              b.buyer_name,
              b.buyer_company || null,
              b.buyer_gstin || null,
              b.buyer_state_code || '27',
              b.buyer_state_name || 'Maharashtra',
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
            env.DB.prepare(`
              INSERT INTO quotation_sequence_log (financial_year, sequence_number, quotation_id)
              VALUES (?, ?, ?)
            `).bind(fy, nextSeq, quoteId),
            ...computedItems.map((it: any, idx: number) =>
              env.DB.prepare(`
              INSERT INTO quotation_items (
                id, quotation_id, line_number, product_id, item_description, hsn_code,
                quantity_microunits, unit_of_measure, unit_price_paise, gross_amount_paise,
                discount_bps, discount_amount_paise, taxable_amount_paise, gst_rate_bps,
                cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_amount_paise
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                it.cgstAmountPaise,
                it.sgstAmountPaise,
                it.igstAmountPaise,
                it.totalAmountPaise
              )
            ),
          ]);

          const created = await env.DB.prepare('SELECT * FROM quotations WHERE id = ?').bind(quoteId).first();
          return jsonResponse({ success: true, quotation: created }, 201);
        }
      }

      // Convert Quotation to Invoice (Idempotent & Transactional)
      if (url.pathname.match(/^\/api\/quotations\/[^/]+\/convert-to-invoice$/) && method === 'POST') {
        if (!(await checkAdminAuth(request, env))) return errorResponse('Unauthorized', 401);
        const quoteId = url.pathname.split('/')[3];
        const quote = await env.DB.prepare('SELECT * FROM quotations WHERE id = ?').bind(quoteId).first<DBQuotation>();
        if (!quote) return errorResponse('Quotation not found.', 404);

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

        const qItems = await env.DB.prepare(
          'SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY line_number ASC'
        )
          .bind(quoteId)
          .all<DBQuotationItem>();
        if (!qItems.results || qItems.results.length === 0) {
          return errorResponse('Quotation has no items.');
        }

        const invoiceId = 'inv-' + crypto.randomUUID().slice(0, 8);
        const isInterstate = quote.buyer_state_code !== '27' ? 1 : 0;

        await env.DB.batch([
          env.DB.prepare(`
            INSERT INTO invoices (
              id, status, financial_year, seller_gstin, seller_state_code,
              buyer_name, buyer_trade_name, buyer_address, buyer_state_name, buyer_state_code,
              buyer_gstin, is_interstate, place_of_supply, reference_quotation_id,
              subtotal_gross_paise, total_discount_paise, taxable_amount_paise,
              cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_tax_paise,
              apply_round_off, round_off_paise, total_invoice_amount_paise
            ) VALUES (?, 'Draft', '2026-27', '27AGCPB8322L1ZG', '27', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
          `).bind(
            invoiceId,
            quote.buyer_name,
            quote.buyer_company,
            quote.buyer_address,
            quote.buyer_state_name,
            quote.buyer_state_code,
            quote.buyer_gstin,
            isInterstate,
            quote.buyer_state_name + ' (' + quote.buyer_state_code + ')',
            quote.id,
            quote.subtotal_amount_paise,
            quote.discount_amount_paise,
            quote.taxable_amount_paise,
            quote.cgst_amount_paise,
            quote.sgst_amount_paise,
            quote.igst_amount_paise,
            quote.total_tax_paise,
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
              it.hsn_code || '4016',
              it.quantity_microunits,
              it.unit_of_measure,
              it.unit_price_paise,
              it.gross_amount_paise,
              it.discount_bps,
              it.discount_amount_paise,
              it.taxable_amount_paise,
              it.gst_rate_bps,
              isInterstate ? 0 : Math.floor(it.gst_rate_bps / 2),
              isInterstate ? 0 : Math.floor(it.gst_rate_bps / 2),
              isInterstate ? it.gst_rate_bps : 0,
              it.cgst_amount_paise,
              it.sgst_amount_paise,
              it.igst_amount_paise,
              it.total_amount_paise
            )
          ),
        ]);

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
          const isInterstate = b.is_interstate ?? (b.buyer_state_code && b.buyer_state_code !== '27' ? 1 : 0);

          const rawItems = b.items || [];
          if (rawItems.length === 0) return errorResponse('At least one item is required.');

          const computedItems = rawItems.map((it: any) =>
            computeLineItem(
              {
                productId: it.productId || null,
                itemDescription: it.itemDescription || it.name,
                hsnCode: it.hsnCode || '4016',
                quantityMicrounits: Number(it.quantityMicrounits || Number(it.quantity || 1) * 1_000_000),
                unitOfMeasure: it.unitOfMeasure || 'NOS',
                unitPricePaise: Number(it.unitPricePaise || Math.round(Number(it.rate || 0) * 100)),
                discountBps: Number(it.discountBps || 0),
                gstRateBps: Number(it.gstRateBps !== undefined ? it.gstRateBps : 1800),
              },
              !!isInterstate
            )
          );

          const totals = computeTotals(computedItems, b.apply_round_off !== 0);
          const invoiceId = 'inv-' + crypto.randomUUID().slice(0, 8);

          await env.DB.batch([
            env.DB.prepare(`
              INSERT INTO invoices (
                id, status, financial_year, seller_gstin, seller_state_code,
                buyer_name, buyer_trade_name, buyer_address, buyer_city,
                buyer_state_name, buyer_state_code, buyer_pincode, buyer_gstin,
                is_interstate, place_of_supply,
                subtotal_gross_paise, total_discount_paise, taxable_amount_paise,
                cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_tax_paise,
                apply_round_off, round_off_paise, total_invoice_amount_paise
              ) VALUES (?, 'Draft', '2026-27', '27AGCPB8322L1ZG', '27', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              invoiceId,
              b.buyer_name || null,
              b.buyer_trade_name || null,
              b.buyer_address || null,
              b.buyer_city || null,
              b.buyer_state_name || 'Maharashtra',
              b.buyer_state_code || '27',
              b.buyer_pincode || null,
              b.buyer_gstin || null,
              isInterstate,
              b.place_of_supply || (b.buyer_state_name ? b.buyer_state_name + ' (' + (b.buyer_state_code || '27') + ')' : null),
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

          const created = await env.DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(invoiceId).first();
          return jsonResponse({ success: true, invoice: created }, 201);
        }
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

        // Validate buyer GSTIN if present (optional for B2C, but must match Luhn Mod-36 if provided)
        if (invoice.buyer_gstin) {
          if (!validateGSTINChecksum(invoice.buyer_gstin)) {
            return errorResponse('Invalid buyer GSTIN checksum (statutory Mod-36 Luhn check failed).');
          }
          if (invoice.buyer_state_code && !validateGSTINStateMatch(invoice.buyer_gstin, invoice.buyer_state_code)) {
            return errorResponse('Buyer GSTIN state prefix does not match buyer state code.');
          }
        }

        // Determine contiguous sequence number
        const fy = invoice.financial_year || '2026-27';
        const maxSeqRow = await env.DB.prepare(
          'SELECT coalesce(max(sequence_number), 0) as maxSeq FROM invoice_sequence_log WHERE financial_year = ?'
        )
          .bind(fy)
          .first<{ maxSeq: number }>();
        const nextSequence = (maxSeqRow?.maxSeq || 0) + 1;

        // Inserting into invoice_sequence_log triggers trg_execute_invoice_issuance_on_sequence_reservation
        // which asserts buyer details, line items, non-NULL GST rates, and financial balancing,
        // and updates invoice status to 'Issued' with official number BE/26-27/XXXX.
        await env.DB.prepare(`
          INSERT INTO invoice_sequence_log (financial_year, sequence_number, invoice_id, allocated_by)
          VALUES (?, ?, ?, 'ADMIN_STAGING')
        `).bind(fy, nextSequence, invId).run();

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

      // PRINT-READY HTML INVOICE
      if (url.pathname.match(/^\/api\/invoices\/[^/]+\/html$/) && method === 'GET') {
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
