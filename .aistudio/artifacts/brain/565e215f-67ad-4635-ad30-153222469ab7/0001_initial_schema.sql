-- ==============================================================================
-- BABA ENTERPRISES — CONSOLIDATED PRODUCTION D1 SCHEMA
-- Generated for staging target: babaenterprises-db-staging
-- Prefix Policy: BE/26-27/ (computed dynamically per financial year)
-- Quotation Prefix Policy: BE/QT/26-27/ (computed dynamically per financial year)
-- Compliant with: Staging Acceptance Gate SQLite Assertions
-- ==============================================================================

PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------------------------
-- TABLE 1: business_settings
-- ------------------------------------------------------------------------------
CREATE TABLE business_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  legal_name TEXT NOT NULL DEFAULT 'BABA ENTERPRISES',
  trade_name TEXT NOT NULL DEFAULT 'BABA ENTERPRISES',
  gstin TEXT NOT NULL DEFAULT '27AGCPB8322L1ZG',
  pan TEXT NOT NULL DEFAULT 'AGCPB8322L',
  state_name TEXT NOT NULL DEFAULT 'Maharashtra',
  state_code TEXT NOT NULL DEFAULT '27',
  address_line1 TEXT NOT NULL DEFAULT 'Sr. No. 229/2, Shree Gajanan Housing Society',
  address_line2 TEXT NOT NULL DEFAULT 'Khandobamal, Bhosari',
  city TEXT NOT NULL DEFAULT 'Pune',
  pincode TEXT NOT NULL DEFAULT '411039',
  phone_primary TEXT NOT NULL DEFAULT '9028260011',
  phone_secondary TEXT NOT NULL DEFAULT '8788266934',
  email TEXT NOT NULL DEFAULT 'babaenterprises09@gmail.com',
  bank_name TEXT DEFAULT NULL,
  bank_branch TEXT DEFAULT NULL,
  bank_account_no TEXT DEFAULT NULL,
  bank_ifsc TEXT DEFAULT NULL,
  invoice_prefix TEXT NOT NULL DEFAULT 'BE/26-27/',
  quotation_prefix TEXT NOT NULL DEFAULT 'BE/QT/26-27/',
  default_payment_terms TEXT DEFAULT NULL,
  default_invoice_notes TEXT DEFAULT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------------------------
-- TABLE 2: products
-- ------------------------------------------------------------------------------
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('rubber', 'plastic', 'sealing', 'moulded', 'custom', 'extruded')),
  category_label TEXT NOT NULL,
  image_url TEXT,
  short_description TEXT NOT NULL,
  full_description TEXT NOT NULL,
  hsn_code TEXT DEFAULT NULL CHECK (hsn_code IS NULL OR length(hsn_code) BETWEEN 4 AND 8),
  unit_price_paise INTEGER NOT NULL DEFAULT 0 CHECK (unit_price_paise >= 0),
  gst_rate_bps INTEGER DEFAULT NULL CHECK (gst_rate_bps IS NULL OR gst_rate_bps IN (0, 500, 1200, 1800, 2800)),
  applications_json TEXT NOT NULL DEFAULT '[]',
  materials_json TEXT NOT NULL DEFAULT '[]',
  features_json TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------------------------
