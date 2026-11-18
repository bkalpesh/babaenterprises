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
  if (raw.includes('ERR_ACCOUNTING_ACCOUNT_INACTIVE')) return 'Voucher contains an inactive or non-postable ledger account.';
  if (raw.includes('ERR_ACCOUNTING_CUSTOMER_INACTIVE')) return 'Voucher contains an inactive customer. Select an active customer.';
  if (raw.includes('ERR_ACCOUNTING_SUPPLIER_INACTIVE')) return 'Voucher contains an inactive supplier. Select an active supplier.';
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

    if (path === '/api/accounting/parties' && method === 'GET') {
      const [customers, suppliers] = await Promise.all([
        env.DB.prepare("SELECT id, legal_name, trade_name FROM customers WHERE is_active = 1 ORDER BY legal_name").all(),
        env.DB.prepare("SELECT id, legal_name, trade_name FROM suppliers WHERE is_active = 1 ORDER BY legal_name").all(),
      ]);
      return response({ success: true, customers: customers.results, suppliers: suppliers.results });
    }

    if (path === '/api/accounting/customer-outstandings' && method === 'GET') {
      const financialYear = url.searchParams.get('financial_year') || 'FY2026-27';
      const period = await env.DB.prepare("SELECT id FROM accounting_periods WHERE id = ?").bind(financialYear).first<any>();
      if (!period) return fail('Financial year not found.', 404);
      const result = await env.DB.prepare(`
        SELECT c.id AS customer_id, c.legal_name, c.trade_name,
          COALESCE(SUM(CASE WHEN v.status = 'Posted' THEN l.debit_paise - l.credit_paise ELSE 0 END), 0) AS outstanding_paise
        FROM customers c
        LEFT JOIN accounting_voucher_lines l
          ON l.customer_id = c.id
          AND l.account_id = (SELECT id FROM ledger_accounts WHERE account_code = '1130')
        LEFT JOIN accounting_vouchers v
          ON v.id = l.voucher_id AND v.financial_year = ? AND v.status = 'Posted'
        WHERE c.is_active = 1
        GROUP BY c.id, c.legal_name, c.trade_name
        HAVING COALESCE(SUM(CASE WHEN v.status = 'Posted' THEN l.debit_paise - l.credit_paise ELSE 0 END), 0) > 0
        ORDER BY c.legal_name
      `).bind(financialYear).all();
      return response({ success: true, financial_year: financialYear, customers: result.results });
    }

    if (path === '/api/accounting/bank-accounts' && method === 'POST') {
      const body = await request.json() as Record<string, unknown>;
      const name = text(body.name, 120);
      if (!name || name.length < 3) return fail('Enter a bank name and account type or nickname.', 422);

      // Create the bank ledger and its audit event in one atomic D1 batch.
      // The single INSERT...SELECT allocates the next child code under 1120.
      const id = `acc-bank-${crypto.randomUUID()}`;
      const actor = await getActor(request, env);
      await env.DB.batch([
        env.DB.prepare(`
          INSERT INTO ledger_accounts (
            id, account_code, name, parent_account_id, account_type,
            normal_balance, is_group, is_control_account, system_managed, is_active
          )
          SELECT ?, CAST(COALESCE(MAX(CAST(account_code AS INTEGER)), 1120) + 1 AS TEXT),
            ?, 'acc-1120', 'Asset', 'Debit', 0, 0, 0, 1
          FROM ledger_accounts
          WHERE parent_account_id = 'acc-1120'
            AND account_code GLOB '[0-9]*'
        `).bind(id, name),
        env.DB.prepare(`
          INSERT INTO accounting_audit_logs (id, action, actor, details_json)
          VALUES (?, 'BANK_LEDGER_CREATED', ?, ?)
        `).bind(
          `acal-${crypto.randomUUID()}`, actor,
          JSON.stringify({ account_id: id, account_name: name })
        ),
      ]);

      const account = await env.DB.prepare(
        'SELECT id, account_code, name, parent_account_id, account_type, normal_balance, is_group, is_control_account, system_managed, is_active FROM ledger_accounts WHERE id = ?'
      ).bind(id).first();
      if (!account) return fail('Bank ledger could not be created. Confirm the Bank Accounts group exists.', 409);
      return response({ success: true, account }, 201);
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

    if (path === '/api/accounting/sales-invoices' && method === 'GET') {
      const periodId = url.searchParams.get('financial_year') || 'FY2026-27';
      const period = await env.DB.prepare(
        "SELECT id, name, start_date, end_date, status FROM accounting_periods WHERE id = ?"
      ).bind(periodId).first<any>();
      if (!period) return fail('Financial year not found.', 404);
      const invoiceYear = String(periodId).replace(/^FY/, '');
      const result = await env.DB.prepare(`
        SELECT i.id, i.invoice_number, i.invoice_date, i.financial_year,
          i.customer_id, i.buyer_name, i.buyer_trade_name, i.status,
          i.taxable_amount_paise, i.cgst_amount_paise, i.sgst_amount_paise,
          i.igst_amount_paise, i.total_tax_paise, i.round_off_paise,
          i.total_invoice_amount_paise, c.is_active AS customer_active,
          v.id AS linked_voucher_id, v.voucher_number AS linked_voucher_number
        FROM invoices i
        LEFT JOIN customers c ON c.id = i.customer_id
        LEFT JOIN accounting_vouchers v ON v.source_type = 'INVOICE' AND v.source_id = i.id
        WHERE i.status = 'Issued' AND i.financial_year = ?
          AND i.invoice_date >= ? AND i.invoice_date <= ?
        ORDER BY i.invoice_date DESC, i.invoice_number DESC
      `).bind(invoiceYear, period.start_date, period.end_date).all();
      return response({ success: true, invoices: result.results });
    }

    const importInvoiceMatch = path.match(/^\/api\/accounting\/sales-invoices\/([^/]+)\/import$/);
    if (importInvoiceMatch && method === 'POST') {
      const invoiceId = decodeURIComponent(importInvoiceMatch[1]);
      const invoice = await env.DB.prepare(`
        SELECT i.*, c.is_active AS customer_active
        FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id
        WHERE i.id = ?
      `).bind(invoiceId).first<any>();
      if (!invoice) return fail('Sales invoice not found.', 404);
      if (invoice.status !== 'Issued') return fail('Only Issued invoices can be imported.', 409);
      if (!invoice.customer_id || invoice.customer_active !== 1) return fail('The invoice customer is missing or inactive. Correct the customer record before importing.', 422);
      if (!isDate(invoice.invoice_date)) return fail('Invoice date is invalid.', 422);

      const period = await env.DB.prepare(`
        SELECT * FROM accounting_periods
        WHERE status = 'Open' AND start_date <= ? AND end_date >= ?
        ORDER BY start_date DESC LIMIT 1
      `).bind(invoice.invoice_date, invoice.invoice_date).first<any>();
      if (!period) return fail('No open accounting period covers this invoice date.', 422);

      const taxable = Number(invoice.taxable_amount_paise);
      const cgst = Number(invoice.cgst_amount_paise);
      const sgst = Number(invoice.sgst_amount_paise);
      const igst = Number(invoice.igst_amount_paise);
      const totalTax = Number(invoice.total_tax_paise);
      const roundOff = Number(invoice.round_off_paise);
      const invoiceTotal = Number(invoice.total_invoice_amount_paise);
      const amounts = [taxable, cgst, sgst, igst, totalTax, roundOff, invoiceTotal];
      if (!amounts.every(Number.isSafeInteger) || taxable < 0 || cgst < 0 || sgst < 0 || igst < 0 ||
          totalTax < 0 || invoiceTotal <= 0 || totalTax !== cgst + sgst + igst ||
          invoiceTotal !== taxable + totalTax + roundOff ||
          (invoice.is_interstate === 1 ? (cgst !== 0 || sgst !== 0) : igst !== 0)) {
        return fail('Invoice totals failed accounting validation. No voucher was created.', 422);
      }

      const existing = await env.DB.prepare(
        "SELECT id, voucher_number FROM accounting_vouchers WHERE source_type = 'INVOICE' AND source_id = ?"
      ).bind(invoiceId).first<any>();
      if (existing) return fail('This invoice has already been imported as voucher ' + existing.voucher_number + '.', 409);

      const requiredCodes = ['1130', '4000', '5600', ...(cgst ? ['2120'] : []), ...(sgst ? ['2130'] : []), ...(igst ? ['2140'] : [])];
      const ledgerResult = await env.DB.prepare(
        `SELECT id, account_code, name, is_group, is_active FROM ledger_accounts WHERE account_code IN (${requiredCodes.map(() => '?').join(',')})`
      ).bind(...requiredCodes).all();
      const ledgers = new Map((ledgerResult.results as any[]).map(account => [String(account.account_code), account]));
      for (const code of requiredCodes) {
        const account = ledgers.get(code);
        if (!account || account.is_active !== 1 || account.is_group === 1) {
          return fail('Required ledger account ' + code + ' is missing, inactive or not postable.', 422);
        }
      }

      const debtor = ledgers.get('1130');
      const sales = ledgers.get('4000');
      const roundLedger = ledgers.get('5600');
      const voucherLines: Array<{ account_id: string; customer_id: string | null; description: string; debit_paise: number; credit_paise: number }> = [];
      voucherLines.push({ account_id: debtor.id, customer_id: invoice.customer_id, description: 'Accounts receivable — ' + (invoice.buyer_trade_name || invoice.buyer_name || invoice.invoice_number), debit_paise: invoiceTotal, credit_paise: 0 });
      if (taxable) voucherLines.push({ account_id: sales.id, customer_id: null, description: 'Sales — ' + invoice.invoice_number, debit_paise: 0, credit_paise: taxable });
      for (const [code, amount, label] of [['2120', cgst, 'Output CGST'], ['2130', sgst, 'Output SGST'], ['2140', igst, 'Output IGST']] as Array<[string, number, string]>) {
        if (amount) voucherLines.push({ account_id: ledgers.get(code).id, customer_id: null, description: label + ' — ' + invoice.invoice_number, debit_paise: 0, credit_paise: amount });
      }
      if (roundOff < 0) voucherLines.push({ account_id: roundLedger.id, customer_id: null, description: 'Round-off — ' + invoice.invoice_number, debit_paise: Math.abs(roundOff), credit_paise: 0 });
      if (roundOff > 0) voucherLines.push({ account_id: roundLedger.id, customer_id: null, description: 'Round-off — ' + invoice.invoice_number, debit_paise: 0, credit_paise: roundOff });

      const debitTotal = voucherLines.reduce((sum, line) => sum + line.debit_paise, 0);
      const creditTotal = voucherLines.reduce((sum, line) => sum + line.credit_paise, 0);
      if (debitTotal <= 0 || debitTotal !== creditTotal || !Number.isSafeInteger(debitTotal)) {
        return fail('Generated sales voucher did not balance. No voucher was created.', 422);
      }

      const id = `vch-${crypto.randomUUID()}`;
      const voucherNumber = `DRAFT-SALES-${invoice.invoice_date.replace(/-/g, '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const actor = await getActor(request, env);
      await env.DB.batch([
        env.DB.prepare(`
          INSERT INTO accounting_vouchers (
            id, voucher_number, voucher_type, voucher_date, financial_year,
            status, narration, source_type, source_id, created_by
          ) VALUES (?, ?, 'SALES', ?, ?, 'Draft', ?, 'INVOICE', ?, ?)
        `).bind(id, voucherNumber, invoice.invoice_date, period.id, 'Imported from issued sales invoice ' + invoice.invoice_number, invoice.id, actor),
        ...voucherLines.map((line, index) => env.DB.prepare(`
          INSERT INTO accounting_voucher_lines (
            id, voucher_id, line_number, account_id, customer_id, supplier_id,
            description, debit_paise, credit_paise
          ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)
        `).bind(`vln-${crypto.randomUUID()}`, id, index + 1, line.account_id, line.customer_id, line.description, line.debit_paise, line.credit_paise)),
        env.DB.prepare(`
          INSERT INTO accounting_audit_logs (id, voucher_id, action, actor, details_json)
          VALUES (?, ?, 'VOUCHER_DRAFT_CREATED', ?, ?)
        `).bind(`acal-${crypto.randomUUID()}`, id, actor, JSON.stringify({
          source_type: 'INVOICE', invoice_id: invoice.id, invoice_number: invoice.invoice_number,
          debit_total_paise: debitTotal, credit_total_paise: creditTotal,
        })),
      ]);
      const voucher = await env.DB.prepare('SELECT * FROM accounting_vouchers WHERE id = ?').bind(id).first();
      return response({ success: true, voucher, debit_total_paise: debitTotal, credit_total_paise: creditTotal }, 201);
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
        WITH account_movements AS (
          SELECT a.id, a.account_code, a.name, a.parent_account_id, a.account_type,
            COALESCE(SUM(CASE WHEN v.status = 'Posted' THEN l.debit_paise ELSE 0 END), 0) AS total_debit_paise,
            COALESCE(SUM(CASE WHEN v.status = 'Posted' THEN l.credit_paise ELSE 0 END), 0) AS total_credit_paise
          FROM ledger_accounts a
          LEFT JOIN accounting_voucher_lines l ON l.account_id = a.id
          LEFT JOIN accounting_vouchers v ON v.id = l.voucher_id
            AND v.financial_year = ? AND v.status = 'Posted'
            AND (? IS NULL OR date(v.voucher_date) <= date(?))
          WHERE a.is_group = 0
          GROUP BY a.id, a.account_code, a.name, a.parent_account_id, a.account_type
        )
        SELECT id, account_code, name, parent_account_id, account_type,
          CASE WHEN total_debit_paise > total_credit_paise
            THEN total_debit_paise - total_credit_paise ELSE 0 END AS debit_paise,
          CASE WHEN total_credit_paise > total_debit_paise
            THEN total_credit_paise - total_debit_paise ELSE 0 END AS credit_paise
        FROM account_movements
        ORDER BY account_code
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
        note: 'Net posted account balances only. This financial year starts with zero opening balances.',
      });
    }

    if (path === '/api/accounting/vouchers' && method === 'POST') {
      const body = await request.json() as Record<string, any>;
      // Journal and customer Receipt drafts are enabled. Receipts use a strict
      // Cash/Bank debit and Sundry Debtors credit structure.
      const types = ['JOURNAL', 'RECEIPT'];
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
          'SELECT account_code, parent_account_id, is_group, is_active FROM ledger_accounts WHERE id = ?'
        ).bind(accountId).first<any>();
        if (!account || account.is_active !== 1 || account.is_group === 1) {
          return fail(`Line ${index + 1}: selected account is unavailable or is a group account.`, 422);
        }
        const customerId = text(line.customer_id, 100);
        const supplierId = text(line.supplier_id, 100);
        if (account.account_code === '1130' && (!customerId || supplierId)) return fail(`Line ${index + 1}: choose a customer for Sundry Debtors.`, 422);
        if (account.account_code === '2110' && (!supplierId || customerId)) return fail(`Line ${index + 1}: choose a supplier for Sundry Creditors.`, 422);
        if (customerId) {
          const customer = await env.DB.prepare('SELECT is_active FROM customers WHERE id = ?').bind(customerId).first<any>();
          if (!customer || customer.is_active !== 1) return fail(`Line ${index + 1}: selected customer is unavailable or inactive.`, 422);
        }
        if (supplierId) {
          const supplier = await env.DB.prepare('SELECT is_active FROM suppliers WHERE id = ?').bind(supplierId).first<any>();
          if (!supplier || supplier.is_active !== 1) return fail(`Line ${index + 1}: selected supplier is unavailable or inactive.`, 422);
        }
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

      if (voucherType === 'RECEIPT') {
        if (normalized.length !== 2) return fail('A customer receipt must contain exactly two lines: Cash/Bank debit and Sundry Debtors credit.', 422);
        const debitLine = normalized.find(line => line.debit_paise > 0);
        const creditLine = normalized.find(line => line.credit_paise > 0);
        if (!debitLine || !creditLine || debitLine.debit_paise !== creditLine.credit_paise) {
          return fail('A customer receipt must have equal Cash/Bank debit and customer credit amounts.', 422);
        }
        const [cashBank, debtorAccount] = await Promise.all([
          env.DB.prepare('SELECT account_code, parent_account_id, is_active, is_group FROM ledger_accounts WHERE id = ?').bind(debitLine.account_id).first<any>(),
          env.DB.prepare('SELECT account_code FROM ledger_accounts WHERE id = ?').bind(creditLine.account_id).first<any>(),
        ]);
        if (!cashBank || cashBank.is_active !== 1 || cashBank.is_group === 1 ||
            !(cashBank.account_code === '1110' || cashBank.parent_account_id === 'acc-1120')) {
          return fail('Receipt debit must use Cash in Hand or an active Bank ledger.', 422);
        }
        if (!debtorAccount || debtorAccount.account_code !== '1130' || !creditLine.customer_id) {
          return fail('Receipt credit must use Sundry Debtors with a selected customer.', 422);
        }
        const outstanding = await env.DB.prepare(`
          SELECT COALESCE(SUM(l.debit_paise - l.credit_paise), 0) AS amount
          FROM accounting_voucher_lines l
          JOIN accounting_vouchers v ON v.id = l.voucher_id
          WHERE l.account_id = ? AND l.customer_id = ?
            AND v.financial_year = ? AND v.status = 'Posted'
        `).bind(creditLine.account_id, creditLine.customer_id, financialYear).first<any>();
        const outstandingPaise = Number(outstanding?.amount || 0);
        if (outstandingPaise <= 0) return fail('This customer has no posted outstanding balance in the selected financial year. Post the related sales voucher first, if appropriate.', 422);
        if (debitLine.debit_paise > outstandingPaise) {
          return fail('Receipt exceeds the customer\'s posted outstanding balance of ' + (outstandingPaise / 100).toFixed(2) + '.', 422);
        }
      }

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
      if (voucher.voucher_type === 'RECEIPT') {
        const receiptLine = await env.DB.prepare(`
          SELECT l.account_id, l.customer_id, l.credit_paise
          FROM accounting_voucher_lines l
          JOIN ledger_accounts a ON a.id = l.account_id
          WHERE l.voucher_id = ? AND a.account_code = '1130' AND l.credit_paise > 0
          LIMIT 1
        `).bind(voucherId).first<any>();
        if (!receiptLine?.customer_id || Number(receiptLine.credit_paise) <= 0) {
          return fail('Receipt voucher is missing its customer receivable credit line.', 422);
        }
        const currentBalance = await env.DB.prepare(`
          SELECT COALESCE(SUM(l.debit_paise - l.credit_paise), 0) AS amount
          FROM accounting_voucher_lines l
          JOIN accounting_vouchers v ON v.id = l.voucher_id
          WHERE l.account_id = ? AND l.customer_id = ?
            AND v.financial_year = ? AND v.status = 'Posted'
        `).bind(receiptLine.account_id, receiptLine.customer_id, voucher.financial_year).first<any>();
        const balancePaise = Number(currentBalance?.amount || 0);
        if (Number(receiptLine.credit_paise) > balancePaise) {
          return fail('Receipt cannot be posted because the customer\'s remaining posted balance is only ' + (balancePaise / 100).toFixed(2) + '.', 422);
        }
      }
      // Allocate a sequence only while this voucher is still Draft. D1 batch
      // runs these statements atomically, so concurrent retries cannot consume
      // extra numbers and a failed posting rolls the allocation back.
      const postBatch = await env.DB.batch([
        env.DB.prepare(`
          INSERT INTO accounting_voucher_sequences (financial_year, voucher_type, last_number)
          SELECT financial_year, voucher_type, 1
          FROM accounting_vouchers
          WHERE id = ? AND status = 'Draft'
          ON CONFLICT (financial_year, voucher_type)
          DO UPDATE SET last_number = accounting_voucher_sequences.last_number + 1
        `).bind(voucherId),
        env.DB.prepare(`
          UPDATE accounting_vouchers
          SET voucher_number = (
                SELECT
                  CASE accounting_vouchers.voucher_type
                    WHEN 'OPENING' THEN 'OB'
                    WHEN 'SALES' THEN 'SAL'
                    WHEN 'PURCHASE' THEN 'PUR'
                    WHEN 'RECEIPT' THEN 'REC'
                    WHEN 'PAYMENT' THEN 'PAY'
                    WHEN 'JOURNAL' THEN 'JV'
                    WHEN 'CONTRA' THEN 'CON'
                    WHEN 'CREDIT_NOTE' THEN 'CN'
                    WHEN 'DEBIT_NOTE' THEN 'DN'
                    WHEN 'REVERSAL' THEN 'REV'
                  END || '/' || substr(accounting_vouchers.financial_year, 3) || '/' ||
                  printf('%06d', s.last_number)
                FROM accounting_voucher_sequences s
                WHERE s.financial_year = accounting_vouchers.financial_year
                  AND s.voucher_type = accounting_vouchers.voucher_type
              ),
              status = 'Posted',
              posted_by = ?,
              posted_at = datetime('now'),
              updated_at = datetime('now')
          WHERE id = ? AND status = 'Draft'
            AND EXISTS (
              SELECT 1 FROM accounting_voucher_sequences s
              WHERE s.financial_year = accounting_vouchers.financial_year
                AND s.voucher_type = accounting_vouchers.voucher_type
            )
        `).bind(actor, voucherId),
        env.DB.prepare(`
          INSERT INTO accounting_audit_logs (id, voucher_id, action, actor, details_json)
          SELECT ?, v.id, 'VOUCHER_POSTED', ?, json_object('voucher_number', v.voucher_number)
          FROM accounting_vouchers v
          WHERE v.id = ? AND v.status = 'Posted' AND changes() > 0
        `).bind(`acal-${crypto.randomUUID()}`, actor, voucherId),
      ]);
      if (!Number(postBatch[1]?.meta?.changes || 0)) return fail('Voucher status changed before posting. Refresh and try again.', 409);
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
