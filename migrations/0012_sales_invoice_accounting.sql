-- BABA ENTERPRISES
-- Migration 0012: Sales invoice accounting support
-- Adds a dedicated leaf ledger for invoice-level rounding differences.
-- No vouchers are created and no existing invoice data is changed.

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO ledger_accounts
  (id, account_code, name, parent_account_id, account_type, normal_balance,
   is_group, is_control_account, system_managed, is_active)
VALUES
  ('acc-5600', '5600', 'Round-off', 'acc-5300', 'Expense', 'Debit',
   0, 0, 1, 1);