-- TABLE 3: customer_references
-- ------------------------------------------------------------------------------
CREATE TABLE customer_references (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  category TEXT NOT NULL,
  sector TEXT NOT NULL,
  logo_url TEXT,
  logo_alt TEXT,
  contact_person TEXT DEFAULT NULL,
  designation TEXT DEFAULT NULL,
  email TEXT DEFAULT NULL,
  phone TEXT DEFAULT NULL,
  buyer_gstin TEXT DEFAULT NULL,
  is_verified INTEGER NOT NULL DEFAULT 0 CHECK (is_verified IN (0, 1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------------------------
-- TABLE 4: enquiries
-- ------------------------------------------------------------------------------
CREATE TABLE enquiries (
  id TEXT PRIMARY KEY,
  reference_number TEXT NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  email TEXT NOT NULL,
  mobile TEXT NOT NULL CHECK (length(mobile) >= 10),
  product_category TEXT NOT NULL,
  quantity_required TEXT NOT NULL,
  technical_requirements TEXT,
  message TEXT,
  drawing_file_key TEXT DEFAULT NULL,
  drawing_file_name TEXT DEFAULT NULL,
  drawing_file_size INTEGER DEFAULT NULL,
  drawing_content_type TEXT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Contacted', 'Quotation Sent', 'In Discussion', 'Closed')),
  internal_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------------------------
-- TABLE 5: quotations
-- ------------------------------------------------------------------------------
CREATE TABLE quotations (
  id TEXT PRIMARY KEY,
  quotation_number TEXT UNIQUE DEFAULT NULL,
  quotation_prefix TEXT NOT NULL DEFAULT 'BE/QT/26-27/',
  sequence_number INTEGER DEFAULT NULL,
  quotation_date TEXT NOT NULL,
  valid_until TEXT NOT NULL,
  financial_year TEXT NOT NULL DEFAULT '2026-27',
  buyer_name TEXT NOT NULL,
  buyer_company TEXT,
  buyer_gstin TEXT DEFAULT NULL,
  buyer_state_code TEXT NOT NULL DEFAULT '27',
  buyer_state_name TEXT NOT NULL DEFAULT 'Maharashtra',
  buyer_address TEXT,
  buyer_pincode TEXT DEFAULT NULL CHECK (buyer_pincode IS NULL OR (length(buyer_pincode) = 6 AND buyer_pincode GLOB '[1-9][0-9][0-9][0-9][0-9][0-9]')),
  buyer_phone TEXT,
  buyer_email TEXT,
  is_interstate INTEGER NOT NULL DEFAULT 0 CHECK (is_interstate IN (0, 1)),
  place_of_supply TEXT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Accepted', 'Rejected', 'Expired', 'Converted')),
  converted_invoice_id TEXT UNIQUE DEFAULT NULL REFERENCES invoices(id),
  client_approval_evidence TEXT DEFAULT NULL,
  accepted_at TEXT DEFAULT NULL,
  rejection_reason TEXT DEFAULT NULL,
  rejected_at TEXT DEFAULT NULL,
  status_changed_by TEXT DEFAULT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  subtotal_gross_paise INTEGER NOT NULL DEFAULT 0 CHECK (subtotal_gross_paise >= 0),
  total_discount_paise INTEGER NOT NULL DEFAULT 0 CHECK (total_discount_paise >= 0),
  taxable_amount_paise INTEGER NOT NULL DEFAULT 0 CHECK (taxable_amount_paise >= 0),
  cgst_amount_paise INTEGER NOT NULL DEFAULT 0 CHECK (cgst_amount_paise >= 0),
  sgst_amount_paise INTEGER NOT NULL DEFAULT 0 CHECK (sgst_amount_paise >= 0),
  igst_amount_paise INTEGER NOT NULL DEFAULT 0 CHECK (igst_amount_paise >= 0),
  total_tax_paise INTEGER NOT NULL DEFAULT 0 CHECK (total_tax_paise >= 0),
  apply_round_off INTEGER NOT NULL DEFAULT 1 CHECK (apply_round_off IN (0, 1)),
  round_off_paise INTEGER NOT NULL DEFAULT 0 CHECK (round_off_paise BETWEEN -50 AND 50),
  total_amount_paise INTEGER NOT NULL DEFAULT 0 CHECK (total_amount_paise >= 0),
  payment_terms TEXT,
  delivery_terms TEXT,
  notes TEXT,
  dispatch_id TEXT DEFAULT NULL REFERENCES quotation_dispatches(id),
  sent_at TEXT DEFAULT NULL,
  sent_to_recipient TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (total_tax_paise = cgst_amount_paise + sgst_amount_paise + igst_amount_paise),
  CHECK (total_amount_paise = taxable_amount_paise + total_tax_paise + round_off_paise),
  CHECK (subtotal_gross_paise >= total_discount_paise),
  CHECK (
    (is_interstate = 0 AND igst_amount_paise = 0) OR
    (is_interstate = 1 AND cgst_amount_paise = 0 AND sgst_amount_paise = 0)
  )
);

-- ------------------------------------------------------------------------------
-- TABLE 6: quotation_items
-- ------------------------------------------------------------------------------
CREATE TABLE quotation_items (
  id TEXT PRIMARY KEY,
  quotation_id TEXT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL CHECK (line_number >= 1),
  product_id TEXT REFERENCES products(id),
  item_description TEXT NOT NULL,
  hsn_code TEXT DEFAULT NULL CHECK (hsn_code IS NULL OR length(hsn_code) BETWEEN 4 AND 8),
  quantity_microunits INTEGER NOT NULL CHECK (quantity_microunits > 0),
  unit_of_measure TEXT NOT NULL DEFAULT 'NOS',
  unit_price_paise INTEGER NOT NULL CHECK (unit_price_paise >= 0),
  gross_amount_paise INTEGER NOT NULL CHECK (gross_amount_paise >= 0),
  discount_bps INTEGER NOT NULL DEFAULT 0 CHECK (discount_bps BETWEEN 0 AND 10000),
  discount_amount_paise INTEGER NOT NULL DEFAULT 0 CHECK (discount_amount_paise >= 0),
  taxable_amount_paise INTEGER NOT NULL CHECK (taxable_amount_paise >= 0),
  gst_rate_bps INTEGER DEFAULT NULL CHECK (gst_rate_bps IS NULL OR gst_rate_bps IN (0, 500, 1200, 1800, 2800)),
  cgst_rate_bps INTEGER NOT NULL DEFAULT 0 CHECK (cgst_rate_bps >= 0),
  sgst_rate_bps INTEGER NOT NULL DEFAULT 0 CHECK (sgst_rate_bps >= 0),
  igst_rate_bps INTEGER NOT NULL DEFAULT 0 CHECK (igst_rate_bps >= 0),
  cgst_amount_paise INTEGER NOT NULL DEFAULT 0 CHECK (cgst_amount_paise >= 0),
  sgst_amount_paise INTEGER NOT NULL DEFAULT 0 CHECK (sgst_amount_paise >= 0),
  igst_amount_paise INTEGER NOT NULL DEFAULT 0 CHECK (igst_amount_paise >= 0),
  total_amount_paise INTEGER NOT NULL CHECK (total_amount_paise >= 0),
  UNIQUE(quotation_id, line_number),
  CHECK (gross_amount_paise >= discount_amount_paise),
  CHECK (taxable_amount_paise = gross_amount_paise - discount_amount_paise),
  CHECK (total_amount_paise = taxable_amount_paise + cgst_amount_paise + sgst_amount_paise + igst_amount_paise),
  CHECK (
    (gst_rate_bps IS NULL AND cgst_rate_bps = 0 AND sgst_rate_bps = 0 AND igst_rate_bps = 0) OR
    (gst_rate_bps IS NOT NULL AND igst_rate_bps = 0 AND cgst_rate_bps + sgst_rate_bps = gst_rate_bps AND cgst_rate_bps = sgst_rate_bps) OR
    (gst_rate_bps IS NOT NULL AND cgst_rate_bps = 0 AND sgst_rate_bps = 0 AND igst_rate_bps = gst_rate_bps)
  ),
  CHECK (
    (igst_amount_paise = 0 AND igst_rate_bps = 0) OR
    (cgst_amount_paise = 0 AND sgst_amount_paise = 0 AND cgst_rate_bps = 0 AND sgst_rate_bps = 0)
  )
);

-- ------------------------------------------------------------------------------
-- TABLE 7: quotation_dispatches
-- ------------------------------------------------------------------------------
CREATE TABLE quotation_dispatches (
  id TEXT PRIMARY KEY,
  quotation_id TEXT NOT NULL REFERENCES quotations(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL UNIQUE,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT DEFAULT NULL,
  dispatch_status TEXT NOT NULL CHECK (dispatch_status IN ('PENDING', 'TRANSMITTING', 'ACCEPTED', 'FAILED', 'TIMED_OUT', 'SIMULATED')),
  provider_name TEXT NOT NULL DEFAULT 'STAGING_EMAIL_PROVIDER',
  provider_message_id TEXT DEFAULT NULL,
  provider_idempotency_key TEXT NOT NULL UNIQUE,
  error_message TEXT DEFAULT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  initiated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT DEFAULT NULL,
  initiated_by TEXT NOT NULL DEFAULT 'ADMIN_STAGING',
  CHECK (
    (dispatch_status = 'ACCEPTED' AND provider_message_id IS NOT NULL AND completed_at IS NOT NULL) OR
    (dispatch_status != 'ACCEPTED')
  )
);

-- ------------------------------------------------------------------------------
-- TABLE 8: invoices
-- ------------------------------------------------------------------------------
CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Issued', 'Cancelled')),
  invoice_number TEXT UNIQUE DEFAULT NULL,
  invoice_prefix TEXT NOT NULL DEFAULT 'BE/26-27/',
  sequence_number INTEGER DEFAULT NULL,
  invoice_date TEXT DEFAULT NULL,
  financial_year TEXT NOT NULL DEFAULT '2026-27',
  seller_gstin TEXT NOT NULL DEFAULT '27AGCPB8322L1ZG',
  seller_state_code TEXT NOT NULL DEFAULT '27',
  seller_legal_name TEXT NOT NULL DEFAULT 'BABA ENTERPRISES',
  seller_trade_name TEXT NOT NULL DEFAULT 'BABA ENTERPRISES',
  seller_address TEXT NOT NULL DEFAULT 'Sr. No. 229/2, Shree Gajanan Housing Society, Khandobamal, Bhosari, Pune – 411039, Maharashtra',
  buyer_name TEXT DEFAULT NULL,
  buyer_trade_name TEXT DEFAULT NULL,
  buyer_address TEXT DEFAULT NULL,
  buyer_city TEXT DEFAULT NULL,
  buyer_state_name TEXT DEFAULT NULL,
  buyer_state_code TEXT DEFAULT NULL CHECK (buyer_state_code IS NULL OR length(buyer_state_code) = 2),
  buyer_pincode TEXT DEFAULT NULL CHECK (buyer_pincode IS NULL OR (length(buyer_pincode) = 6 AND buyer_pincode GLOB '[1-9][0-9][0-9][0-9][0-9][0-9]')),
  buyer_gstin TEXT DEFAULT NULL CHECK (
    buyer_gstin IS NULL OR (
      length(buyer_gstin) = 15 AND
      buyer_state_code IS NOT NULL AND
      substr(buyer_gstin, 1, 2) = buyer_state_code
    )
  ),
  is_interstate INTEGER NOT NULL DEFAULT 0 CHECK (is_interstate IN (0, 1)),
  place_of_supply TEXT DEFAULT NULL,
  reference_quotation_id TEXT UNIQUE DEFAULT NULL REFERENCES quotations(id),
  subtotal_gross_paise INTEGER NOT NULL DEFAULT 0 CHECK (subtotal_gross_paise >= 0),
  total_discount_paise INTEGER NOT NULL DEFAULT 0 CHECK (total_discount_paise >= 0),
  taxable_amount_paise INTEGER NOT NULL DEFAULT 0 CHECK (taxable_amount_paise >= 0),
  cgst_amount_paise INTEGER NOT NULL DEFAULT 0 CHECK (cgst_amount_paise >= 0),
  sgst_amount_paise INTEGER NOT NULL DEFAULT 0 CHECK (sgst_amount_paise >= 0),
  igst_amount_paise INTEGER NOT NULL DEFAULT 0 CHECK (igst_amount_paise >= 0),
  total_tax_paise INTEGER NOT NULL DEFAULT 0 CHECK (total_tax_paise >= 0),
  apply_round_off INTEGER NOT NULL DEFAULT 1 CHECK (apply_round_off IN (0, 1)),
  round_off_paise INTEGER NOT NULL DEFAULT 0 CHECK (round_off_paise BETWEEN -50 AND 50),
  total_invoice_amount_paise INTEGER NOT NULL DEFAULT 0 CHECK (total_invoice_amount_paise >= 0),
  payment_status TEXT NOT NULL DEFAULT 'Unpaid' CHECK (payment_status IN ('Unpaid', 'Partially_Paid', 'Paid')),
  payment_mode TEXT DEFAULT NULL,
  payment_reference TEXT DEFAULT NULL,
  payment_received_date TEXT DEFAULT NULL,
  cancellation_reason TEXT DEFAULT NULL,
  cancelled_at TEXT DEFAULT NULL,
  cancelled_by TEXT DEFAULT NULL,
  pdf_r2_key TEXT DEFAULT NULL,
  pdf_generated_at TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (total_tax_paise = cgst_amount_paise + sgst_amount_paise + igst_amount_paise),
  CHECK (total_invoice_amount_paise = taxable_amount_paise + total_tax_paise + round_off_paise),
  CHECK (subtotal_gross_paise >= total_discount_paise),
  CHECK (
    (is_interstate = 0 AND igst_amount_paise = 0) OR
    (is_interstate = 1 AND cgst_amount_paise = 0 AND sgst_amount_paise = 0)
  )
);

-- ------------------------------------------------------------------------------
-- TABLE 9: invoice_items
-- ------------------------------------------------------------------------------
CREATE TABLE invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL CHECK (line_number >= 1),
  product_id TEXT REFERENCES products(id),
  item_description TEXT NOT NULL,
  hsn_code TEXT DEFAULT NULL CHECK (hsn_code IS NULL OR length(hsn_code) BETWEEN 4 AND 8),
  quantity_microunits INTEGER NOT NULL CHECK (quantity_microunits > 0),
  unit_of_measure TEXT NOT NULL DEFAULT 'NOS',
  unit_price_paise INTEGER NOT NULL CHECK (unit_price_paise >= 0),
  gross_amount_paise INTEGER NOT NULL CHECK (gross_amount_paise >= 0),
  discount_bps INTEGER NOT NULL DEFAULT 0 CHECK (discount_bps BETWEEN 0 AND 10000),
  discount_amount_paise INTEGER NOT NULL DEFAULT 0 CHECK (discount_amount_paise >= 0),
  taxable_amount_paise INTEGER NOT NULL CHECK (taxable_amount_paise >= 0),
  gst_rate_bps INTEGER DEFAULT NULL CHECK (gst_rate_bps IS NULL OR gst_rate_bps IN (0, 500, 1200, 1800, 2800)),
  cgst_rate_bps INTEGER NOT NULL DEFAULT 0 CHECK (cgst_rate_bps >= 0),
  sgst_rate_bps INTEGER NOT NULL DEFAULT 0 CHECK (sgst_rate_bps >= 0),
  igst_rate_bps INTEGER NOT NULL DEFAULT 0 CHECK (igst_rate_bps >= 0),
  cgst_amount_paise INTEGER NOT NULL DEFAULT 0 CHECK (cgst_amount_paise >= 0),
  sgst_amount_paise INTEGER NOT NULL DEFAULT 0 CHECK (sgst_amount_paise >= 0),
  igst_amount_paise INTEGER NOT NULL DEFAULT 0 CHECK (igst_amount_paise >= 0),
  total_amount_paise INTEGER NOT NULL CHECK (total_amount_paise >= 0),
  UNIQUE(invoice_id, line_number),
  CHECK (gross_amount_paise >= discount_amount_paise),
  CHECK (taxable_amount_paise = gross_amount_paise - discount_amount_paise),
  CHECK (total_amount_paise = taxable_amount_paise + cgst_amount_paise + sgst_amount_paise + igst_amount_paise),
  CHECK (
    (gst_rate_bps IS NULL AND cgst_rate_bps = 0 AND sgst_rate_bps = 0 AND igst_rate_bps = 0) OR
    (gst_rate_bps IS NOT NULL AND igst_rate_bps = 0 AND cgst_rate_bps + sgst_rate_bps = gst_rate_bps AND cgst_rate_bps = sgst_rate_bps) OR
    (gst_rate_bps IS NOT NULL AND cgst_rate_bps = 0 AND sgst_rate_bps = 0 AND igst_rate_bps = gst_rate_bps)
  ),
  CHECK (
    (igst_amount_paise = 0 AND igst_rate_bps = 0) OR
    (cgst_amount_paise = 0 AND sgst_amount_paise = 0 AND cgst_rate_bps = 0 AND sgst_rate_bps = 0)
  )
);

-- ------------------------------------------------------------------------------
-- TABLE 10: invoice_sequence_log
-- ------------------------------------------------------------------------------
CREATE TABLE invoice_sequence_log (
  financial_year TEXT NOT NULL,
  sequence_number INTEGER NOT NULL,
  invoice_id TEXT NOT NULL UNIQUE,
  allocated_at TEXT NOT NULL DEFAULT (datetime('now')),
  allocated_by TEXT NOT NULL DEFAULT 'SYSTEM_STAGING',
  PRIMARY KEY (financial_year, sequence_number),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

-- ------------------------------------------------------------------------------
-- TABLE 11: quotation_sequence_log
-- ------------------------------------------------------------------------------
CREATE TABLE quotation_sequence_log (
  financial_year TEXT NOT NULL,
  sequence_number INTEGER NOT NULL,
  quotation_id TEXT NOT NULL UNIQUE,
  allocated_at TEXT NOT NULL DEFAULT (datetime('now')),
  allocated_by TEXT NOT NULL DEFAULT 'SYSTEM_STAGING',
  PRIMARY KEY (financial_year, sequence_number),
  FOREIGN KEY (quotation_id) REFERENCES quotations(id)
);

-- ------------------------------------------------------------------------------
-- TABLE 12: idempotency_keys
-- ------------------------------------------------------------------------------
CREATE TABLE idempotency_keys (
  key TEXT PRIMARY KEY,
  operation TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_status INTEGER DEFAULT NULL,
  response_body TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

-- ------------------------------------------------------------------------------
-- TABLE 13: audit_logs
-- ------------------------------------------------------------------------------
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'ADMIN',
  details_json TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ==============================================================================
-- DATABASE INTEGRITY TRIGGERS
-- ==============================================================================

-- TRIGGER 1: trg_prevent_invoice_sequence_log_deletion
CREATE TRIGGER trg_prevent_invoice_sequence_log_deletion
BEFORE DELETE ON invoice_sequence_log
BEGIN
  SELECT RAISE(ABORT, 'ERR_AUDIT_LOG_DELETION: Invoice sequence allocations are permanent audit records and cannot be deleted.');
END;

-- TRIGGER 2: trg_prevent_invoice_sequence_log_update
CREATE TRIGGER trg_prevent_invoice_sequence_log_update
BEFORE UPDATE ON invoice_sequence_log
BEGIN
  SELECT RAISE(ABORT, 'ERR_AUDIT_LOG_IMMUTABLE: Invoice sequence allocation log is immutable.');
END;

-- TRIGGER 3: trg_enforce_invoice_sequence_contiguity
CREATE TRIGGER trg_enforce_invoice_sequence_contiguity
BEFORE INSERT ON invoice_sequence_log
BEGIN
  -- 1. Assert invoice exists and that financial_year matches the invoice record exactly
  SELECT CASE
    WHEN (SELECT id FROM invoices WHERE id = NEW.invoice_id) IS NULL THEN
      RAISE(ABORT, 'ERR_INVOICE_NOT_FOUND: Invoice does not exist for sequence reservation.')
    WHEN (SELECT financial_year FROM invoices WHERE id = NEW.invoice_id) != NEW.financial_year THEN
      RAISE(ABORT, 'ERR_FINANCIAL_YEAR_MISMATCH: Sequence log financial_year must match invoice financial_year.')
  END;

  -- 2. Assert strictly contiguous sequence progression
  SELECT CASE
    WHEN NEW.sequence_number != (
      SELECT coalesce(max(sequence_number), 0) + 1
      FROM invoice_sequence_log
      WHERE financial_year = NEW.financial_year
    ) THEN
      RAISE(ABORT, 'ERR_SEQUENCE_GAP: Sequence number must be strictly next sequential integer (no duplicates, skipped, or out-of-order values).')
  END;
END;

-- TRIGGER 4: trg_prevent_quotation_sequence_log_deletion
CREATE TRIGGER trg_prevent_quotation_sequence_log_deletion
BEFORE DELETE ON quotation_sequence_log
BEGIN
  SELECT RAISE(ABORT, 'ERR_AUDIT_LOG_DELETION: Quotation sequence allocations are permanent audit records and cannot be deleted.');
END;

-- TRIGGER 5: trg_prevent_quotation_sequence_log_update
CREATE TRIGGER trg_prevent_quotation_sequence_log_update
BEFORE UPDATE ON quotation_sequence_log
BEGIN
  SELECT RAISE(ABORT, 'ERR_AUDIT_LOG_IMMUTABLE: Quotation sequence allocation log is immutable.');
END;

-- TRIGGER 6: trg_enforce_quotation_sequence_contiguity
CREATE TRIGGER trg_enforce_quotation_sequence_contiguity
BEFORE INSERT ON quotation_sequence_log
BEGIN
  -- 1. Assert quotation exists and that financial_year matches the quotation record exactly
  SELECT CASE
    WHEN (SELECT id FROM quotations WHERE id = NEW.quotation_id) IS NULL THEN
      RAISE(ABORT, 'ERR_QUOTATION_NOT_FOUND: Quotation does not exist for sequence reservation.')
    WHEN (SELECT financial_year FROM quotations WHERE id = NEW.quotation_id) != NEW.financial_year THEN
      RAISE(ABORT, 'ERR_FINANCIAL_YEAR_MISMATCH: Sequence log financial_year must match quotation financial_year.')
  END;

  -- 2. Assert strictly contiguous sequence progression
  SELECT CASE
    WHEN NEW.sequence_number != (
      SELECT coalesce(max(sequence_number), 0) + 1
      FROM quotation_sequence_log
      WHERE financial_year = NEW.financial_year
    ) THEN
      RAISE(ABORT, 'ERR_SEQUENCE_GAP: Quotation sequence number must be strictly next sequential integer.')
  END;
END;

-- TRIGGER 7: trg_execute_quotation_issuance_on_sequence_reservation
CREATE TRIGGER trg_execute_quotation_issuance_on_sequence_reservation
AFTER INSERT ON quotation_sequence_log
BEGIN
  -- Assert target quotation exists and is in Draft status
  SELECT CASE
    WHEN (SELECT status FROM quotations WHERE id = NEW.quotation_id) IS NULL THEN
      RAISE(ABORT, 'ERR_QUOTATION_NOT_FOUND: Quotation does not exist for sequence reservation.')
    WHEN (SELECT status FROM quotations WHERE id = NEW.quotation_id) != 'Draft' THEN
      RAISE(ABORT, 'ERR_INVALID_STATUS_TRANSITION: Sequence number can only be reserved for Draft quotations.')
  END;

  -- Assert mandatory buyer details are populated
  SELECT CASE
    WHEN (SELECT buyer_name FROM quotations WHERE id = NEW.quotation_id) IS NULL
      OR length(trim((SELECT buyer_name FROM quotations WHERE id = NEW.quotation_id))) = 0 THEN
      RAISE(ABORT, 'ERR_MANDATORY_BUYER_NAME: Buyer name is mandatory for quotation issuance.')
    WHEN (SELECT buyer_address FROM quotations WHERE id = NEW.quotation_id) IS NULL
      OR length(trim((SELECT buyer_address FROM quotations WHERE id = NEW.quotation_id))) = 0 THEN
      RAISE(ABORT, 'ERR_MANDATORY_BUYER_ADDRESS: Buyer address is mandatory for quotation issuance.')
    WHEN (SELECT buyer_state_code FROM quotations WHERE id = NEW.quotation_id) IS NULL
      OR length((SELECT buyer_state_code FROM quotations WHERE id = NEW.quotation_id)) != 2 THEN
      RAISE(ABORT, 'ERR_MANDATORY_BUYER_STATE_CODE: Valid 2-digit buyer state code is mandatory for quotation issuance.')
  END;

  -- Assert at least one line item exists
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM quotation_items WHERE quotation_id = NEW.quotation_id) THEN
      RAISE(ABORT, 'ERR_NO_LINE_ITEMS: Quotation must have at least one line item before issuance.')
  END;

  -- Assert NO line item has NULL or unconfirmed GST rate or missing HSN code
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM quotation_items WHERE quotation_id = NEW.quotation_id AND gst_rate_bps IS NULL) THEN
      RAISE(ABORT, 'ERR_UNCONFIRMED_GST_RATE: All quotation line items must have administrator-confirmed GST rates before issuance.')
    WHEN EXISTS (SELECT 1 FROM quotation_items WHERE quotation_id = NEW.quotation_id AND (hsn_code IS NULL OR length(trim(hsn_code)) < 4)) THEN
      RAISE(ABORT, 'ERR_MANDATORY_HSN_CODE: Valid 4-to-8 digit HSN code is required for all quotation items before issuance.')
  END;

  -- Assert item-level tax math matches the documented paise-rounding policy: round((taxable_amount_paise * rate_bps) / 10000.0)
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM quotation_items
      WHERE quotation_id = NEW.quotation_id
        AND (
          cgst_amount_paise != cast(round((taxable_amount_paise * cgst_rate_bps) / 10000.0) as INTEGER)
          OR sgst_amount_paise != cast(round((taxable_amount_paise * sgst_rate_bps) / 10000.0) as INTEGER)
          OR igst_amount_paise != cast(round((taxable_amount_paise * igst_rate_bps) / 10000.0) as INTEGER)
        )
    ) THEN
      RAISE(ABORT, 'ERR_ITEM_TAX_CALCULATION_MISMATCH: Line item tax amount does not match component rate rounding rule.')
  END;

  -- Assert quotation item-to-header parity for gross, discount, taxable, cgst, sgst, igst, total tax, and final total
  SELECT CASE
    WHEN (SELECT subtotal_gross_paise FROM quotations WHERE id = NEW.quotation_id) != (
      SELECT coalesce(sum(gross_amount_paise), 0) FROM quotation_items WHERE quotation_id = NEW.quotation_id
    ) THEN
      RAISE(ABORT, 'ERR_FINANCIAL_HEADER_GROSS_MISMATCH: Quotation header subtotal gross does not match sum of items.')
    WHEN (SELECT total_discount_paise FROM quotations WHERE id = NEW.quotation_id) != (
      SELECT coalesce(sum(discount_amount_paise), 0) FROM quotation_items WHERE quotation_id = NEW.quotation_id
    ) THEN
      RAISE(ABORT, 'ERR_FINANCIAL_HEADER_DISCOUNT_MISMATCH: Quotation header discount does not match sum of items.')
    WHEN (SELECT taxable_amount_paise FROM quotations WHERE id = NEW.quotation_id) != (
      SELECT coalesce(sum(taxable_amount_paise), 0) FROM quotation_items WHERE quotation_id = NEW.quotation_id
    ) THEN
      RAISE(ABORT, 'ERR_FINANCIAL_HEADER_TAXABLE_MISMATCH: Quotation header taxable amount does not match sum of items.')
    WHEN (SELECT cgst_amount_paise FROM quotations WHERE id = NEW.quotation_id) != (
      SELECT coalesce(sum(cgst_amount_paise), 0) FROM quotation_items WHERE quotation_id = NEW.quotation_id
    ) THEN
      RAISE(ABORT, 'ERR_FINANCIAL_HEADER_CGST_MISMATCH: Quotation header CGST does not match sum of items.')
    WHEN (SELECT sgst_amount_paise FROM quotations WHERE id = NEW.quotation_id) != (
      SELECT coalesce(sum(sgst_amount_paise), 0) FROM quotation_items WHERE quotation_id = NEW.quotation_id
    ) THEN
      RAISE(ABORT, 'ERR_FINANCIAL_HEADER_SGST_MISMATCH: Quotation header SGST does not match sum of items.')
    WHEN (SELECT igst_amount_paise FROM quotations WHERE id = NEW.quotation_id) != (
      SELECT coalesce(sum(igst_amount_paise), 0) FROM quotation_items WHERE quotation_id = NEW.quotation_id
    ) THEN
      RAISE(ABORT, 'ERR_FINANCIAL_HEADER_IGST_MISMATCH: Quotation header IGST does not match sum of items.')
    WHEN (SELECT total_tax_paise FROM quotations WHERE id = NEW.quotation_id) != (
      SELECT cgst_amount_paise + sgst_amount_paise + igst_amount_paise FROM quotations WHERE id = NEW.quotation_id
    ) THEN
      RAISE(ABORT, 'ERR_FINANCIAL_HEADER_TAX_SUM_MISMATCH: Quotation header total_tax_paise does not equal cgst + sgst + igst.')
    WHEN (
      (SELECT taxable_amount_paise + total_tax_paise + round_off_paise FROM quotations WHERE id = NEW.quotation_id)
      != (SELECT total_amount_paise FROM quotations WHERE id = NEW.quotation_id)
    ) THEN
      RAISE(ABORT, 'ERR_FINANCIAL_TOTAL_MISMATCH: Quotation total amount does not balance.')
    WHEN (SELECT apply_round_off FROM quotations WHERE id = NEW.quotation_id) = 1 AND (
      (SELECT total_amount_paise FROM quotations WHERE id = NEW.quotation_id) % 100 != 0
    ) THEN
      RAISE(ABORT, 'ERR_FINANCIAL_ROUNDOFF_MISMATCH: Quotation applied round-off must yield exact whole rupees.')
  END;

  -- Number allocation: Preserves status as 'Draft' (never falsely marks Sent or Accepted)
  UPDATE quotations
  SET quotation_prefix = 'BE/QT/' || substr(NEW.financial_year, 3, 5) || '/',
      sequence_number = NEW.sequence_number,
      quotation_number = 'BE/QT/' || substr(NEW.financial_year, 3, 5) || '/' || substr('0000' || NEW.sequence_number, -4),
      updated_at = datetime('now')
  WHERE id = NEW.quotation_id;
END;

-- TRIGGER 8: trg_execute_invoice_issuance_on_sequence_reservation
CREATE TRIGGER trg_execute_invoice_issuance_on_sequence_reservation
AFTER INSERT ON invoice_sequence_log
BEGIN
  -- Assert target invoice exists and is in Draft status
  SELECT CASE
    WHEN (SELECT status FROM invoices WHERE id = NEW.invoice_id) IS NULL THEN
      RAISE(ABORT, 'ERR_INVOICE_NOT_FOUND: Invoice does not exist for sequence reservation.')
    WHEN (SELECT status FROM invoices WHERE id = NEW.invoice_id) != 'Draft' THEN
      RAISE(ABORT, 'ERR_INVALID_STATUS_TRANSITION: Sequence number can only be reserved for Draft invoices.')
  END;

  -- Assert mandatory buyer details are populated
  SELECT CASE
    WHEN (SELECT buyer_name FROM invoices WHERE id = NEW.invoice_id) IS NULL
      OR length(trim((SELECT buyer_name FROM invoices WHERE id = NEW.invoice_id))) = 0 THEN
      RAISE(ABORT, 'ERR_MANDATORY_BUYER_NAME: Buyer name is mandatory for invoice issuance.')
    WHEN (SELECT buyer_address FROM invoices WHERE id = NEW.invoice_id) IS NULL
      OR length(trim((SELECT buyer_address FROM invoices WHERE id = NEW.invoice_id))) = 0 THEN
      RAISE(ABORT, 'ERR_MANDATORY_BUYER_ADDRESS: Buyer address is mandatory for invoice issuance.')
    WHEN (SELECT buyer_state_code FROM invoices WHERE id = NEW.invoice_id) IS NULL
      OR length((SELECT buyer_state_code FROM invoices WHERE id = NEW.invoice_id)) != 2 THEN
      RAISE(ABORT, 'ERR_MANDATORY_BUYER_STATE_CODE: Valid 2-digit buyer state code is mandatory for issuance.')
    WHEN (SELECT buyer_pincode FROM invoices WHERE id = NEW.invoice_id) IS NULL
      OR length((SELECT buyer_pincode FROM invoices WHERE id = NEW.invoice_id)) != 6 THEN
      RAISE(ABORT, 'ERR_MANDATORY_BUYER_PINCODE: Valid 6-digit buyer PIN code is mandatory for issuance.')
  END;

  -- Assert at least one line item exists
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM invoice_items WHERE invoice_id = NEW.invoice_id) THEN
      RAISE(ABORT, 'ERR_NO_LINE_ITEMS: Invoice must have at least one line item before issuance.')
  END;

  -- Assert NO line item has NULL or unconfirmed GST rate or missing HSN code
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM invoice_items WHERE invoice_id = NEW.invoice_id AND gst_rate_bps IS NULL) THEN
      RAISE(ABORT, 'ERR_UNCONFIRMED_GST_RATE: All line items must have administrator-confirmed GST rates before issuance.')
    WHEN EXISTS (SELECT 1 FROM invoice_items WHERE invoice_id = NEW.invoice_id AND (hsn_code IS NULL OR length(trim(hsn_code)) < 4)) THEN
      RAISE(ABORT, 'ERR_MANDATORY_HSN_CODE: Valid 4-to-8 digit HSN code is required for all line items before issuance.')
  END;

  -- Assert item-level tax math matches the documented paise-rounding policy: round((taxable_amount_paise * rate_bps) / 10000.0)
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM invoice_items
      WHERE invoice_id = NEW.invoice_id
        AND (
          cgst_amount_paise != cast(round((taxable_amount_paise * cgst_rate_bps) / 10000.0) as INTEGER)
          OR sgst_amount_paise != cast(round((taxable_amount_paise * sgst_rate_bps) / 10000.0) as INTEGER)
          OR igst_amount_paise != cast(round((taxable_amount_paise * igst_rate_bps) / 10000.0) as INTEGER)
        )
    ) THEN
      RAISE(ABORT, 'ERR_ITEM_TAX_CALCULATION_MISMATCH: Line item tax amount does not match component rate rounding rule.')
  END;

  -- Assert header financial amounts match exact sum of line items
  SELECT CASE
    WHEN (SELECT subtotal_gross_paise FROM invoices WHERE id = NEW.invoice_id) != (
      SELECT coalesce(sum(gross_amount_paise), 0) FROM invoice_items WHERE invoice_id = NEW.invoice_id
    ) THEN
      RAISE(ABORT, 'ERR_FINANCIAL_HEADER_GROSS_MISMATCH: Header subtotal gross does not match sum of items.')
    WHEN (SELECT total_discount_paise FROM invoices WHERE id = NEW.invoice_id) != (
      SELECT coalesce(sum(discount_amount_paise), 0) FROM invoice_items WHERE invoice_id = NEW.invoice_id
    ) THEN
      RAISE(ABORT, 'ERR_FINANCIAL_HEADER_DISCOUNT_MISMATCH: Header discount does not match sum of items.')
    WHEN (SELECT taxable_amount_paise FROM invoices WHERE id = NEW.invoice_id) != (
      SELECT coalesce(sum(taxable_amount_paise), 0) FROM invoice_items WHERE invoice_id = NEW.invoice_id
    ) THEN
      RAISE(ABORT, 'ERR_FINANCIAL_HEADER_TAXABLE_MISMATCH: Header taxable amount does not match sum of items.')
    WHEN (SELECT cgst_amount_paise FROM invoices WHERE id = NEW.invoice_id) != (
      SELECT coalesce(sum(cgst_amount_paise), 0) FROM invoice_items WHERE invoice_id = NEW.invoice_id
    ) THEN
      RAISE(ABORT, 'ERR_FINANCIAL_HEADER_CGST_MISMATCH: Header CGST does not match sum of items.')
    WHEN (SELECT sgst_amount_paise FROM invoices WHERE id = NEW.invoice_id) != (
      SELECT coalesce(sum(sgst_amount_paise), 0) FROM invoice_items WHERE invoice_id = NEW.invoice_id
    ) THEN
      RAISE(ABORT, 'ERR_FINANCIAL_HEADER_SGST_MISMATCH: Header SGST does not match sum of items.')
    WHEN (SELECT igst_amount_paise FROM invoices WHERE id = NEW.invoice_id) != (
      SELECT coalesce(sum(igst_amount_paise), 0) FROM invoice_items WHERE invoice_id = NEW.invoice_id
    ) THEN
      RAISE(ABORT, 'ERR_FINANCIAL_HEADER_IGST_MISMATCH: Header IGST does not match sum of items.')
    WHEN (SELECT total_tax_paise FROM invoices WHERE id = NEW.invoice_id) != (
      SELECT cgst_amount_paise + sgst_amount_paise + igst_amount_paise FROM invoices WHERE id = NEW.invoice_id
    ) THEN
      RAISE(ABORT, 'ERR_FINANCIAL_HEADER_TAX_SUM_MISMATCH: Header total_tax_paise does not equal cgst + sgst + igst.')
    WHEN (
      (SELECT taxable_amount_paise + total_tax_paise + round_off_paise FROM invoices WHERE id = NEW.invoice_id)
      != (SELECT total_invoice_amount_paise FROM invoices WHERE id = NEW.invoice_id)
    ) THEN
      RAISE(ABORT, 'ERR_FINANCIAL_TOTAL_MISMATCH: Total invoice amount does not balance.')
    WHEN (SELECT apply_round_off FROM invoices WHERE id = NEW.invoice_id) = 1 AND (
      (SELECT total_invoice_amount_paise FROM invoices WHERE id = NEW.invoice_id) % 100 != 0
    ) THEN
      RAISE(ABORT, 'ERR_FINANCIAL_ROUNDOFF_MISMATCH: Applied round-off must yield exact whole rupees.')
  END;

  -- Inseparable state transition from Draft to Issued with dynamic financial year prefix (BE/26-27/0001)
  UPDATE invoices
  SET status = 'Issued',
      invoice_prefix = 'BE/' || substr(NEW.financial_year, 3, 5) || '/',
      sequence_number = NEW.sequence_number,
      invoice_number = 'BE/' || substr(NEW.financial_year, 3, 5) || '/' || substr('0000' || NEW.sequence_number, -4),
      invoice_date = coalesce(invoice_date, date('now')),
      updated_at = datetime('now')
  WHERE id = NEW.invoice_id;
