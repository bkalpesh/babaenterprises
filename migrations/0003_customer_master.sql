-- ==============================================================================
-- BABA ENTERPRISES — SAFE ADDITIVE STAGING MIGRATION 0003
-- Purpose: Customer Master, Sequence Log Recovery, and Document Linkage
-- Target Database: babaenterprises-db-staging
-- SAFE & ADDITIVE ONLY: Does not drop, truncate, or reset existing tables or data.
-- Note on Idempotency: Managed sequentially via Cloudflare D1 migration system
-- (d1_migrations table). If executed manually, ALTER TABLE statements should only be
-- executed once per database instance.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Ensure Sequence Log Tables Exist (Safe Recovery if not present in staging)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_sequence_log (
  financial_year TEXT NOT NULL,
  sequence_number INTEGER NOT NULL,
  invoice_id TEXT NOT NULL UNIQUE,
  allocated_at TEXT NOT NULL DEFAULT (datetime('now')),
  allocated_by TEXT NOT NULL DEFAULT 'SYSTEM_STAGING',
  PRIMARY KEY (financial_year, sequence_number),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

CREATE TABLE IF NOT EXISTS quotation_sequence_log (
  financial_year TEXT NOT NULL,
  sequence_number INTEGER NOT NULL,
  quotation_id TEXT NOT NULL UNIQUE,
  allocated_at TEXT NOT NULL DEFAULT (datetime('now')),
  allocated_by TEXT NOT NULL DEFAULT 'SYSTEM_STAGING',
  PRIMARY KEY (financial_year, sequence_number),
  FOREIGN KEY (quotation_id) REFERENCES quotations(id)
);

-- ------------------------------------------------------------------------------
-- 2. Customer Master Table (Dedicated Billing Customer Directory)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  legal_name TEXT NOT NULL,
  trade_name TEXT DEFAULT NULL,
  gstin TEXT DEFAULT NULL,
  gst_registration_type TEXT NOT NULL DEFAULT 'Regular' CHECK (gst_registration_type IN ('Regular', 'Composition', 'Unregistered', 'Consumer', 'Overseas')),
  billing_address TEXT DEFAULT NULL,
  city TEXT DEFAULT NULL,
  state TEXT DEFAULT NULL,
  state_code TEXT NOT NULL CHECK (length(state_code) = 2),
  pincode TEXT DEFAULT NULL,
  country TEXT NOT NULL DEFAULT 'India',
  contact_person TEXT DEFAULT NULL,
  mobile TEXT DEFAULT NULL,
  email TEXT DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (
    pincode IS NULL OR (length(pincode) = 6 AND pincode GLOB '[1-9][0-9][0-9][0-9][0-9][0-9]')
  ),
  CHECK (
    gstin IS NULL OR (
      length(trim(gstin)) = 15 AND
      substr(trim(gstin), 1, 2) = state_code
    )
  )
);

-- Unique constraint on non-null GSTINs (permitting multiple unregistered customers without GSTIN)
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_gstin_unique ON customers(gstin) WHERE gstin IS NOT NULL AND length(trim(gstin)) > 0;
CREATE INDEX IF NOT EXISTS idx_customers_legal_name ON customers(legal_name);
CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers(mobile);
CREATE INDEX IF NOT EXISTS idx_customers_is_active ON customers(is_active);

-- ------------------------------------------------------------------------------
-- 3. Document Linkage: Add nullable customer_id to quotations and invoices
-- ------------------------------------------------------------------------------
ALTER TABLE quotations ADD COLUMN customer_id TEXT DEFAULT NULL REFERENCES customers(id);
ALTER TABLE invoices ADD COLUMN customer_id TEXT DEFAULT NULL REFERENCES customers(id);

CREATE INDEX IF NOT EXISTS idx_quotations_customer_id ON quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);

-- ------------------------------------------------------------------------------
-- 4. Customer Deletion Protection Trigger
-- ------------------------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_prevent_customer_deletion_with_financial_docs
BEFORE DELETE ON customers
BEGIN
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM quotations WHERE customer_id = OLD.id) THEN
      RAISE(ABORT, 'ERR_CUSTOMER_HAS_QUOTATIONS: Cannot delete customer associated with quotations. Deactivate customer instead.')
    WHEN EXISTS (SELECT 1 FROM invoices WHERE customer_id = OLD.id) THEN
      RAISE(ABORT, 'ERR_CUSTOMER_HAS_INVOICES: Cannot delete customer associated with invoices. Deactivate customer instead.')
  END;
END;

