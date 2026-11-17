import type { Env } from './types.ts';

type AuthCheck = (request: Request) => Promise<boolean>;
type ActorLookup = (request: Request, env: Env) => Promise<string>;

function response(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Idempotency-Key',
    },
  });
}

function fail(message: string, status = 400): Response {
  return response({ success: false, error: message }, status);
}

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function text(value: unknown, max = 500): string | null {
  if (typeof value !== 'string') return null;
  const result = value.trim();
  return result ? result.slice(0, max) : null;
}

function accountingError(error: unknown): string {
  const raw = String((error as any)?.message || error || '');
  if (raw.includes('ERR_ACCOUNTING_UNBALANCED')) return 'Voucher cannot be posted: total debits and credits must match exactly.';
  if (raw.includes('ERR_ACCOUNTING_MINIMUM_LINES')) return 'Voucher must contain at least two accounting lines.';
  if (raw.includes('ERR_ACCOUNTING_ZERO_VALUE')) return 'Voucher total must be greater than zero.';
  if (raw.includes('ERR_ACCOUNTING_PERIOD_INVALID')) return 'Voucher date must fall within an open financial year.';
  if (raw.includes('ERR_ACCOUNTING_CUSTOMER_REQUIRED')) return 'A customer must be selected for the Sundry Debtors account.';
  if (raw.includes('ERR_ACCOUNTING_SUPPLIER_REQUIRED')) return 'A supplier must be selected for the Sundry Creditors account.';
  if (raw.includes('ERR_ACCOUNTING_PARTY_ACCOUNT_MISMATCH')) return 'Customer or supplier details can only be attached to the corresponding control account.';
  if (/UNIQUE constraint failed/i.test(raw)) return 'This voucher number or source reference already exists.';
  if (/FOREIGN KEY constraint failed/i.test(raw)) return 'A selected customer, supplier, account or financial year is invalid.';
  return 'Accounting operation failed. No success has been recorded. Check the selected records and try again.';
}