END;

-- TRIGGER 9: trg_enforce_invoice_fsm_and_immutability
CREATE TRIGGER trg_enforce_invoice_fsm_and_immutability
BEFORE UPDATE ON invoices
BEGIN
  -- 1. Block invalid status transitions
  SELECT CASE
    -- Disallow Draft to Cancelled (Drafts must be deleted, not cancelled)
    WHEN OLD.status = 'Draft' AND NEW.status = 'Cancelled' THEN
      RAISE(ABORT, 'ERR_INVALID_TRANSITION: Draft invoices cannot be cancelled. Unissued drafts must be deleted.')
    -- Disallow updating invoices that were Issued to Draft
    WHEN OLD.status = 'Issued' AND NEW.status = 'Draft' THEN
      RAISE(ABORT, 'ERR_INVALID_TRANSITION: Issued invoices cannot be reverted to Draft.')
    -- Disallow modifying already Cancelled invoices (frozen completely)
    WHEN OLD.status = 'Cancelled' THEN
      RAISE(ABORT, 'ERR_CANCELLED_INVOICE_FROZEN: Cancelled invoices are permanently immutable.')
  END;

  -- 2. When cancelling an Issued invoice, enforce cancellation fields and freeze all financial/buyer/seller data
  SELECT CASE
    WHEN OLD.status = 'Issued' AND NEW.status = 'Cancelled' THEN
      CASE
        WHEN NEW.cancellation_reason IS NULL OR length(trim(NEW.cancellation_reason)) < 5 THEN
          RAISE(ABORT, 'ERR_CANCELLATION_REASON_REQUIRED: A valid cancellation reason (min 5 chars) is mandatory.')
        WHEN NEW.cancelled_by IS NULL OR length(trim(NEW.cancelled_by)) = 0 THEN
          RAISE(ABORT, 'ERR_CANCELLED_BY_REQUIRED: Actor name is required for invoice cancellation.')
        WHEN NEW.cancelled_at IS NULL OR length(trim(NEW.cancelled_at)) = 0 THEN
          RAISE(ABORT, 'ERR_CANCELLED_AT_REQUIRED: Cancellation timestamp is required for invoice cancellation.')
        -- Comprehensive immutability assertions during cancellation
        WHEN NEW.id IS NOT OLD.id
          OR NEW.invoice_number IS NOT OLD.invoice_number
          OR NEW.sequence_number IS NOT OLD.sequence_number
          OR NEW.invoice_prefix IS NOT OLD.invoice_prefix
          OR NEW.invoice_date IS NOT OLD.invoice_date
          OR NEW.financial_year IS NOT OLD.financial_year
          OR NEW.seller_gstin IS NOT OLD.seller_gstin
          OR NEW.seller_state_code IS NOT OLD.seller_state_code
          OR NEW.seller_legal_name IS NOT OLD.seller_legal_name
          OR NEW.seller_trade_name IS NOT OLD.seller_trade_name
          OR NEW.seller_address IS NOT OLD.seller_address
          OR (NEW.buyer_name IS NOT OLD.buyer_name)
          OR (NEW.buyer_trade_name IS NOT OLD.buyer_trade_name)
          OR (NEW.buyer_address IS NOT OLD.buyer_address)
          OR (NEW.buyer_city IS NOT OLD.buyer_city)
          OR (NEW.buyer_state_name IS NOT OLD.buyer_state_name)
          OR (NEW.buyer_state_code IS NOT OLD.buyer_state_code)
          OR (NEW.buyer_pincode IS NOT OLD.buyer_pincode)
          OR (NEW.buyer_gstin IS NOT OLD.buyer_gstin)
          OR NEW.is_interstate IS NOT OLD.is_interstate
          OR (NEW.place_of_supply IS NOT OLD.place_of_supply)
          OR (NEW.reference_quotation_id IS NOT OLD.reference_quotation_id)
          OR NEW.subtotal_gross_paise IS NOT OLD.subtotal_gross_paise
          OR NEW.total_discount_paise IS NOT OLD.total_discount_paise
          OR NEW.taxable_amount_paise IS NOT OLD.taxable_amount_paise
          OR NEW.cgst_amount_paise IS NOT OLD.cgst_amount_paise
          OR NEW.sgst_amount_paise IS NOT OLD.sgst_amount_paise
          OR NEW.igst_amount_paise IS NOT OLD.igst_amount_paise
          OR NEW.total_tax_paise IS NOT OLD.total_tax_paise
          OR NEW.apply_round_off IS NOT OLD.apply_round_off
          OR NEW.round_off_paise IS NOT OLD.round_off_paise
          OR NEW.total_invoice_amount_paise IS NOT OLD.total_invoice_amount_paise
          OR NEW.payment_status IS NOT OLD.payment_status
          OR (NEW.payment_mode IS NOT OLD.payment_mode)
          OR (NEW.payment_reference IS NOT OLD.payment_reference)
          OR (NEW.payment_received_date IS NOT OLD.payment_received_date)
          OR (NEW.pdf_r2_key IS NOT OLD.pdf_r2_key)
          OR (NEW.pdf_generated_at IS NOT OLD.pdf_generated_at)
          OR NEW.created_at IS NOT OLD.created_at THEN
          RAISE(ABORT, 'ERR_IMMUTABLE_ON_CANCELLATION: Core invoice details cannot be modified during cancellation.')
      END
  END;

  -- 3. While status remains Issued, allow ONLY payment status and PDF metadata updates; protect all financial, legal, AND cancellation fields
  SELECT CASE
    WHEN OLD.status = 'Issued' AND NEW.status = 'Issued' THEN
      CASE
        WHEN NEW.id IS NOT OLD.id
          OR NEW.invoice_number IS NOT OLD.invoice_number
          OR NEW.sequence_number IS NOT OLD.sequence_number
          OR NEW.invoice_prefix IS NOT OLD.invoice_prefix
          OR NEW.invoice_date IS NOT OLD.invoice_date
          OR NEW.financial_year IS NOT OLD.financial_year
          OR NEW.seller_gstin IS NOT OLD.seller_gstin
          OR NEW.seller_state_code IS NOT OLD.seller_state_code
          OR NEW.seller_legal_name IS NOT OLD.seller_legal_name
          OR NEW.seller_trade_name IS NOT OLD.seller_trade_name
          OR NEW.seller_address IS NOT OLD.seller_address
          OR (NEW.buyer_name IS NOT OLD.buyer_name)
          OR (NEW.buyer_trade_name IS NOT OLD.buyer_trade_name)
          OR (NEW.buyer_address IS NOT OLD.buyer_address)
          OR (NEW.buyer_city IS NOT OLD.buyer_city)
          OR (NEW.buyer_state_name IS NOT OLD.buyer_state_name)
          OR (NEW.buyer_state_code IS NOT OLD.buyer_state_code)
          OR (NEW.buyer_pincode IS NOT OLD.buyer_pincode)
          OR (NEW.buyer_gstin IS NOT OLD.buyer_gstin)
          OR NEW.is_interstate IS NOT OLD.is_interstate
          OR (NEW.place_of_supply IS NOT OLD.place_of_supply)
          OR (NEW.reference_quotation_id IS NOT OLD.reference_quotation_id)
          OR NEW.subtotal_gross_paise IS NOT OLD.subtotal_gross_paise
          OR NEW.total_discount_paise IS NOT OLD.total_discount_paise
          OR NEW.taxable_amount_paise IS NOT OLD.taxable_amount_paise
          OR NEW.cgst_amount_paise IS NOT OLD.cgst_amount_paise
          OR NEW.sgst_amount_paise IS NOT OLD.sgst_amount_paise
          OR NEW.igst_amount_paise IS NOT OLD.igst_amount_paise
          OR NEW.total_tax_paise IS NOT OLD.total_tax_paise
          OR NEW.apply_round_off IS NOT OLD.apply_round_off
          OR NEW.round_off_paise IS NOT OLD.round_off_paise
          OR NEW.total_invoice_amount_paise IS NOT OLD.total_invoice_amount_paise
          OR (NEW.cancellation_reason IS NOT OLD.cancellation_reason)
          OR (NEW.cancelled_at IS NOT OLD.cancelled_at)
          OR (NEW.cancelled_by IS NOT OLD.cancelled_by)
          OR NEW.created_at IS NOT OLD.created_at THEN
          RAISE(ABORT, 'ERR_ISSUED_INVOICE_IMMUTABLE: Financial, legal, buyer, seller, address, place of supply, numbering, and cancellation fields of issued invoices are permanently immutable.')
      END
  END;
