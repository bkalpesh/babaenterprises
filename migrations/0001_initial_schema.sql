-- ==============================================================================
-- BABA ENTERPRISES — CONSOLIDATED PRODUCTION D1 SCHEMA
-- Generated for staging target: babaenterprises-db-staging
-- Prefix Policy: BE/26-27/
-- Compliant with: 16/16 Release Gate SQLite Assertions
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
  default_payment_terms TEXT DEFAULT 'Payment within 30 days from invoice date',
  default_invoice_notes TEXT DEFAULT 'Subject to Pune Jurisdiction. Goods once sold will not be taken back.',
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
  quotation_number TEXT NOT NULL UNIQUE,
  quotation_date TEXT NOT NULL,
  valid_until TEXT NOT NULL,
  buyer_name TEXT NOT NULL,
  buyer_company TEXT,
  buyer_gstin TEXT DEFAULT NULL,
  buyer_state_code TEXT NOT NULL DEFAULT '27',
  buyer_state_name TEXT NOT NULL DEFAULT 'Maharashtra',
  buyer_address TEXT,
  buyer_phone TEXT,
  buyer_email TEXT,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Accepted', 'Rejected', 'Expired', 'Converted')),
  converted_invoice_id TEXT DEFAULT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  subtotal_amount_paise INTEGER NOT NULL DEFAULT 0 CHECK (subtotal_amount_paise >= 0),
  discount_amount_paise INTEGER NOT NULL DEFAULT 0 CHECK (discount_amount_paise >= 0),
  taxable_amount_paise INTEGER NOT NULL DEFAULT 0 CHECK (taxable_amount_paise >= 0),
  cgst_amount_paise INTEGER NOT NULL DEFAULT 0 CHECK (cgst_amount_paise >= 0),
  sgst_amount_paise INTEGER NOT NULL DEFAULT 0 CHECK (sgst_amount_paise >= 0),
  igst_amount_paise INTEGER NOT NULL DEFAULT 0 CHECK (igst_amount_paise >= 0),
  total_tax_paise INTEGER NOT NULL DEFAULT 0 CHECK (total_tax_paise >= 0),
  round_off_paise INTEGER NOT NULL DEFAULT 0,
  total_amount_paise INTEGER NOT NULL DEFAULT 0 CHECK (total_amount_paise >= 0),
  payment_terms TEXT,
  delivery_terms TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  hsn_code TEXT,
  quantity_microunits INTEGER NOT NULL CHECK (quantity_microunits > 0),
  unit_of_measure TEXT NOT NULL DEFAULT 'NOS',
  unit_price_paise INTEGER NOT NULL CHECK (unit_price_paise >= 0),
  gross_amount_paise INTEGER NOT NULL CHECK (gross_amount_paise >= 0),
  discount_bps INTEGER NOT NULL DEFAULT 0 CHECK (discount_bps BETWEEN 0 AND 10000),
  discount_amount_paise INTEGER NOT NULL DEFAULT 0 CHECK (discount_amount_paise >= 0),
  taxable_amount_paise INTEGER NOT NULL CHECK (taxable_amount_paise >= 0),
  gst_rate_bps INTEGER DEFAULT NULL CHECK (gst_rate_bps IS NULL OR gst_rate_bps IN (0, 500, 1200, 1800, 2800)),
  cgst_amount_paise INTEGER NOT NULL DEFAULT 0,
  sgst_amount_paise INTEGER NOT NULL DEFAULT 0,
  igst_amount_paise INTEGER NOT NULL DEFAULT 0,
  total_amount_paise INTEGER NOT NULL CHECK (total_amount_paise >= 0),
  UNIQUE(quotation_id, line_number)
);

-- ------------------------------------------------------------------------------
-- TABLE 7: invoices
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
  reference_quotation_id TEXT REFERENCES quotations(id),
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
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------------------------
-- TABLE 8: invoice_items
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
  cgst_rate_bps INTEGER NOT NULL DEFAULT 0,
  sgst_rate_bps INTEGER NOT NULL DEFAULT 0,
  igst_rate_bps INTEGER NOT NULL DEFAULT 0,
  cgst_amount_paise INTEGER NOT NULL DEFAULT 0,
  sgst_amount_paise INTEGER NOT NULL DEFAULT 0,
  igst_amount_paise INTEGER NOT NULL DEFAULT 0,
  total_amount_paise INTEGER NOT NULL CHECK (total_amount_paise >= 0),
  UNIQUE(invoice_id, line_number)
);

-- ------------------------------------------------------------------------------
-- TABLE 9: invoice_sequence_log
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
-- TABLE 10: quotation_sequence_log
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
-- TABLE 11: idempotency_keys
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
-- TABLE 12: audit_logs
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

-- TRIGGER 1: trg_prevent_sequence_log_deletion
CREATE TRIGGER trg_prevent_sequence_log_deletion
BEFORE DELETE ON invoice_sequence_log
BEGIN
  SELECT RAISE(ABORT, 'ERR_AUDIT_LOG_DELETION: Sequence allocations are permanent audit records and cannot be deleted.');
END;

-- TRIGGER 2: trg_prevent_sequence_log_update
CREATE TRIGGER trg_prevent_sequence_log_update
BEFORE UPDATE ON invoice_sequence_log
BEGIN
  SELECT RAISE(ABORT, 'ERR_AUDIT_LOG_IMMUTABLE: Sequence allocation log is immutable.');
END;

