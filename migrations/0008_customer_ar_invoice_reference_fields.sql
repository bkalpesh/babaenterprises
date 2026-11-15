-- ==============================================================================
-- BABA ENTERPRISES — SAFE ADDITIVE MIGRATION 0008
-- Purpose: Customer AR Number, document snapshots, invoice dispatch references,
--          editable invoice dates and server-generated issuance audit timestamp.
-- Additive only: preserves all existing customer and financial document records.
-- Apply to staging only after code review and explicit owner approval.
-- ==============================================================================

ALTER TABLE customers ADD COLUMN ar_number TEXT DEFAULT NULL;
ALTER TABLE quotations ADD COLUMN ar_number TEXT DEFAULT NULL;
ALTER TABLE invoices ADD COLUMN ar_number TEXT DEFAULT NULL;
ALTER TABLE invoices ADD COLUMN gate_pass_number TEXT DEFAULT NULL;
ALTER TABLE invoices ADD COLUMN gate_pass_date TEXT DEFAULT NULL;
ALTER TABLE invoices ADD COLUMN purchase_order_number TEXT DEFAULT NULL;
ALTER TABLE invoices ADD COLUMN purchase_order_date TEXT DEFAULT NULL;
ALTER TABLE invoices ADD COLUMN issued_at TEXT DEFAULT NULL;

-- Populate snapshots only for editable Draft documents. Sent/Accepted quotations and
-- Issued/Cancelled invoices remain historically unchanged.
UPDATE quotations
SET ar_number = (SELECT ar_number FROM customers WHERE customers.id = quotations.customer_id)
WHERE status = 'Draft' AND ar_number IS NULL AND customer_id IS NOT NULL;

UPDATE invoices
SET ar_number = (SELECT ar_number FROM customers WHERE customers.id = invoices.customer_id)
WHERE status = 'Draft' AND ar_number IS NULL AND customer_id IS NOT NULL;

-- Preserve the highest already-issued sequence in every historical financial year.
-- Existing current-year baselines (for example FY 2026-27 = 161) are never reduced.
INSERT INTO invoice_sequence_baselines (financial_year, last_sequence_number, updated_at)
SELECT financial_year, max(sequence_number), datetime('now')
FROM invoices
WHERE status IN ('Issued', 'Cancelled')
  AND sequence_number IS NOT NULL
GROUP BY financial_year
ON CONFLICT(financial_year) DO UPDATE SET
  last_sequence_number = max(invoice_sequence_baselines.last_sequence_number, excluded.last_sequence_number),
  updated_at = datetime('now');

-- Capture the real server-side issuance timestamp and an immutable audit event.
-- The timestamp is intentionally independent of the user-selected invoice_date.
CREATE TRIGGER trg_invoice_issued_timestamp_and_audit
AFTER UPDATE OF status ON invoices
WHEN OLD.status = 'Draft' AND NEW.status = 'Issued'
BEGIN
  UPDATE invoices
  SET issued_at = datetime('now')
  WHERE id = NEW.id AND issued_at IS NULL;

  INSERT INTO audit_logs (id, entity_type, entity_id, action, actor, details_json)
  VALUES (
    'audit-' || lower(hex(randomblob(16))),
    'invoice',
    NEW.id,
    'ISSUED',
    coalesce(
      (SELECT allocated_by FROM invoice_sequence_log WHERE invoice_id = NEW.id),
      'SYSTEM'
    ),
    json_object(
      'invoice_number', NEW.invoice_number,
      'invoice_date', NEW.invoice_date,
      'financial_year', NEW.financial_year,
      'sequence_number', NEW.sequence_number,
      'issued_at', datetime('now')
    )
  );
END;

-- New statutory/reference fields are frozen after issuance, including on cancellation.
CREATE TRIGGER trg_invoice_reference_fields_immutable
BEFORE UPDATE ON invoices
WHEN OLD.status IN ('Issued', 'Cancelled')
 AND (
   NEW.ar_number IS NOT OLD.ar_number
   OR NEW.gate_pass_number IS NOT OLD.gate_pass_number
   OR NEW.gate_pass_date IS NOT OLD.gate_pass_date
   OR NEW.purchase_order_number IS NOT OLD.purchase_order_number
   OR NEW.purchase_order_date IS NOT OLD.purchase_order_date
 )
BEGIN
  SELECT RAISE(ABORT, 'ERR_ISSUED_INVOICE_IMMUTABLE: AR, Gate Pass and Purchase Order references cannot be changed after invoice issuance.');
END;

-- issued_at may be populated once by the issuance trigger, but never rewritten.
CREATE TRIGGER trg_invoice_issued_at_immutable
BEFORE UPDATE OF issued_at ON invoices
WHEN OLD.issued_at IS NOT NULL AND NEW.issued_at IS NOT OLD.issued_at
BEGIN
  SELECT RAISE(ABORT, 'ERR_ISSUED_AT_IMMUTABLE: Actual invoice issuance timestamp cannot be changed.');
END;