END;

-- TRIGGER 10: trg_prevent_issued_invoice_deletion
CREATE TRIGGER trg_prevent_issued_invoice_deletion
BEFORE DELETE ON invoices
BEGIN
  SELECT CASE
    WHEN OLD.status IN ('Issued', 'Cancelled') THEN
      RAISE(ABORT, 'ERR_LEGAL_RECORD_PROTECTION: Issued or cancelled invoices are legal audit records and cannot be deleted.')
  END;
END;

-- TRIGGER 11: trg_prevent_item_insert_after_issuance
CREATE TRIGGER trg_prevent_item_insert_after_issuance
BEFORE INSERT ON invoice_items
BEGIN
  SELECT CASE
    WHEN (SELECT status FROM invoices WHERE id = NEW.invoice_id) != 'Draft' THEN
      RAISE(ABORT, 'ERR_ITEMS_LOCKED: Line items cannot be added to an issued or cancelled invoice.')
  END;
END;

-- TRIGGER 12: trg_prevent_item_update_after_issuance
CREATE TRIGGER trg_prevent_item_update_after_issuance
BEFORE UPDATE ON invoice_items
BEGIN
  SELECT CASE
    WHEN (SELECT status FROM invoices WHERE id = OLD.invoice_id) != 'Draft' THEN
      RAISE(ABORT, 'ERR_ITEMS_LOCKED: Line items of issued or cancelled invoices are permanently immutable.')
  END;