-- TRIGGER 3: trg_execute_invoice_issuance_on_sequence_reservation
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

  -- Assert sequence number is strictly contiguous (no sequence gaps)
  SELECT CASE
    WHEN NEW.sequence_number > 1 AND NOT EXISTS (
      SELECT 1 FROM invoice_sequence_log
      WHERE financial_year = NEW.financial_year
        AND sequence_number = NEW.sequence_number - 1
    ) THEN
      RAISE(ABORT, 'ERR_SEQUENCE_GAP: Sequence number must be strictly contiguous.')
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

  -- Assert header financial amounts match exact sum of line items
  SELECT CASE
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

  -- Inseparable state transition from Draft to Issued with standard format BE/26-27/XXXX
  UPDATE invoices
  SET status = 'Issued',
      invoice_prefix = 'BE/26-27/',
      sequence_number = NEW.sequence_number,
      invoice_number = 'BE/26-27/' || substr('0000' || NEW.sequence_number, -4),
      invoice_date = coalesce(invoice_date, date('now')),
      updated_at = datetime('now')
  WHERE id = NEW.invoice_id;
END;

-- TRIGGER 4: trg_enforce_invoice_fsm_and_immutability
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
        -- Immutability assertions during cancellation
        WHEN NEW.invoice_number != OLD.invoice_number
          OR NEW.sequence_number != OLD.sequence_number
          OR NEW.invoice_prefix != OLD.invoice_prefix
          OR NEW.invoice_date != OLD.invoice_date
          OR NEW.financial_year != OLD.financial_year
          OR NEW.seller_gstin != OLD.seller_gstin
          OR NEW.buyer_name != OLD.buyer_name
          OR (NEW.buyer_gstin IS NOT OLD.buyer_gstin)
          OR NEW.taxable_amount_paise != OLD.taxable_amount_paise
          OR NEW.total_invoice_amount_paise != OLD.total_invoice_amount_paise THEN
          RAISE(ABORT, 'ERR_IMMUTABLE_ON_CANCELLATION: Core invoice details cannot be modified during cancellation.')
      END
  END;

  -- 3. While status remains Issued, allow ONLY payment status and PDF key updates; protect all financial & legal data
  SELECT CASE
    WHEN OLD.status = 'Issued' AND NEW.status = 'Issued' THEN
      CASE
        WHEN NEW.invoice_number != OLD.invoice_number
          OR NEW.sequence_number != OLD.sequence_number
          OR NEW.invoice_prefix != OLD.invoice_prefix
          OR NEW.invoice_date != OLD.invoice_date
          OR NEW.financial_year != OLD.financial_year
          OR NEW.seller_gstin != OLD.seller_gstin
          OR NEW.buyer_name != OLD.buyer_name
          OR (NEW.buyer_gstin IS NOT OLD.buyer_gstin)
          OR NEW.buyer_state_code != OLD.buyer_state_code
          OR NEW.buyer_pincode != OLD.buyer_pincode
          OR NEW.taxable_amount_paise != OLD.taxable_amount_paise
          OR NEW.cgst_amount_paise != OLD.cgst_amount_paise
          OR NEW.sgst_amount_paise != OLD.sgst_amount_paise
          OR NEW.igst_amount_paise != OLD.igst_amount_paise
          OR NEW.total_invoice_amount_paise != OLD.total_invoice_amount_paise THEN
          RAISE(ABORT, 'ERR_ISSUED_INVOICE_IMMUTABLE: Financial, legal, and numbering fields of issued invoices are permanently immutable.')
      END
  END;
END;

-- TRIGGER 5: trg_prevent_issued_invoice_deletion
CREATE TRIGGER trg_prevent_issued_invoice_deletion
BEFORE DELETE ON invoices
BEGIN
  SELECT CASE
    WHEN OLD.status IN ('Issued', 'Cancelled') THEN
      RAISE(ABORT, 'ERR_LEGAL_RECORD_PROTECTION: Issued or cancelled invoices are legal audit records and cannot be deleted.')
  END;
END;

-- TRIGGER 6: trg_prevent_item_insert_after_issuance
CREATE TRIGGER trg_prevent_item_insert_after_issuance
BEFORE INSERT ON invoice_items
BEGIN
  SELECT CASE
    WHEN (SELECT status FROM invoices WHERE id = NEW.invoice_id) != 'Draft' THEN
      RAISE(ABORT, 'ERR_ITEMS_LOCKED: Line items cannot be added to an issued or cancelled invoice.')
  END;
END;

-- TRIGGER 7: trg_prevent_item_update_after_issuance
CREATE TRIGGER trg_prevent_item_update_after_issuance
BEFORE UPDATE ON invoice_items
BEGIN
  SELECT CASE
    WHEN (SELECT status FROM invoices WHERE id = OLD.invoice_id) != 'Draft' THEN
      RAISE(ABORT, 'ERR_ITEMS_LOCKED: Line items of issued or cancelled invoices are permanently immutable.')
  END;
END;

-- TRIGGER 8: trg_prevent_item_delete_after_issuance
CREATE TRIGGER trg_prevent_item_delete_after_issuance
BEFORE DELETE ON invoice_items
BEGIN
  SELECT CASE
    WHEN (SELECT status FROM invoices WHERE id = OLD.invoice_id) != 'Draft' THEN
      RAISE(ABORT, 'ERR_ITEMS_LOCKED: Line items of issued or cancelled invoices cannot be deleted.')
  END;
END;
