-- ==============================================================================
-- BABA ENTERPRISES — SAFE ADDITIVE MIGRATION 0006
-- Purpose: Create invoice_sequence_baselines table safely and align the
--          invoice sequence contiguity trigger to respect financial-year
--          baselines (including the FY 2026-27 baseline value of 161 applied
--          during the separately authorized staging reset).
-- SAFE & ADDITIVE ONLY: Does not delete, truncate, or reset existing records.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS invoice_sequence_baselines (
  financial_year TEXT PRIMARY KEY,
  last_sequence_number INTEGER NOT NULL CHECK (last_sequence_number >= 0),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

DROP TRIGGER IF EXISTS trg_enforce_invoice_sequence_contiguity;

CREATE TRIGGER trg_enforce_invoice_sequence_contiguity
BEFORE INSERT ON invoice_sequence_log
BEGIN
  -- 1. Assert invoice exists and that financial_year matches the invoice record exactly
  SELECT CASE
    WHEN (SELECT id FROM invoices WHERE id = NEW.invoice_id) IS NULL THEN
      RAISE(ABORT, 'ERR_INVOICE_NOT_FOUND: Invoice does not exist for sequence reservation.')
    WHEN (SELECT financial_year FROM invoices WHERE id = NEW.invoice_id) != NEW.financial_year THEN
      RAISE(ABORT, 'ERR_FINANCIAL_YEAR_MISMATCH: Sequence log financial_year must match the invoice record exactly.')
  END;

  -- 2. Assert strictly contiguous sequence progression respecting any configured baseline
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