END;

-- TRIGGER 13: trg_prevent_item_delete_after_issuance
CREATE TRIGGER trg_prevent_item_delete_after_issuance
BEFORE DELETE ON invoice_items
BEGIN
  SELECT CASE
    WHEN (SELECT status FROM invoices WHERE id = OLD.invoice_id) != 'Draft' THEN
      RAISE(ABORT, 'ERR_ITEMS_LOCKED: Line items of issued or cancelled invoices cannot be deleted.')
  END;
END;

-- TRIGGER 14: trg_enforce_quotation_fsm_and_immutability
CREATE TRIGGER trg_enforce_quotation_fsm_and_immutability
BEFORE UPDATE ON quotations
BEGIN
  -- 1. Assert that once quotation_number is allocated, it is permanently locked against any change (even in Draft)
  SELECT CASE
    WHEN OLD.quotation_number IS NOT NULL AND NEW.quotation_number IS NOT OLD.quotation_number THEN
      RAISE(ABORT, 'ERR_QUOTATION_NUMBER_LOCKED: Allocated quotation numbers are permanent and immutable.')
    WHEN OLD.sequence_number IS NOT NULL AND NEW.sequence_number IS NOT OLD.sequence_number THEN
      RAISE(ABORT, 'ERR_QUOTATION_SEQUENCE_LOCKED: Allocated quotation sequence number cannot be changed.')
    WHEN OLD.quotation_prefix IS NOT NULL AND NEW.quotation_prefix IS NOT OLD.quotation_prefix THEN
      RAISE(ABORT, 'ERR_QUOTATION_PREFIX_LOCKED: Allocated quotation prefix cannot be changed.')
  END;

  -- 2. Assert valid FSM state progression
  SELECT CASE
    -- Unnumbered quotation cannot transition directly out of Draft
    WHEN OLD.quotation_number IS NULL AND NEW.status IN ('Sent', 'Accepted', 'Rejected', 'Expired', 'Converted') THEN
      RAISE(ABORT, 'ERR_UNNUMBERED_QUOTATION_STATUS: Quotation must have an allocated sequence number before transitioning out of Draft.')
    -- Draft quotations must transition to Sent before any other state
    WHEN OLD.status = 'Draft' AND NEW.status NOT IN ('Draft', 'Sent') THEN
      RAISE(ABORT, 'ERR_INVALID_QUOTATION_TRANSITION: Draft quotation must be Sent before being Accepted, Rejected, Expired, or Converted.')
    -- Active or resolved quotations cannot revert to Draft
    WHEN OLD.status IN ('Sent', 'Accepted', 'Rejected', 'Expired', 'Converted') AND NEW.status = 'Draft' THEN
      RAISE(ABORT, 'ERR_INVALID_QUOTATION_TRANSITION: Active or resolved quotations cannot revert to Draft.')
    -- Sent quotations can transition only to Accepted, Rejected, or Expired; Sent CANNOT transition directly to Converted
    WHEN OLD.status = 'Sent' AND NEW.status NOT IN ('Sent', 'Accepted', 'Rejected', 'Expired') THEN
      RAISE(ABORT, 'ERR_INVALID_QUOTATION_TRANSITION: Sent quotation cannot transition directly to Converted. Quotation must be Accepted first.')
    -- Only Accepted quotations can be converted into invoices
    WHEN NEW.status = 'Converted' AND OLD.status != 'Accepted' THEN
      RAISE(ABORT, 'ERR_CONVERSION_REQUIRES_ACCEPTED: Only Accepted quotations can be converted into invoices.')
    -- When transitioning to Converted, converted_invoice_id is mandatory and must reference an existing invoice
    WHEN NEW.status = 'Converted' AND (NEW.converted_invoice_id IS NULL OR length(trim(NEW.converted_invoice_id)) = 0) THEN
      RAISE(ABORT, 'ERR_CONVERTED_INVOICE_REQUIRED: Transition to Converted requires a valid converted_invoice_id.')
    WHEN NEW.status = 'Converted' AND NOT EXISTS (SELECT 1 FROM invoices WHERE id = NEW.converted_invoice_id) THEN
      RAISE(ABORT, 'ERR_INVALID_CONVERTED_INVOICE: converted_invoice_id must reference a valid existing invoice.')
    -- Accepted quotations can only transition to Converted (or remain Accepted)
    WHEN OLD.status = 'Accepted' AND NEW.status NOT IN ('Accepted', 'Converted') THEN
      RAISE(ABORT, 'ERR_ACCEPTED_QUOTATION_INVALID_TRANSITION: Accepted quotations can only transition to Converted.')
    -- Rejected quotation status is terminal
    WHEN OLD.status = 'Rejected' AND NEW.status != 'Rejected' THEN
      RAISE(ABORT, 'ERR_REJECTED_QUOTATION_FINAL: Rejected quotation status is terminal.')
    -- Expired quotation status is terminal
    WHEN OLD.status = 'Expired' AND NEW.status != 'Expired' THEN
      RAISE(ABORT, 'ERR_EXPIRED_QUOTATION_FINAL: Expired quotation status is terminal.')
    -- Converted quotation status is terminal
    WHEN OLD.status = 'Converted' AND NEW.status != 'Converted' THEN
      RAISE(ABORT, 'ERR_CONVERTED_QUOTATION_FINAL: Converted quotation status is terminal.')
  END;

  -- 3. Transition from Draft to Sent: Rigorously revalidate the complete quotation before dispatch
  SELECT CASE
    WHEN OLD.status = 'Draft' AND NEW.status = 'Sent' THEN
      CASE
        -- Verified dispatch authorization assertion
        WHEN NEW.dispatch_id IS NULL THEN
          RAISE(ABORT, 'ERR_DISPATCH_RECORD_REQUIRED: Transition to Sent requires an authorized dispatch_id.')
        WHEN NOT EXISTS (
          SELECT 1 FROM quotation_dispatches
          WHERE id = NEW.dispatch_id
            AND quotation_id = NEW.id
            AND dispatch_status = 'ACCEPTED'
            AND provider_message_id IS NOT NULL
        ) THEN
          RAISE(ABORT, 'ERR_UNAUTHORIZED_DISPATCH_TRANSITION: Transition to Sent requires a verified ACCEPTED dispatch record in quotation_dispatches.')
        -- Allocated sequence number required
        WHEN NEW.quotation_number IS NULL THEN
          RAISE(ABORT, 'ERR_UNNUMBERED_QUOTATION_STATUS: Quotation must have an allocated number before dispatch.')
        -- Mandatory dispatch metadata
        WHEN NEW.sent_to_recipient IS NULL OR length(trim(NEW.sent_to_recipient)) = 0 THEN
          RAISE(ABORT, 'ERR_DISPATCH_RECIPIENT_REQUIRED: Recipient email or name is required for quotation dispatch.')
        WHEN NEW.sent_at IS NULL OR length(trim(NEW.sent_at)) = 0 THEN
          RAISE(ABORT, 'ERR_DISPATCH_TIMESTAMP_REQUIRED: Dispatch timestamp sent_at is required for quotation dispatch.')
        -- Mandatory buyer details
        WHEN NEW.buyer_name IS NULL OR length(trim(NEW.buyer_name)) = 0 THEN
          RAISE(ABORT, 'ERR_MANDATORY_BUYER_NAME: Buyer name is mandatory for quotation dispatch.')
        WHEN NEW.buyer_address IS NULL OR length(trim(NEW.buyer_address)) = 0 THEN
          RAISE(ABORT, 'ERR_MANDATORY_BUYER_ADDRESS: Buyer address is mandatory for quotation dispatch.')
        WHEN NEW.buyer_state_code IS NULL OR length(NEW.buyer_state_code) != 2 THEN
          RAISE(ABORT, 'ERR_MANDATORY_BUYER_STATE_CODE: Valid 2-digit buyer state code is mandatory for quotation dispatch.')
        -- At least one line item
        WHEN NOT EXISTS (SELECT 1 FROM quotation_items WHERE quotation_id = NEW.id) THEN
          RAISE(ABORT, 'ERR_NO_LINE_ITEMS: Quotation must have at least one line item before dispatch.')
        -- Every line item must have confirmed GST rate and valid HSN
        WHEN EXISTS (SELECT 1 FROM quotation_items WHERE quotation_id = NEW.id AND gst_rate_bps IS NULL) THEN
          RAISE(ABORT, 'ERR_UNCONFIRMED_GST_RATE: All quotation line items must have confirmed GST rates before dispatch.')
        WHEN EXISTS (SELECT 1 FROM quotation_items WHERE quotation_id = NEW.id AND (hsn_code IS NULL OR length(trim(hsn_code)) < 4)) THEN
          RAISE(ABORT, 'ERR_MANDATORY_HSN_CODE: Valid 4-to-8 digit HSN code is required for all quotation items before dispatch.')
        -- Item-level tax math matches the documented paise-rounding policy: round((taxable_amount_paise * rate_bps) / 10000.0)
        WHEN EXISTS (
          SELECT 1 FROM quotation_items
          WHERE quotation_id = NEW.id
            AND (
              cgst_amount_paise != cast(round((taxable_amount_paise * cgst_rate_bps) / 10000.0) as INTEGER)
              OR sgst_amount_paise != cast(round((taxable_amount_paise * sgst_rate_bps) / 10000.0) as INTEGER)
              OR igst_amount_paise != cast(round((taxable_amount_paise * igst_rate_bps) / 10000.0) as INTEGER)
            )
        ) THEN
          RAISE(ABORT, 'ERR_ITEM_TAX_CALCULATION_MISMATCH: Line item tax amount does not match component rate rounding rule.')
        -- Complete header-to-items parity
        WHEN NEW.subtotal_gross_paise != (SELECT coalesce(sum(gross_amount_paise), 0) FROM quotation_items WHERE quotation_id = NEW.id) THEN
          RAISE(ABORT, 'ERR_FINANCIAL_HEADER_GROSS_MISMATCH: Quotation header subtotal gross does not match sum of items.')
        WHEN NEW.total_discount_paise != (SELECT coalesce(sum(discount_amount_paise), 0) FROM quotation_items WHERE quotation_id = NEW.id) THEN
          RAISE(ABORT, 'ERR_FINANCIAL_HEADER_DISCOUNT_MISMATCH: Quotation header discount does not match sum of items.')
        WHEN NEW.taxable_amount_paise != (SELECT coalesce(sum(taxable_amount_paise), 0) FROM quotation_items WHERE quotation_id = NEW.id) THEN
          RAISE(ABORT, 'ERR_FINANCIAL_HEADER_TAXABLE_MISMATCH: Quotation header taxable amount does not match sum of items.')
        WHEN NEW.cgst_amount_paise != (SELECT coalesce(sum(cgst_amount_paise), 0) FROM quotation_items WHERE quotation_id = NEW.id) THEN
          RAISE(ABORT, 'ERR_FINANCIAL_HEADER_CGST_MISMATCH: Quotation header CGST does not match sum of items.')
        WHEN NEW.sgst_amount_paise != (SELECT coalesce(sum(sgst_amount_paise), 0) FROM quotation_items WHERE quotation_id = NEW.id) THEN
          RAISE(ABORT, 'ERR_FINANCIAL_HEADER_SGST_MISMATCH: Quotation header SGST does not match sum of items.')
        WHEN NEW.igst_amount_paise != (SELECT coalesce(sum(igst_amount_paise), 0) FROM quotation_items WHERE quotation_id = NEW.id) THEN
          RAISE(ABORT, 'ERR_FINANCIAL_HEADER_IGST_MISMATCH: Quotation header IGST does not match sum of items.')
        WHEN NEW.total_tax_paise != (NEW.cgst_amount_paise + NEW.sgst_amount_paise + NEW.igst_amount_paise) THEN
          RAISE(ABORT, 'ERR_FINANCIAL_HEADER_TAX_SUM_MISMATCH: Quotation header total_tax_paise does not equal cgst + sgst + igst.')
        WHEN (NEW.taxable_amount_paise + NEW.total_tax_paise + NEW.round_off_paise) != NEW.total_amount_paise THEN
          RAISE(ABORT, 'ERR_FINANCIAL_TOTAL_MISMATCH: Quotation total amount does not balance.')
        WHEN NEW.apply_round_off = 1 AND (NEW.total_amount_paise % 100 != 0) THEN
          RAISE(ABORT, 'ERR_FINANCIAL_ROUNDOFF_MISMATCH: Quotation applied round-off must yield exact whole rupees.')
      END
  END;

  -- 4. Once quotation has transitioned out of Draft (e.g. Sent, Accepted, Converted, Rejected, Expired), protect all commercial, financial, and buyer details
  SELECT CASE
    WHEN OLD.status IN ('Sent', 'Accepted', 'Converted', 'Rejected', 'Expired') THEN
      CASE
        WHEN NEW.quotation_number IS NOT OLD.quotation_number
          OR NEW.sequence_number IS NOT OLD.sequence_number
          OR NEW.quotation_prefix IS NOT OLD.quotation_prefix
          OR NEW.quotation_date IS NOT OLD.quotation_date
          OR NEW.valid_until IS NOT OLD.valid_until
          OR NEW.financial_year IS NOT OLD.financial_year
          OR (NEW.dispatch_id IS NOT OLD.dispatch_id)
          OR (NEW.sent_at IS NOT OLD.sent_at)
          OR (NEW.sent_to_recipient IS NOT OLD.sent_to_recipient)
          OR NEW.buyer_name IS NOT OLD.buyer_name
          OR (NEW.buyer_company IS NOT OLD.buyer_company)
          OR (NEW.buyer_gstin IS NOT OLD.buyer_gstin)
          OR NEW.buyer_state_code IS NOT OLD.buyer_state_code
          OR NEW.buyer_state_name IS NOT OLD.buyer_state_name
          OR NEW.buyer_address IS NOT OLD.buyer_address
          OR (NEW.buyer_pincode IS NOT OLD.buyer_pincode)
          OR (NEW.buyer_phone IS NOT OLD.buyer_phone)
          OR (NEW.buyer_email IS NOT OLD.buyer_email)
          OR NEW.is_interstate IS NOT OLD.is_interstate
          OR (NEW.place_of_supply IS NOT OLD.place_of_supply)
          OR NEW.currency IS NOT OLD.currency
          OR NEW.subtotal_gross_paise IS NOT OLD.subtotal_gross_paise
          OR NEW.total_discount_paise IS NOT OLD.total_discount_paise
          OR NEW.taxable_amount_paise IS NOT OLD.taxable_amount_paise
          OR NEW.cgst_amount_paise IS NOT OLD.cgst_amount_paise
          OR NEW.sgst_amount_paise IS NOT OLD.sgst_amount_paise
          OR NEW.igst_amount_paise IS NOT OLD.igst_amount_paise
          OR NEW.total_tax_paise IS NOT OLD.total_tax_paise
          OR NEW.apply_round_off IS NOT OLD.apply_round_off
          OR NEW.round_off_paise IS NOT OLD.round_off_paise
          OR NEW.total_amount_paise IS NOT OLD.total_amount_paise
          OR (NEW.payment_terms IS NOT OLD.payment_terms)
          OR (NEW.delivery_terms IS NOT OLD.delivery_terms)
          OR (NEW.notes IS NOT OLD.notes)
          OR NEW.created_at IS NOT OLD.created_at THEN
          RAISE(ABORT, 'ERR_SENT_QUOTATION_IMMUTABLE: Commercial, financial, buyer, address, place of supply, validity, payment terms, notes, and dispatch details of sent or resolved quotations are immutable.')
        WHEN (OLD.client_approval_evidence IS NOT NULL AND NEW.client_approval_evidence IS NOT OLD.client_approval_evidence)
          OR (OLD.accepted_at IS NOT NULL AND NEW.accepted_at IS NOT OLD.accepted_at)
          OR (OLD.rejection_reason IS NOT NULL AND NEW.rejection_reason IS NOT OLD.rejection_reason)
          OR (OLD.rejected_at IS NOT NULL AND NEW.rejected_at IS NOT OLD.rejected_at)
          OR (OLD.converted_invoice_id IS NOT NULL AND NEW.converted_invoice_id IS NOT OLD.converted_invoice_id)
          OR (OLD.status_changed_by IS NOT NULL AND NEW.status_changed_by IS NOT OLD.status_changed_by) THEN
          RAISE(ABORT, 'ERR_EVIDENCE_IMMUTABLE: Quotation approval, rejection, expiry, and conversion evidence cannot be silently modified.')
      END
  END;