export async function handleAccountingRequest(
  request: Request,
  env: Env,
  isAdmin: AuthCheck,
  getActor: ActorLookup
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (!path.startsWith('/api/accounting/')) return null;
  if (!(await isAdmin(request))) return fail('Unauthorized', 401);

  try {
    if (path === '/api/accounting/periods' && method === 'GET') {
      const result = await env.DB.prepare(
        'SELECT * FROM accounting_periods ORDER BY start_date DESC'
      ).all();
      return response({ success: true, periods: result.results });
    }

    if (path === '/api/accounting/accounts' && method === 'GET') {
      const result = await env.DB.prepare(
        'SELECT id, account_code, name, parent_account_id, account_type, normal_balance, is_group, is_control_account, system_managed, is_active FROM ledger_accounts ORDER BY account_code'
      ).all();
      return response({ success: true, accounts: result.results });
    }

    if (path === '/api/accounting/suppliers' && method === 'GET') {
      const q = (url.searchParams.get('q') || '').trim().toLowerCase();
      const active = url.searchParams.get('active');
      const conditions: string[] = [];
      const params: string[] = [];
      if (active === '1' || active === '0') {
        conditions.push('is_active = ?');
        params.push(active);
      }
      if (q) {
        conditions.push('(lower(legal_name) LIKE ? OR lower(coalesce(trade_name, "")) LIKE ? OR lower(coalesce(gstin, "")) LIKE ? OR lower(coalesce(supplier_code, "")) LIKE ?)');
        const term = `%${q}%`;
        params.push(term, term, term, term);
      }
      const sql = 'SELECT * FROM suppliers' +
        (conditions.length ? ' WHERE ' + conditions.join(' AND ') : '') +
        ' ORDER BY legal_name';
      const result = params.length
        ? await env.DB.prepare(sql).bind(...params).all()
        : await env.DB.prepare(sql).all();
      return response({ success: true, suppliers: result.results });
    }

    if (path === '/api/accounting/suppliers' && method === 'POST') {
      const body = await request.json() as Record<string, unknown>;
      const legalName = text(body.legal_name, 200);
      if (!legalName || legalName.length < 2) return fail('Supplier legal name is required.', 422);
      const gstin = text(body.gstin, 15)?.toUpperCase() || null;
      if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
        return fail('Supplier GSTIN format is invalid.', 422);
      }
      const id = `sup-${crypto.randomUUID()}`;
      const supplierCode = text(body.supplier_code, 40) || `SUP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      await env.DB.prepare(`
        INSERT INTO suppliers (
          id, supplier_code, legal_name, trade_name, gstin, registration_type,
          address_line1, address_line2, city, state, state_code, pincode,
          contact_person, email, mobile
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, supplierCode, legalName, text(body.trade_name, 200), gstin,
        text(body.registration_type, 40), text(body.address_line1, 250),
        text(body.address_line2, 250), text(body.city, 100), text(body.state, 100),
        text(body.state_code, 2), text(body.pincode, 6), text(body.contact_person, 120),
        text(body.email, 200), text(body.mobile, 20)
      ).run();
      const supplier = await env.DB.prepare('SELECT * FROM suppliers WHERE id = ?').bind(id).first();
      return response({ success: true, supplier }, 201);
    }

    if (path === '/api/accounting/vouchers' && method === 'GET') {
      const period = url.searchParams.get('financial_year') || 'FY2026-27';
      const status = url.searchParams.get('status');
      const conditions = ['financial_year = ?'];
      const params: string[] = [period];
      if (status && ['Draft', 'Posted', 'Cancelled'].includes(status)) {
        conditions.push('status = ?');
        params.push(status);
      }
      const result = await env.DB.prepare(
        `SELECT * FROM accounting_vouchers WHERE ${conditions.join(' AND ')} ORDER BY voucher_date DESC, created_at DESC LIMIT 500`
      ).bind(...params).all();
      return response({ success: true, vouchers: result.results });
    }

    if (path === '/api/accounting/trial-balance' && method === 'GET') {
      const period = url.searchParams.get('financial_year') || 'FY2026-27';
      const asOf = url.searchParams.get('as_of');
      if (asOf && !isDate(asOf)) return fail('as_of must be a valid YYYY-MM-DD date.', 422);
      const result = await env.DB.prepare(`
        SELECT a.id, a.account_code, a.name, a.parent_account_id, a.account_type,
          COALESCE(SUM(CASE WHEN v.status = 'Posted' THEN l.debit_paise ELSE 0 END), 0) AS debit_paise,
          COALESCE(SUM(CASE WHEN v.status = 'Posted' THEN l.credit_paise ELSE 0 END), 0) AS credit_paise
        FROM ledger_accounts a
        LEFT JOIN accounting_voucher_lines l ON l.account_id = a.id
        LEFT JOIN accounting_vouchers v ON v.id = l.voucher_id
          AND v.financial_year = ? AND v.status = 'Posted'
          AND (? IS NULL OR date(v.voucher_date) <= date(?))
        WHERE a.is_group = 0
        GROUP BY a.id, a.account_code, a.name, a.parent_account_id, a.account_type
        ORDER BY a.account_code
      `).bind(period, asOf || null, asOf || null).all();
      const rows = result.results as Array<{ debit_paise: number; credit_paise: number }>;
      const totalDebit = rows.reduce((sum, row) => sum + Number(row.debit_paise || 0), 0);
      const totalCredit = rows.reduce((sum, row) => sum + Number(row.credit_paise || 0), 0);
      return response({
        success: true,
        financial_year: period,
        as_of: asOf || null,
        accounts: result.results,
        total_debit_paise: totalDebit,
        total_credit_paise: totalCredit,
        is_balanced: totalDebit === totalCredit,
        note: 'Only posted vouchers are included. Opening balances must be entered and reconciled before relying on financial statements.',
      });
    }

    if (path === '/api/accounting/vouchers' && method === 'POST') {
      const body = await request.json() as Record<string, any>;
      const types = ['OPENING', 'SALES', 'PURCHASE', 'RECEIPT', 'PAYMENT', 'JOURNAL', 'CONTRA', 'CREDIT_NOTE', 'DEBIT_NOTE', 'REVERSAL'];
      const voucherType = text(body.voucher_type, 30);
      const voucherDate = body.voucher_date;
      const financialYear = text(body.financial_year, 30) || 'FY2026-27';
      const lines = body.lines;
      if (!voucherType || !types.includes(voucherType)) return fail('Valid voucher_type is required.', 422);
      if (!isDate(voucherDate)) return fail('voucher_date must be a valid YYYY-MM-DD date.', 422);
      if (!Array.isArray(lines) || lines.length < 2 || lines.length > 200) return fail('A voucher requires between 2 and 200 lines.', 422);

      const period = await env.DB.prepare(
        'SELECT * FROM accounting_periods WHERE id = ? AND status = \'Open\''
      ).bind(financialYear).first<any>();
      if (!period || voucherDate < period.start_date || voucherDate > period.end_date) {
        return fail('Voucher date must fall within the selected open financial year.', 422);
      }

      let debitTotal = 0;
      let creditTotal = 0;
      const normalized: Array<{ account_id: string; customer_id: string | null; supplier_id: string | null; description: string | null; debit_paise: number; credit_paise: number }> = [];
      for (const [index, line] of lines.entries()) {
        const accountId = text(line?.account_id, 100);
        const debit = Number(line?.debit_paise ?? 0);
        const credit = Number(line?.credit_paise ?? 0);
        if (!accountId || !Number.isSafeInteger(debit) || !Number.isSafeInteger(credit) ||
            debit < 0 || credit < 0 || (debit > 0) === (credit > 0)) {
          return fail(`Line ${index + 1}: select an account and enter a positive debit or credit amount (not both).`, 422);
        }
        const account = await env.DB.prepare(
          'SELECT account_code, is_group, is_active FROM ledger_accounts WHERE id = ?'
        ).bind(accountId).first<any>();
        if (!account || account.is_active !== 1 || account.is_group === 1) {
          return fail(`Line ${index + 1}: selected account is unavailable or is a group account.`, 422);
        }
        const customerId = text(line.customer_id, 100);
        const supplierId = text(line.supplier_id, 100);
        if (account.account_code === '1130' && (!customerId || supplierId)) return fail(`Line ${index + 1}: choose a customer for Sundry Debtors.`, 422);
        if (account.account_code === '2110' && (!supplierId || customerId)) return fail(`Line ${index + 1}: choose a supplier for Sundry Creditors.`, 422);
        if (!['1130', '2110'].includes(account.account_code) && (customerId || supplierId)) {
          return fail(`Line ${index + 1}: party details are not valid for this account.`, 422);
        }
        debitTotal += debit;
        creditTotal += credit;
        if (!Number.isSafeInteger(debitTotal) || !Number.isSafeInteger(creditTotal)) return fail('Voucher amount exceeds the supported integer range.', 422);
        normalized.push({
          account_id: accountId, customer_id: customerId, supplier_id: supplierId,
          description: text(line.description, 500), debit_paise: debit, credit_paise: credit,
        });
      }
      if (debitTotal <= 0 || debitTotal !== creditTotal) return fail('Voucher is not balanced. Total debit and total credit must be equal and greater than zero.', 422);

      const id = `vch-${crypto.randomUUID()}`;
      const voucherNumber = `DRAFT-${voucherType}-${voucherDate.replace(/-/g, '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const actor = await getActor(request, env);
      const statements = [
        env.DB.prepare(`
          INSERT INTO accounting_vouchers (
            id, voucher_number, voucher_type, voucher_date, financial_year,
            status, narration, source_type, source_id, created_by
          ) VALUES (?, ?, ?, ?, ?, 'Draft', ?, ?, ?, ?)
        `).bind(
          id, voucherNumber, voucherType, voucherDate, financialYear,
          text(body.narration, 1000), text(body.source_type, 60), text(body.source_id, 120), actor
        ),
        ...normalized.map((line, index) => env.DB.prepare(`
          INSERT INTO accounting_voucher_lines (
            id, voucher_id, line_number, account_id, customer_id, supplier_id,
            description, debit_paise, credit_paise
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          `vln-${crypto.randomUUID()}`, id, index + 1, line.account_id,
          line.customer_id, line.supplier_id, line.description,
          line.debit_paise, line.credit_paise
        )),
        env.DB.prepare(`
          INSERT INTO accounting_audit_logs (id, voucher_id, action, actor, details_json)
          VALUES (?, ?, 'VOUCHER_DRAFT_CREATED', ?, ?)
        `).bind(`acal-${crypto.randomUUID()}`, id, actor, JSON.stringify({ voucher_type: voucherType, voucher_date: voucherDate, debit_total_paise: debitTotal, credit_total_paise: creditTotal })),
      ];
      await env.DB.batch(statements);
      const voucher = await env.DB.prepare('SELECT * FROM accounting_vouchers WHERE id = ?').bind(id).first();
      return response({ success: true, voucher }, 201);
    }

    const postMatch = path.match(/^\/api\/accounting\/vouchers\/([^/]+)\/post$/);
    if (postMatch && method === 'POST') {
      const voucherId = decodeURIComponent(postMatch[1]);
      const actor = await getActor(request, env);
      const voucher = await env.DB.prepare('SELECT * FROM accounting_vouchers WHERE id = ?').bind(voucherId).first<any>();
      if (!voucher) return fail('Voucher not found.', 404);
      if (voucher.status !== 'Draft') return fail(`Only Draft vouchers can be posted. Current status: ${voucher.status}.`, 409);
      // D1 batch is atomic: the audit row is inserted only if this UPDATE
      // actually changed the Draft voucher to Posted.
      const postBatch = await env.DB.batch([
        env.DB.prepare(`
          UPDATE accounting_vouchers
          SET status = 'Posted', posted_by = ?, posted_at = datetime('now'), updated_at = datetime('now')
          WHERE id = ? AND status = 'Draft'
        `).bind(actor, voucherId),
        env.DB.prepare(`
          INSERT INTO accounting_audit_logs (id, voucher_id, action, actor, details_json)
          SELECT ?, ?, 'VOUCHER_POSTED', ?, ?
          WHERE changes() > 0
        `).bind(`acal-${crypto.randomUUID()}`, voucherId, actor, JSON.stringify({ voucher_number: voucher.voucher_number })),
      ]);
      if (!Number(postBatch[0]?.meta?.changes || 0)) return fail('Voucher status changed before posting. Refresh and try again.', 409);
      const posted = await env.DB.prepare('SELECT * FROM accounting_vouchers WHERE id = ?').bind(voucherId).first();
      return response({ success: true, voucher: posted });
    }

    const voucherMatch = path.match(/^\/api\/accounting\/vouchers\/([^/]+)$/);
    if (voucherMatch && method === 'GET') {
      const voucherId = decodeURIComponent(voucherMatch[1]);
      const voucher = await env.DB.prepare('SELECT * FROM accounting_vouchers WHERE id = ?').bind(voucherId).first();
      if (!voucher) return fail('Voucher not found.', 404);
      const lines = await env.DB.prepare(`
        SELECT l.*, a.account_code, a.name AS account_name
        FROM accounting_voucher_lines l
        JOIN ledger_accounts a ON a.id = l.account_id
        WHERE l.voucher_id = ? ORDER BY l.line_number
      `).bind(voucherId).all();
      return response({ success: true, voucher, lines: lines.results });
    }

    return fail('Accounting endpoint not found.', 404);
  } catch (error) {
    return fail(accountingError(error), 400);
  }
}
