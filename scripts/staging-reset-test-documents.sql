-- BABA ENTERPRISES STAGING-ONLY TEST DOCUMENT RESET
-- Target database: babaenterprises-db-staging
-- This permanently deletes staging quotations, invoices, their items, dispatch rows,
-- and their sequence allocations. Products, customers, business settings, and audit_logs remain.
-- Do NOT run against production.
-- Run the complete script as one operation. If your SQL console rejects BEGIN/COMMIT,
-- stop and use a D1 migration/batch execution rather than running statements piecemeal.

BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS invoice_sequence_baselines (
  financial_year TEXT PRIMARY KEY,
  last_sequence_number INTEGER NOT NULL CHECK (last_sequence_number >= 0),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO invoice_sequence_baselines (financial_year, last_sequence_number)
VALUES ('2026-27', 161)
ON CONFLICT(financial_year) DO UPDATE SET
  last_sequence_number = excluded.last_sequence_number,
  updated_at = datetime('now');

-- Temporarily remove document and sequence protections only inside this reset transaction.
DROP TRIGGER IF EXISTS trg_prevent_invoice_sequence_log_deletion;
DROP TRIGGER IF EXISTS trg_prevent_invoice_sequence_log_update;
DROP TRIGGER IF EXISTS trg_enforce_invoice_sequence_contiguity;
DROP TRIGGER IF EXISTS trg_prevent_quotation_sequence_log_deletion;
DROP TRIGGER IF EXISTS trg_prevent_quotation_sequence_log_update;
DROP TRIGGER IF EXISTS trg_enforce_quotation_sequence_contiguity;
DROP TRIGGER IF EXISTS trg_execute_quotation_issuance_on_sequence_reservation;
DROP TRIGGER IF EXISTS trg_execute_invoice_issuance_on_sequence_reservation;
DROP TRIGGER IF EXISTS trg_enforce_invoice_fsm_and_immutability;
DROP TRIGGER IF EXISTS trg_prevent_issued_invoice_deletion;
DROP TRIGGER IF EXISTS trg_prevent_item_insert_after_issuance;
DROP TRIGGER IF EXISTS trg_prevent_item_update_after_issuance;
DROP TRIGGER IF EXISTS trg_prevent_item_delete_after_issuance;
DROP TRIGGER IF EXISTS trg_enforce_quotation_fsm_and_immutability;
DROP TRIGGER IF EXISTS trg_prevent_quotation_item_insert_after_draft;
DROP TRIGGER IF EXISTS trg_prevent_quotation_item_update_after_draft;
DROP TRIGGER IF EXISTS trg_prevent_quotation_item_delete_after_draft;
DROP TRIGGER IF EXISTS trg_prevent_sent_quotation_deletion;
DROP TRIGGER IF EXISTS trg_prevent_quotation_dispatch_deletion;
DROP TRIGGER IF EXISTS trg_protect_accepted_quotation_dispatch;
DROP TRIGGER IF EXISTS trg_enforce_quotation_dispatch_insert;
DROP TRIGGER IF EXISTS trg_enforce_quotation_dispatch_fsm;
DROP TRIGGER IF EXISTS trg_prevent_audit_logs_deletion;
DROP TRIGGER IF EXISTS trg_prevent_audit_logs_update;

-- Break the circular quotation/invoice/dispatch references before deleting records.
UPDATE quotations
SET dispatch_id = NULL, converted_invoice_id = NULL;
UPDATE invoices
SET reference_quotation_id = NULL;

-- Remove sequence allocations first because they reference the documents.
DELETE FROM invoice_sequence_log;
DELETE FROM quotation_sequence_log;

-- Dispatch rows use ON DELETE RESTRICT and therefore must be removed before quotations.
DELETE FROM quotation_dispatches;

-- Items are removed by their document ON DELETE CASCADE relationships.
DELETE FROM quotations;
DELETE FROM invoices;

-- Restore the complete original trigger set, with invoice numbering honoring baseline 161.
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
  SELECT CASE
    WHEN (SELECT id FROM invoices WHERE id = NEW.invoice_id) IS NULL THEN
      RAISE(ABORT, 'ERR_INVOICE_NOT_FOUND: Invoice does not exist for sequence reservation.')
    WHEN (SELECT financial_year FROM invoices WHERE id = NEW.invoice_id) != NEW.financial_year THEN
      RAISE(ABORT, 'ERR_FINANCIAL_YEAR_MISMATCH: Sequence log financial_year must match the invoice record exactly.')
  END;
  SELECT CASE
    WHEN NEW.sequence_number != (
      SELECT max(
        coalesce((SELECT last_sequence_number FROM invoice_sequence_baselines WHERE financial_year = NEW.financial_year), 0),
        coalesce((SELECT max(sequence_number) FROM invoice_sequence_log WHERE financial_year = NEW.financial_year), 0)
      ) + 1
    ) THEN
      RAISE(ABORT, 'ERR_SEQUENCE_GAP: Invoice sequence must be the next number after the configured baseline and prior allocations.')
  END;
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

COMMIT;