END;

-- TRIGGER 15: trg_prevent_quotation_item_insert_after_draft
CREATE TRIGGER trg_prevent_quotation_item_insert_after_draft
BEFORE INSERT ON quotation_items
BEGIN
  SELECT CASE
    WHEN (SELECT status FROM quotations WHERE id = NEW.quotation_id) != 'Draft' THEN
      RAISE(ABORT, 'ERR_QUOTATION_ITEMS_LOCKED: Line items cannot be added to a quotation after it leaves Draft status.')
  END;
END;

-- TRIGGER 16: trg_prevent_quotation_item_update_after_draft
CREATE TRIGGER trg_prevent_quotation_item_update_after_draft
BEFORE UPDATE ON quotation_items
BEGIN
  SELECT CASE
    WHEN (SELECT status FROM quotations WHERE id = OLD.quotation_id) != 'Draft' THEN
      RAISE(ABORT, 'ERR_QUOTATION_ITEMS_LOCKED: Line items of a sent or converted quotation are permanently immutable.')
  END;
END;

-- TRIGGER 17: trg_prevent_quotation_item_delete_after_draft
CREATE TRIGGER trg_prevent_quotation_item_delete_after_draft
BEFORE DELETE ON quotation_items
BEGIN
  SELECT CASE
    WHEN (SELECT status FROM quotations WHERE id = OLD.quotation_id) != 'Draft' THEN
      RAISE(ABORT, 'ERR_QUOTATION_ITEMS_LOCKED: Line items of a sent or converted quotation cannot be deleted.')
  END;
