-- BABA ENTERPRISES
-- Migration 0011: Accounting foundation
-- Scope: schema and standard account setup only. No existing invoices or balances are posted.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS accounting_periods (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Closed')),
  opening_balance_status TEXT NOT NULL DEFAULT 'Not Started'
    CHECK (opening_balance_status IN ('Not Started', 'In Progress', 'Reconciled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (date(start_date) IS NOT NULL AND date(end_date) IS NOT NULL),
  CHECK (date(start_date) <= date(end_date))
);

INSERT OR IGNORE INTO accounting_periods
  (id, name, start_date, end_date, status, opening_balance_status)
VALUES
  ('FY2026-27', 'FY 2026-27', '2026-04-01', '2027-03-31', 'Open', 'Not Started');

CREATE TABLE IF NOT EXISTS ledger_accounts (
  id TEXT PRIMARY KEY,
  account_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  parent_account_id TEXT,
  account_type TEXT NOT NULL CHECK (account_type IN ('Asset', 'Liability', 'Equity', 'Income', 'Expense')),
  normal_balance TEXT NOT NULL CHECK (normal_balance IN ('Debit', 'Credit')),
  is_group INTEGER NOT NULL DEFAULT 0 CHECK (is_group IN (0, 1)),
  is_control_account INTEGER NOT NULL DEFAULT 0 CHECK (is_control_account IN (0, 1)),
  system_managed INTEGER NOT NULL DEFAULT 0 CHECK (system_managed IN (0, 1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (parent_account_id) REFERENCES ledger_accounts(id),
  CHECK (is_group = 0 OR is_control_account = 0)
);

CREATE INDEX IF NOT EXISTS idx_ledger_accounts_parent ON ledger_accounts(parent_account_id);
CREATE INDEX IF NOT EXISTS idx_ledger_accounts_type ON ledger_accounts(account_type, is_active);

-- Seeded account IDs are stable and make the migration safely repeatable.
INSERT OR IGNORE INTO ledger_accounts
  (id, account_code, name, parent_account_id, account_type, normal_balance, is_group, is_control_account, system_managed)
VALUES
  ('acc-1000', '1000', 'Assets', NULL, 'Asset', 'Debit', 1, 0, 1),
  ('acc-1100', '1100', 'Current Assets', 'acc-1000', 'Asset', 'Debit', 1, 0, 1),
  ('acc-1110', '1110', 'Cash in Hand', 'acc-1100', 'Asset', 'Debit', 0, 0, 1),
  ('acc-1120', '1120', 'Bank Accounts', 'acc-1100', 'Asset', 'Debit', 1, 0, 1),
  ('acc-1130', '1130', 'Sundry Debtors', 'acc-1100', 'Asset', 'Debit', 0, 1, 1),
  ('acc-1140', '1140', 'Input CGST', 'acc-1100', 'Asset', 'Debit', 0, 0, 1),
  ('acc-1150', '1150', 'Input SGST', 'acc-1100', 'Asset', 'Debit', 0, 0, 1),
  ('acc-1160', '1160', 'Input IGST', 'acc-1100', 'Asset', 'Debit', 0, 0, 1),
  ('acc-1170', '1170', 'Inventory', 'acc-1100', 'Asset', 'Debit', 0, 0, 1),
  ('acc-1200', '1200', 'Fixed Assets', 'acc-1000', 'Asset', 'Debit', 1, 0, 1),
  ('acc-2000', '2000', 'Liabilities', NULL, 'Liability', 'Credit', 1, 0, 1),
  ('acc-2100', '2100', 'Current Liabilities', 'acc-2000', 'Liability', 'Credit', 1, 0, 1),
  ('acc-2110', '2110', 'Sundry Creditors', 'acc-2100', 'Liability', 'Credit', 0, 1, 1),
  ('acc-2120', '2120', 'Output CGST', 'acc-2100', 'Liability', 'Credit', 0, 0, 1),
  ('acc-2130', '2130', 'Output SGST', 'acc-2100', 'Liability', 'Credit', 0, 0, 1),
  ('acc-2140', '2140', 'Output IGST', 'acc-2100', 'Liability', 'Credit', 0, 0, 1),
  ('acc-2200', '2200', 'Loans', 'acc-2000', 'Liability', 'Credit', 1, 0, 1),
  ('acc-3000', '3000', 'Capital and Equity', NULL, 'Equity', 'Credit', 1, 0, 1),
  ('acc-3100', '3100', 'Opening Balance Equity / Retained Earnings', 'acc-3000', 'Equity', 'Credit', 0, 0, 1),
  ('acc-4000', '4000', 'Sales', NULL, 'Income', 'Credit', 0, 0, 1),
  ('acc-4100', '4100', 'Sales Returns', NULL, 'Income', 'Debit', 0, 0, 1),
  ('acc-4200', '4200', 'Other Income', NULL, 'Income', 'Credit', 0, 0, 1),
  ('acc-5000', '5000', 'Purchases', NULL, 'Expense', 'Debit', 0, 0, 1),
  ('acc-5100', '5100', 'Purchase Returns', NULL, 'Expense', 'Credit', 0, 0, 1),
  ('acc-5200', '5200', 'Direct Expenses', NULL, 'Expense', 'Debit', 1, 0, 1),
  ('acc-5300', '5300', 'Indirect Expenses', NULL, 'Expense', 'Debit', 1, 0, 1),
  ('acc-5400', '5400', 'Bank Charges', 'acc-5300', 'Expense', 'Debit', 0, 0, 1),
  ('acc-5500', '5500', 'Depreciation', 'acc-5300', 'Expense', 'Debit', 0, 0, 1);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  supplier_code TEXT NOT NULL UNIQUE,
  legal_name TEXT NOT NULL,
  trade_name TEXT,
  gstin TEXT,
  registration_type TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  state_code TEXT,
  pincode TEXT,
  contact_person TEXT,
  email TEXT,
  mobile TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_gstin_unique
  ON suppliers(gstin) WHERE gstin IS NOT NULL AND trim(gstin) <> '';
CREATE INDEX IF NOT EXISTS idx_suppliers_legal_name ON suppliers(legal_name);
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(is_active);

CREATE TABLE IF NOT EXISTS accounting_vouchers (
  id TEXT PRIMARY KEY,
  voucher_number TEXT NOT NULL UNIQUE,
  voucher_type TEXT NOT NULL CHECK (voucher_type IN (
    'OPENING', 'SALES', 'PURCHASE', 'RECEIPT', 'PAYMENT',
    'JOURNAL', 'CONTRA', 'CREDIT_NOTE', 'DEBIT_NOTE', 'REVERSAL'
  )),
  voucher_date TEXT NOT NULL,
  financial_year TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Posted', 'Cancelled')),
  narration TEXT,
  source_type TEXT,
  source_id TEXT,
  reversal_of_id TEXT,
  created_by TEXT,
  posted_by TEXT,
  posted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (financial_year) REFERENCES accounting_periods(id),
  FOREIGN KEY (reversal_of_id) REFERENCES accounting_vouchers(id),
  CHECK (date(voucher_date) IS NOT NULL),
  CHECK ((source_type IS NULL AND source_id IS NULL) OR
         (source_type IS NOT NULL AND source_id IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_voucher_source_unique
  ON accounting_vouchers(source_type, source_id)
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accounting_vouchers_date ON accounting_vouchers(voucher_date);
CREATE INDEX IF NOT EXISTS idx_accounting_vouchers_period ON accounting_vouchers(financial_year, status);
CREATE INDEX IF NOT EXISTS idx_accounting_vouchers_type ON accounting_vouchers(voucher_type, voucher_date);

CREATE TABLE IF NOT EXISTS accounting_voucher_lines (
  id TEXT PRIMARY KEY,
  voucher_id TEXT NOT NULL,
  line_number INTEGER NOT NULL CHECK (line_number > 0),
  account_id TEXT NOT NULL,
  customer_id TEXT,
  supplier_id TEXT,
  description TEXT,
  debit_paise INTEGER NOT NULL DEFAULT 0 CHECK (debit_paise >= 0),
  credit_paise INTEGER NOT NULL DEFAULT 0 CHECK (credit_paise >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (voucher_id) REFERENCES accounting_vouchers(id),
  FOREIGN KEY (account_id) REFERENCES ledger_accounts(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  UNIQUE (voucher_id, line_number),
  CHECK ((debit_paise > 0 AND credit_paise = 0) OR
         (credit_paise > 0 AND debit_paise = 0)),
  CHECK (customer_id IS NULL OR supplier_id IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_accounting_lines_voucher ON accounting_voucher_lines(voucher_id, line_number);
CREATE INDEX IF NOT EXISTS idx_accounting_lines_account ON accounting_voucher_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_accounting_lines_customer ON accounting_voucher_lines(customer_id);
CREATE INDEX IF NOT EXISTS idx_accounting_lines_supplier ON accounting_voucher_lines(supplier_id);

CREATE TABLE IF NOT EXISTS accounting_audit_logs (
  id TEXT PRIMARY KEY,
  voucher_id TEXT,
  action TEXT NOT NULL,
  actor TEXT,
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (voucher_id) REFERENCES accounting_vouchers(id)
);

CREATE INDEX IF NOT EXISTS idx_accounting_audit_voucher ON accounting_audit_logs(voucher_id, created_at);

-- A posted voucher is immutable. Corrections must be made with a separate reversal voucher.
CREATE TRIGGER IF NOT EXISTS trg_accounting_voucher_immutable_update
BEFORE UPDATE ON accounting_vouchers
WHEN OLD.status IN ('Posted', 'Cancelled')
BEGIN
  SELECT RAISE(ABORT, 'Posted or cancelled accounting vouchers are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_accounting_voucher_immutable_delete
BEFORE DELETE ON accounting_vouchers
WHEN OLD.status IN ('Posted', 'Cancelled')
BEGIN
  SELECT RAISE(ABORT, 'Posted or cancelled accounting vouchers cannot be deleted');
END;

CREATE TRIGGER IF NOT EXISTS trg_accounting_line_no_insert_posted
BEFORE INSERT ON accounting_voucher_lines
WHEN (SELECT status FROM accounting_vouchers WHERE id = NEW.voucher_id) IN ('Posted', 'Cancelled')
BEGIN
  SELECT RAISE(ABORT, 'Cannot add lines to a posted or cancelled voucher');
END;

CREATE TRIGGER IF NOT EXISTS trg_accounting_line_no_update_posted
BEFORE UPDATE ON accounting_voucher_lines
WHEN (SELECT status FROM accounting_vouchers WHERE id = OLD.voucher_id) IN ('Posted', 'Cancelled')
  OR (SELECT status FROM accounting_vouchers WHERE id = NEW.voucher_id) IN ('Posted', 'Cancelled')
BEGIN
  SELECT RAISE(ABORT, 'Cannot modify lines of a posted or cancelled voucher');
END;

CREATE TRIGGER IF NOT EXISTS trg_accounting_line_no_delete_posted
BEFORE DELETE ON accounting_voucher_lines
WHEN (SELECT status FROM accounting_vouchers WHERE id = OLD.voucher_id) IN ('Posted', 'Cancelled')
BEGIN
  SELECT RAISE(ABORT, 'Cannot delete lines of a posted or cancelled voucher');
END;

CREATE TRIGGER IF NOT EXISTS trg_accounting_audit_no_update
BEFORE UPDATE ON accounting_audit_logs
BEGIN
  SELECT RAISE(ABORT, 'Accounting audit logs are append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_accounting_audit_no_delete
BEFORE DELETE ON accounting_audit_logs
BEGIN
  SELECT RAISE(ABORT, 'Accounting audit logs cannot be deleted');
END;


-- Enforce balanced, in-period posting at the database boundary, not only in the API.
CREATE TRIGGER IF NOT EXISTS trg_accounting_voucher_validate_post
BEFORE UPDATE OF status ON accounting_vouchers
WHEN OLD.status = 'Draft' AND NEW.status = 'Posted'
BEGIN
  SELECT CASE
    WHEN (SELECT COUNT(*) FROM accounting_voucher_lines WHERE voucher_id = NEW.id) < 2
    THEN RAISE(ABORT, 'ERR_ACCOUNTING_MINIMUM_LINES')
  END;
  SELECT CASE
    WHEN (SELECT COALESCE(SUM(debit_paise), 0) FROM accounting_voucher_lines WHERE voucher_id = NEW.id)
       <= 0
    THEN RAISE(ABORT, 'ERR_ACCOUNTING_ZERO_VALUE')
  END;
  SELECT CASE
    WHEN (SELECT COALESCE(SUM(debit_paise), 0) FROM accounting_voucher_lines WHERE voucher_id = NEW.id)
       <> (SELECT COALESCE(SUM(credit_paise), 0) FROM accounting_voucher_lines WHERE voucher_id = NEW.id)
    THEN RAISE(ABORT, 'ERR_ACCOUNTING_UNBALANCED')
  END;
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM accounting_periods p
      WHERE p.id = NEW.financial_year
        AND p.status = 'Open'
        AND date(NEW.voucher_date) BETWEEN date(p.start_date) AND date(p.end_date)
    )
    THEN RAISE(ABORT, 'ERR_ACCOUNTING_PERIOD_INVALID')
  END;
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM accounting_voucher_lines l
      JOIN ledger_accounts a ON a.id = l.account_id
      WHERE l.voucher_id = NEW.id
        AND a.account_code = '1130'
        AND (l.customer_id IS NULL OR l.supplier_id IS NOT NULL)
    )
    THEN RAISE(ABORT, 'ERR_ACCOUNTING_CUSTOMER_REQUIRED')
  END;
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM accounting_voucher_lines l
      JOIN ledger_accounts a ON a.id = l.account_id
      WHERE l.voucher_id = NEW.id
        AND a.account_code = '2110'
        AND (l.supplier_id IS NULL OR l.customer_id IS NOT NULL)
    )
    THEN RAISE(ABORT, 'ERR_ACCOUNTING_SUPPLIER_REQUIRED')
  END;
END;

-- Prevent attaching the wrong party dimension to a control account.
CREATE TRIGGER IF NOT EXISTS trg_accounting_line_party_dimension_insert
BEFORE INSERT ON accounting_voucher_lines
BEGIN
  SELECT CASE
    WHEN (SELECT account_code FROM ledger_accounts WHERE id = NEW.account_id) = '1130'
      AND (NEW.customer_id IS NULL OR NEW.supplier_id IS NOT NULL)
    THEN RAISE(ABORT, 'ERR_ACCOUNTING_CUSTOMER_REQUIRED')
  END;
  SELECT CASE
    WHEN (SELECT account_code FROM ledger_accounts WHERE id = NEW.account_id) = '2110'
      AND (NEW.supplier_id IS NULL OR NEW.customer_id IS NOT NULL)
    THEN RAISE(ABORT, 'ERR_ACCOUNTING_SUPPLIER_REQUIRED')
  END;
  SELECT CASE
    WHEN (SELECT account_code FROM ledger_accounts WHERE id = NEW.account_id) NOT IN ('1130', '2110')
      AND (NEW.customer_id IS NOT NULL OR NEW.supplier_id IS NOT NULL)
    THEN RAISE(ABORT, 'ERR_ACCOUNTING_PARTY_ACCOUNT_MISMATCH')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_accounting_line_party_dimension_update
BEFORE UPDATE ON accounting_voucher_lines
BEGIN
  SELECT CASE
    WHEN (SELECT account_code FROM ledger_accounts WHERE id = NEW.account_id) = '1130'
      AND (NEW.customer_id IS NULL OR NEW.supplier_id IS NOT NULL)
    THEN RAISE(ABORT, 'ERR_ACCOUNTING_CUSTOMER_REQUIRED')
  END;
  SELECT CASE
    WHEN (SELECT account_code FROM ledger_accounts WHERE id = NEW.account_id) = '2110'
      AND (NEW.supplier_id IS NULL OR NEW.customer_id IS NOT NULL)
    THEN RAISE(ABORT, 'ERR_ACCOUNTING_SUPPLIER_REQUIRED')
  END;
  SELECT CASE
    WHEN (SELECT account_code FROM ledger_accounts WHERE id = NEW.account_id) NOT IN ('1130', '2110')
      AND (NEW.customer_id IS NOT NULL OR NEW.supplier_id IS NOT NULL)
    THEN RAISE(ABORT, 'ERR_ACCOUNTING_PARTY_ACCOUNT_MISMATCH')
  END;
END;