END;

-- TRIGGER 18: trg_prevent_sent_quotation_deletion
CREATE TRIGGER trg_prevent_sent_quotation_deletion
BEFORE DELETE ON quotations
BEGIN
  SELECT CASE
    WHEN OLD.status IN ('Sent', 'Accepted', 'Rejected', 'Expired', 'Converted') THEN
      RAISE(ABORT, 'ERR_LEGAL_RECORD_PROTECTION: Sent, accepted, rejected, expired, or converted quotations are official business records and cannot be deleted.')
  END;
END;

-- TRIGGER 19: trg_prevent_quotation_dispatch_deletion
CREATE TRIGGER trg_prevent_quotation_dispatch_deletion
BEFORE DELETE ON quotation_dispatches
BEGIN
  SELECT RAISE(ABORT, 'ERR_DISPATCH_LOG_DELETION: Quotation dispatch records are permanent audit logs and cannot be deleted.');
END;

-- TRIGGER 20: trg_protect_accepted_quotation_dispatch
CREATE TRIGGER trg_protect_accepted_quotation_dispatch
BEFORE UPDATE ON quotation_dispatches
BEGIN
  SELECT CASE
    WHEN OLD.dispatch_status = 'ACCEPTED' THEN
      RAISE(ABORT, 'ERR_ACCEPTED_DISPATCH_IMMUTABLE: Accepted dispatch records are permanently immutable.')
  END;
END;

-- TRIGGER 21: trg_enforce_quotation_dispatch_insert
CREATE TRIGGER trg_enforce_quotation_dispatch_insert
BEFORE INSERT ON quotation_dispatches
BEGIN
  -- An ACCEPTED dispatch cannot be inserted directly without genuine provider acceptance and message ID
  SELECT CASE
    WHEN NEW.dispatch_status = 'ACCEPTED' AND (NEW.provider_message_id IS NULL OR length(trim(NEW.provider_message_id)) = 0) THEN
      RAISE(ABORT, 'ERR_ACCEPTED_DISPATCH_MISSING_MESSAGE_ID: ACCEPTED dispatch record requires a genuine provider_message_id.')
  END;
END;

-- TRIGGER 22: trg_enforce_quotation_dispatch_fsm
CREATE TRIGGER trg_enforce_quotation_dispatch_fsm
BEFORE UPDATE ON quotation_dispatches
BEGIN
  -- Protect idempotency keys, quotation_id, and recipient_email from mutation across retries
  SELECT CASE
    WHEN NEW.quotation_id IS NOT OLD.quotation_id
      OR NEW.idempotency_key IS NOT OLD.idempotency_key
      OR NEW.provider_idempotency_key IS NOT OLD.provider_idempotency_key
      OR NEW.recipient_email IS NOT OLD.recipient_email THEN
      RAISE(ABORT, 'ERR_DISPATCH_IDENTITY_IMMUTABLE: quotation_id, idempotency_key, provider_idempotency_key, and recipient_email must remain consistent across retries.')
    WHEN NEW.dispatch_status = 'ACCEPTED' AND (NEW.provider_message_id IS NULL OR length(trim(NEW.provider_message_id)) = 0) THEN
      RAISE(ABORT, 'ERR_ACCEPTED_DISPATCH_REQUIRES_MESSAGE_ID: Transition to ACCEPTED requires a genuine provider_message_id.')
  END;
END;

-- TRIGGER 23: trg_prevent_audit_logs_deletion
CREATE TRIGGER trg_prevent_audit_logs_deletion
BEFORE DELETE ON audit_logs
BEGIN
  SELECT RAISE(ABORT, 'ERR_AUDIT_LOG_DELETION: Audit log records are permanent compliance audit trail and cannot be deleted.');
END;

-- TRIGGER 24: trg_prevent_audit_logs_update
CREATE TRIGGER trg_prevent_audit_logs_update
BEFORE UPDATE ON audit_logs
BEGIN
  SELECT RAISE(ABORT, 'ERR_AUDIT_LOG_IMMUTABLE: Audit log records are immutable and cannot be updated.');
END;


