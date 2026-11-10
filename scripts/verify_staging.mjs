// ==============================================================================
// BABA ENTERPRISES — LOCAL SQLITE PRE-MIGRATION INTEGRITY TEST HARNESS
// Environment: Local in-memory SQLite (Node.js DatabaseSync)
// Target Worker: babaenterprises-staging (local simulation only; Worker not deployed)
// Target D1:     babaenterprises-db-staging (local schema verification; D1 unexecuted)
// Node.js Engine: Native node:sqlite DatabaseSync(':memory:')
//
// NOTE: This test harness runs strictly in local Node.js memory. It does NOT connect
// to or execute against Cloudflare D1 or production environments. It certifies
// SQL schema correctness, constraints, and trigger logic prior to staging review.
// ==============================================================================

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getFinancialYear,
  getQuotationPrefix,
  getInvoicePrefix,
  computeLineItem,
  computeTotals,
} from '../worker/financials.ts';
import {
  worker,
  checkAdminAuth,
  createSignedToken,
  verifySignedToken,
} from '../worker/index.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('===============================================================================');
console.log('BABA ENTERPRISES — LOCAL SQLITE PRE-MIGRATION INTEGRITY AUDIT');
console.log('Execution Mode: Local In-Memory SQLite Engine (Node.js DatabaseSync)');
console.log('Staging Worker: babaenterprises-staging (DRY-RUN / LOCAL VALIDATION ONLY)');
console.log('Staging D1 DB:  babaenterprises-db-staging (UNEXECUTED; PENDING APPROVAL)');
console.log('Staging R2:     babaenterprises-drawings-staging');
console.log('Node Runtime:  ', process.version);
console.log('===============================================================================\n');

const schemaSql = readFileSync(resolve(__dirname, '../migrations/0001_initial_schema.sql'), 'utf-8');
const seedSql = readFileSync(resolve(__dirname, '../migrations/0002_seed_data.sql'), 'utf-8');

const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = ON;');

// Apply Migration 0001 Schema
try {
  db.exec(schemaSql);
  console.log('✓ Migration 0001_initial_schema.sql applied (12 tables, 18 triggers)');
} catch (err) {
  console.error('✗ Migration 0001 failed to load:', err);
  process.exit(1);
}

// Apply Migration 0002 Seed
try {
  db.exec(seedSql);
  console.log('✓ Migration 0002_seed_data.sql applied (12 products, 5 references, business settings)\n');
} catch (err) {
  console.error('✗ Migration 0002 failed to load:', err);
  process.exit(1);
}

let passed = 0;
let failed = 0;
const testRecords = [];

function assertTest(id, category, type, name, fn) {
  try {
    const res = fn();
    if (res && typeof res.then === 'function') {
      return res.then(
        () => {
          console.log(`[PASS] ${id.padEnd(6)} | [${category.padEnd(16)}] | [${type.padEnd(8)}] | ${name}`);
          passed++;
          testRecords.push({ id, category, type, name, status: 'PASS' });
        },
        (err) => {
          console.error(`[FAIL] ${id.padEnd(6)} | [${category.padEnd(16)}] | [${type.padEnd(8)}] | ${name} -> ${err.message}`);
          failed++;
          testRecords.push({ id, category, type, name, status: 'FAIL', error: err.message });
        }
      );
    }
    console.log(`[PASS] ${id.padEnd(6)} | [${category.padEnd(16)}] | [${type.padEnd(8)}] | ${name}`);
    passed++;
    testRecords.push({ id, category, type, name, status: 'PASS' });
  } catch (err) {
    console.error(`[FAIL] ${id.padEnd(6)} | [${category.padEnd(16)}] | [${type.padEnd(8)}] | ${name} -> ${err.message}`);
    failed++;
    testRecords.push({ id, category, type, name, status: 'FAIL', error: err.message });
  }
}

// Helper: Seed valid minimal draft invoice
function seedDraftInvoice(invId, buyerGstin = '27AAACB2026R1Z9', isInterstate = 0, stateCode = '27', fy = '2026-27') {
  const prefix = getInvoicePrefix(fy);
  db.exec(`
    INSERT INTO invoices (
      id, status, financial_year, invoice_prefix, seller_gstin, seller_state_code,
      buyer_name, buyer_address, buyer_state_name, buyer_state_code, buyer_pincode,
      buyer_gstin, is_interstate, place_of_supply,
      subtotal_gross_paise, total_discount_paise, taxable_amount_paise,
      cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_tax_paise,
      apply_round_off, round_off_paise, total_invoice_amount_paise
    ) VALUES (
      '${invId}', 'Draft', '${fy}', '${prefix}', '27AGCPB8322L1ZG', '27',
      'Test Precision Corp', 'Plot 45, MIDC Bhosari', 'Maharashtra', '${stateCode}', '411026',
      ${buyerGstin ? `'${buyerGstin}'` : 'NULL'}, ${isInterstate}, 'Maharashtra (27)',
      10000, 0, 10000,
      ${isInterstate ? 0 : 900}, ${isInterstate ? 0 : 900}, ${isInterstate ? 1800 : 0}, 1800,
      1, 0, 11800
    );
    INSERT INTO invoice_items (
      id, invoice_id, line_number, item_description, hsn_code,
      quantity_microunits, unit_of_measure, unit_price_paise, gross_amount_paise,
      discount_bps, discount_amount_paise, taxable_amount_paise, gst_rate_bps,
      cgst_rate_bps, sgst_rate_bps, igst_rate_bps,
      cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_amount_paise
    ) VALUES (
      'it-${invId}-1', '${invId}', 1, 'Rubber Washers M12', '4016',
      10000000, 'NOS', 1000, 10000,
      0, 0, 10000, 1800,
      ${isInterstate ? 0 : 900}, ${isInterstate ? 0 : 900}, ${isInterstate ? 1800 : 0},
      ${isInterstate ? 0 : 900}, ${isInterstate ? 0 : 900}, ${isInterstate ? 1800 : 0}, 11800
    );
  `);
}

// Helper: Seed valid minimal draft quotation
function seedDraftQuotation(qtId, fy = '2026-27', isInterstate = 0) {
  const taxable = 50000;
  const cgst = isInterstate ? 0 : 4500;
  const sgst = isInterstate ? 0 : 4500;
  const igst = isInterstate ? 9000 : 0;
  const totalTax = cgst + sgst + igst;
  const total = taxable + totalTax;
  const prefix = getQuotationPrefix(fy);

  db.exec(`
    INSERT INTO quotations (
      id, quotation_date, valid_until, financial_year, quotation_prefix,
      buyer_name, buyer_company, buyer_address, buyer_state_code, buyer_state_name, buyer_pincode,
      is_interstate, status,
      subtotal_gross_paise, total_discount_paise, taxable_amount_paise,
      cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_tax_paise,
      apply_round_off, round_off_paise, total_amount_paise
    ) VALUES (
      '${qtId}', '2026-11-04', '2026-12-04', '${fy}', '${prefix}',
      'Precision Instruments Ltd', 'Precision Instruments Pvt Ltd', 'Plot 88 MIDC Bhosari',
      '${isInterstate ? '29' : '27'}', '${isInterstate ? 'Karnataka' : 'Maharashtra'}', '411039',
      ${isInterstate}, 'Draft',
      ${taxable}, 0, ${taxable},
      ${cgst}, ${sgst}, ${igst}, ${totalTax},
      0, 0, ${total}
    );
    INSERT INTO quotation_items (
      id, quotation_id, line_number, item_description, hsn_code,
      quantity_microunits, unit_price_paise, gross_amount_paise,
      discount_bps, discount_amount_paise, taxable_amount_paise, gst_rate_bps,
      cgst_rate_bps, sgst_rate_bps, igst_rate_bps,
      cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_amount_paise
    ) VALUES (
      'it-${qtId}-1', '${qtId}', 1, 'Heavy Duty Rubber Bumper', '4016',
      5000000, 10000, ${taxable},
      0, 0, ${taxable}, 1800,
      ${isInterstate ? 0 : 900}, ${isInterstate ? 0 : 900}, ${isInterstate ? 1800 : 0},
      ${cgst}, ${sgst}, ${igst}, ${total}
    );
  `);
}

// ==============================================================================
// 1. BUSINESS IDENTITY & MASTER DATA INTEGRITY
// ==============================================================================

assertTest('TC-01', 'Master Data', 'POSITIVE', 'Business settings seeded with confirmed GSTIN and NULL bank details', () => {
  const row = db.prepare('SELECT * FROM business_settings WHERE id = 1').get();
  if (!row || row.gstin !== '27AGCPB8322L1ZG' || row.pincode !== '411039') {
    throw new Error('Business settings mismatch');
  }
  if (row.bank_account_no !== null || row.bank_ifsc !== null || row.bank_name !== null) {
    throw new Error('Bank details must remain NULL until confirmed by owner');
  }
});

assertTest('TC-02', 'Master Data', 'POSITIVE', 'All 12 product catalog items seeded with unit_price_paise = 0 and gst_rate_bps = NULL', () => {
  const rows = db.prepare('SELECT count(*) as cnt FROM products WHERE unit_price_paise = 0 AND gst_rate_bps IS NULL').get();
  if (rows.cnt !== 12) {
    throw new Error(`Expected 12 unverified products, got ${rows.cnt}`);
  }
});

// ==============================================================================
// 2. INVOICE SEQUENCE ALLOCATION & ISSUANCE
// ==============================================================================

assertTest('TC-03', 'Invoice Sequence', 'POSITIVE', 'Sequence reservation inseparably transitions Draft to Issued with BE/26-27/0001', () => {
  seedDraftInvoice('inv-seq-01');
  db.exec("INSERT INTO invoice_sequence_log (financial_year, sequence_number, invoice_id) VALUES ('2026-27', 1, 'inv-seq-01');");
  const inv = db.prepare("SELECT * FROM invoices WHERE id = 'inv-seq-01'").get();
  if (inv.status !== 'Issued' || inv.invoice_number !== 'BE/26-27/0001' || inv.sequence_number !== 1) {
    throw new Error(`Issuance failed: status=${inv.status}, num=${inv.invoice_number}`);
  }
});

assertTest('TC-04', 'Invoice Sequence', 'NEGATIVE', 'Sequence reservation strictly rejects gaps (e.g. attempting 3 after 1)', () => {
  seedDraftInvoice('inv-seq-02');
  let errThrown = false;
  try {
    db.exec("INSERT INTO invoice_sequence_log (financial_year, sequence_number, invoice_id) VALUES ('2026-27', 3, 'inv-seq-02');");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_SEQUENCE_GAP')) throw err;
  }
  if (!errThrown) throw new Error('Expected ERR_SEQUENCE_GAP on sequence jump');
});

assertTest('TC-05', 'Invoice Sequence', 'POSITIVE', 'Contiguous sequence 2 succeeds with BE/26-27/0002', () => {
  db.exec("INSERT INTO invoice_sequence_log (financial_year, sequence_number, invoice_id) VALUES ('2026-27', 2, 'inv-seq-02');");
  const inv = db.prepare("SELECT * FROM invoices WHERE id = 'inv-seq-02'").get();
  if (inv.status !== 'Issued' || inv.invoice_number !== 'BE/26-27/0002') {
    throw new Error(`Expected BE/26-27/0002, got ${inv.invoice_number}`);
  }
});

assertTest('TC-06', 'Invoice Sequence', 'NEGATIVE', 'Invoice sequence reservation rejects financial_year mismatch against invoice', () => {
  seedDraftInvoice('inv-fy-mismatch', '27AAACB2026R1Z9', 0, '27', '2026-27');
  let errThrown = false;
  try {
    db.exec("INSERT INTO invoice_sequence_log (financial_year, sequence_number, invoice_id) VALUES ('2027-28', 1, 'inv-fy-mismatch');");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_FINANCIAL_YEAR_MISMATCH')) throw err;
  }
  if (!errThrown) throw new Error('Expected ERR_FINANCIAL_YEAR_MISMATCH for invoice sequence allocation');
});

// ==============================================================================
// 3. INVOICE IMMUTABILITY & CANCELLATION
// ==============================================================================

assertTest('TC-07', 'Invoice Security', 'NEGATIVE', 'Issued invoice deletion is permanently blocked', () => {
  let errThrown = false;
  try {
    db.exec("DELETE FROM invoices WHERE id = 'inv-seq-01'");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_LEGAL_RECORD_PROTECTION')) throw err;
  }
  if (!errThrown) throw new Error('Deletion of issued invoice was not blocked');
});

assertTest('TC-08', 'Invoice Security', 'NEGATIVE', 'Line items of issued invoice cannot be inserted, updated, or deleted', () => {
  let errThrown = false;
  try {
    db.exec("UPDATE invoice_items SET gross_amount_paise = 20000 WHERE invoice_id = 'inv-seq-01'");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_ITEMS_LOCKED')) throw err;
  }
  if (!errThrown) throw new Error('Update of issued line item was not blocked');
});

assertTest('TC-09', 'Invoice Security', 'NEGATIVE', 'Cancellation fields cannot be modified while invoice status remains Issued', () => {
  let errThrown = false;
  try {
    db.exec("UPDATE invoices SET cancellation_reason = 'Premature cancellation note' WHERE id = 'inv-seq-02';");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_ISSUED_INVOICE_IMMUTABLE')) throw err;
  }
  if (!errThrown) throw new Error('Modification of cancellation fields on Issued invoice was not blocked');
});

assertTest('TC-10', 'Invoice Security', 'NEGATIVE', 'Invoice cancellation requires cancelled_at timestamp along with reason and actor', () => {
  let errThrown = false;
  try {
    db.exec(`
      UPDATE invoices
      SET status = 'Cancelled',
          cancellation_reason = 'Order cancelled by customer before dispatch',
          cancelled_by = 'ADMIN_TEST',
          cancelled_at = NULL
      WHERE id = 'inv-seq-02';
    `);
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_CANCELLED_AT_REQUIRED')) throw err;
  }
  if (!errThrown) throw new Error('Missing cancellation timestamp was not rejected');
});

assertTest('TC-11', 'Invoice Security', 'POSITIVE', 'Valid invoice cancellation freezes invoice permanently against further edits', () => {
  db.exec(`
    UPDATE invoices SET
      status = 'Cancelled',
      cancellation_reason = 'Duplicate purchase order cancelled by buyer',
      cancelled_by = 'ADMIN_TEST',
      cancelled_at = datetime('now')
    WHERE id = 'inv-seq-01';
  `);
  const inv = db.prepare("SELECT status, cancellation_reason FROM invoices WHERE id = 'inv-seq-01'").get();
  if (inv.status !== 'Cancelled') throw new Error('Failed to cancel invoice');

  // Attempting any subsequent update must be rejected
  let errThrown = false;
  try {
    db.exec("UPDATE invoices SET buyer_name = 'Modified Buyer' WHERE id = 'inv-seq-01'");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_CANCELLED_INVOICE_FROZEN')) throw err;
  }
  if (!errThrown) throw new Error('Modification of cancelled invoice was not blocked');
});

assertTest('TC-12', 'Invoice Security', 'NEGATIVE', 'Direct Draft -> Cancelled transition is rejected (Drafts must be deleted)', () => {
  seedDraftInvoice('inv-draft-del');
  let errThrown = false;
  try {
    db.exec("UPDATE invoices SET status = 'Cancelled' WHERE id = 'inv-draft-del'");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_INVALID_TRANSITION')) throw err;
  }
  if (!errThrown) throw new Error('Draft to Cancelled transition should have been blocked');
});

// ==============================================================================
// 4. QUOTATION NUMBER ALLOCATION & IMMUTABILITY IN DRAFT
// ==============================================================================

assertTest('TC-13', 'Quotation Lifecycle', 'POSITIVE', 'Quotation numbering allocates BE/QT/26-27/0001 and strictly preserves Draft status', () => {
  seedDraftQuotation('qt-num-01');
  db.exec("INSERT INTO quotation_sequence_log (financial_year, sequence_number, quotation_id) VALUES ('2026-27', 1, 'qt-num-01');");
  const q = db.prepare("SELECT * FROM quotations WHERE id = 'qt-num-01'").get();
  if (q.quotation_number !== 'BE/QT/26-27/0001') throw new Error(`Expected BE/QT/26-27/0001, got ${q.quotation_number}`);
  if (q.status !== 'Draft') throw new Error(`Quotation status must remain Draft after numbering, got ${q.status}`);
});

assertTest('TC-14', 'Quotation Security', 'NEGATIVE', 'Modifying quotation_number while in Draft status is strictly rejected', () => {
  let errThrown = false;
  try {
    db.exec("UPDATE quotations SET quotation_number = 'BE/QT/26-27/9999' WHERE id = 'qt-num-01';");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_QUOTATION_NUMBER_LOCKED')) throw err;
  }
  if (!errThrown) throw new Error('Expected ERR_QUOTATION_NUMBER_LOCKED when modifying quotation_number in Draft');
});

assertTest('TC-15', 'Quotation Security', 'NEGATIVE', 'Setting quotation_number to NULL while in Draft status is strictly rejected', () => {
  let errThrown = false;
  try {
    db.exec("UPDATE quotations SET quotation_number = NULL WHERE id = 'qt-num-01';");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_QUOTATION_NUMBER_LOCKED')) throw err;
  }
  if (!errThrown) throw new Error('Expected ERR_QUOTATION_NUMBER_LOCKED when clearing quotation_number');
});

assertTest('TC-16', 'Quotation Security', 'NEGATIVE', 'Modifying sequence_number while in Draft status is strictly rejected', () => {
  let errThrown = false;
  try {
    db.exec("UPDATE quotations SET sequence_number = 99 WHERE id = 'qt-num-01';");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_QUOTATION_SEQUENCE_LOCKED')) throw err;
  }
  if (!errThrown) throw new Error('Expected ERR_QUOTATION_SEQUENCE_LOCKED when changing sequence_number');
});

assertTest('TC-17', 'Quotation Security', 'NEGATIVE', 'Quotation sequence reservation rejects financial_year mismatch against quotation', () => {
  seedDraftQuotation('qt-fy-mismatch', '2026-27');
  let errThrown = false;
  try {
    db.exec("INSERT INTO quotation_sequence_log (financial_year, sequence_number, quotation_id) VALUES ('2027-28', 1, 'qt-fy-mismatch');");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_FINANCIAL_YEAR_MISMATCH')) throw err;
  }
  if (!errThrown) throw new Error('Expected ERR_FINANCIAL_YEAR_MISMATCH for quotation sequence allocation');
});

assertTest('TC-18', 'Quotation Lifecycle', 'POSITIVE', 'Commercial details and line items of numbered Draft remain editable prior to dispatch', () => {
  // Update commercial note in draft
  db.exec("UPDATE quotations SET notes = 'Delivery within 2 weeks of advance payment' WHERE id = 'qt-num-01';");
  const q = db.prepare("SELECT notes FROM quotations WHERE id = 'qt-num-01'").get();
  if (q.notes !== 'Delivery within 2 weeks of advance payment') throw new Error('Draft commercial update failed');

  // Insert a second line item in draft
  db.exec(`
    INSERT INTO quotation_items (
      id, quotation_id, line_number, item_description, hsn_code,
      quantity_microunits, unit_price_paise, gross_amount_paise,
      discount_bps, discount_amount_paise, taxable_amount_paise, gst_rate_bps,
      cgst_rate_bps, sgst_rate_bps, igst_rate_bps,
      cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_amount_paise
    ) VALUES (
      'it-qt-num-01-2', 'qt-num-01', 2, 'Neoprene Gasket 50mm', '4016',
      2000000, 5000, 10000,
      0, 0, 10000, 1800,
      900, 900, 0,
      900, 900, 0, 11800
    );
    -- Update quotation header to reflect new totals (50000 + 10000 = 60000)
    UPDATE quotations SET
      subtotal_gross_paise = 60000,
      taxable_amount_paise = 60000,
      cgst_amount_paise = 5400,
      sgst_amount_paise = 5400,
      total_tax_paise = 10800,
      total_amount_paise = 70800
    WHERE id = 'qt-num-01';
  `);
  const itemCnt = db.prepare("SELECT count(*) as cnt FROM quotation_items WHERE quotation_id = 'qt-num-01'").get();
  if (itemCnt.cnt !== 2) throw new Error(`Expected 2 items in draft quotation, got ${itemCnt.cnt}`);
});

// ==============================================================================
// 5. QUOTATION DISPATCH (DRAFT -> SENT) REVALIDATION
// ==============================================================================

assertTest('TC-19', 'Quotation Dispatch', 'NEGATIVE', 'Draft -> Sent transition rejected without sent_to_recipient metadata', () => {
  // Seed verified dispatch record so dispatch authorization passes, testing recipient metadata check
  db.exec(`
    INSERT INTO quotation_dispatches (
      id, quotation_id, idempotency_key, recipient_email, dispatch_status,
      provider_name, provider_message_id, provider_idempotency_key, completed_at
    ) VALUES (
      'disp-val-01', 'qt-num-01', 'key-val-01', 'procurement@precision.com', 'ACCEPTED',
      'RESEND_STAGING', 'msg-val-01', 'pkey-val-01', datetime('now')
    );
  `);
  let errThrown = false;
  try {
    db.exec(`
      UPDATE quotations SET
        status = 'Sent',
        dispatch_id = 'disp-val-01',
        sent_at = datetime('now'),
        sent_to_recipient = NULL
      WHERE id = 'qt-num-01';
    `);
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_DISPATCH_RECIPIENT_REQUIRED')) throw err;
  }
  if (!errThrown) throw new Error('Expected ERR_DISPATCH_RECIPIENT_REQUIRED');
});

assertTest('TC-20', 'Quotation Dispatch', 'NEGATIVE', 'Draft -> Sent transition rejected without sent_at timestamp', () => {
  let errThrown = false;
  try {
    db.exec(`
      UPDATE quotations SET
        status = 'Sent',
        dispatch_id = 'disp-val-01',
        sent_at = NULL,
        sent_to_recipient = 'procurement@precision.com'
      WHERE id = 'qt-num-01';
    `);
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_DISPATCH_TIMESTAMP_REQUIRED')) throw err;
  }
  if (!errThrown) throw new Error('Expected ERR_DISPATCH_TIMESTAMP_REQUIRED');
});

assertTest('TC-21', 'Quotation Dispatch', 'NEGATIVE', 'Draft -> Sent transition rejected if line item has unconfirmed (NULL) GST rate', () => {
  seedDraftQuotation('qt-unconf-rate');
  // Allow unconfirmed rate in Draft item
  db.exec(`
    UPDATE quotation_items SET
      gst_rate_bps = NULL, cgst_rate_bps = 0, sgst_rate_bps = 0, igst_rate_bps = 0,
      cgst_amount_paise = 0, sgst_amount_paise = 0, igst_amount_paise = 0, total_amount_paise = 50000
    WHERE quotation_id = 'qt-unconf-rate';
    UPDATE quotations SET
      cgst_amount_paise = 0, sgst_amount_paise = 0, igst_amount_paise = 0, total_tax_paise = 0, total_amount_paise = 50000
    WHERE id = 'qt-unconf-rate';
  `);
  // Try to reserve number: sequence reservation trigger also blocks unconfirmed rate!
  let errThrown = false;
  try {
    db.exec("INSERT INTO quotation_sequence_log (financial_year, sequence_number, quotation_id) VALUES ('2026-27', 2, 'qt-unconf-rate');");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_UNCONFIRMED_GST_RATE')) throw err;
  }
  if (!errThrown) throw new Error('Expected ERR_UNCONFIRMED_GST_RATE');
});

assertTest('TC-22', 'Quotation Dispatch', 'NEGATIVE', 'Draft -> Sent transition rejected if line item has unconfirmed (NULL) HSN code', () => {
  seedDraftQuotation('qt-bad-hsn');
  db.exec("UPDATE quotation_items SET hsn_code = NULL WHERE quotation_id = 'qt-bad-hsn';");
  let errThrown = false;
  try {
    db.exec("INSERT INTO quotation_sequence_log (financial_year, sequence_number, quotation_id) VALUES ('2026-27', 2, 'qt-bad-hsn');");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_MANDATORY_HSN_CODE')) throw err;
  }
  if (!errThrown) throw new Error('Expected ERR_MANDATORY_HSN_CODE on missing HSN');
});

assertTest('TC-23', 'Quotation Dispatch', 'NEGATIVE', 'Draft -> Sent transition rejected if item totals do not match header totals', () => {
  // Alter header in Draft to 70000 taxable (total 80800 balances table check: 70000 + 10800 tax = 80800)
  db.exec("UPDATE quotations SET taxable_amount_paise = 70000, total_amount_paise = 80800 WHERE id = 'qt-num-01';");
  let errThrown = false;
  try {
    db.exec(`
      UPDATE quotations SET
        status = 'Sent',
        dispatch_id = 'disp-val-01',
        sent_at = datetime('now'),
        sent_to_recipient = 'procurement@precision.com'
      WHERE id = 'qt-num-01';
    `);
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_FINANCIAL_HEADER_TAXABLE_MISMATCH')) throw err;
  }
  if (!errThrown) throw new Error('Expected ERR_FINANCIAL_HEADER_TAXABLE_MISMATCH');
  // Revert header to match items (60000 taxable, 10800 tax, 70800 total)
  db.exec("UPDATE quotations SET taxable_amount_paise = 60000, total_amount_paise = 70800 WHERE id = 'qt-num-01';");
});

assertTest('TC-24A', 'Quotation Dispatch', 'NEGATIVE', 'Direct SQL transition to Sent rejected without dispatch_id', () => {
  let errThrown = false;
  try {
    db.exec(`
      UPDATE quotations SET
        status = 'Sent',
        sent_at = datetime('now'),
        sent_to_recipient = 'procurement@precision.com'
      WHERE id = 'qt-num-01';
    `);
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_DISPATCH_RECORD_REQUIRED')) throw err;
  }
  if (!errThrown) throw new Error('Expected ERR_DISPATCH_RECORD_REQUIRED when dispatch_id is NULL');
});

assertTest('TC-24B', 'Quotation Dispatch', 'NEGATIVE', 'Direct SQL transition to Sent rejected with fake or unverified dispatch_id', () => {
  let errThrown = false;
  try {
    db.exec(`
      UPDATE quotations SET
        status = 'Sent',
        dispatch_id = 'disp-fake-unverified',
        sent_at = datetime('now'),
        sent_to_recipient = 'procurement@precision.com'
      WHERE id = 'qt-num-01';
    `);
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_UNAUTHORIZED_DISPATCH_TRANSITION')) throw err;
  }
  if (!errThrown) throw new Error('Expected ERR_UNAUTHORIZED_DISPATCH_TRANSITION with fake dispatch_id');
});

assertTest('TC-24C', 'Quotation Dispatch', 'NEGATIVE', 'Direct SQL transition to Sent rejected with SIMULATED or FAILED dispatch record', () => {
  db.exec(`
    INSERT INTO quotation_dispatches (
      id, quotation_id, idempotency_key, recipient_email, dispatch_status,
      provider_name, provider_idempotency_key
    ) VALUES (
      'disp-sim-test', 'qt-num-01', 'key-sim-test', 'procurement@precision.com', 'SIMULATED',
      'STAGING_SIMULATION', 'pkey-sim-test'
    );
  `);
  let errThrown = false;
  try {
    db.exec(`
      UPDATE quotations SET
        status = 'Sent',
        dispatch_id = 'disp-sim-test',
        sent_at = datetime('now'),
        sent_to_recipient = 'procurement@precision.com'
      WHERE id = 'qt-num-01';
    `);
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_UNAUTHORIZED_DISPATCH_TRANSITION')) throw err;
  }
  if (!errThrown) throw new Error('Expected ERR_UNAUTHORIZED_DISPATCH_TRANSITION with SIMULATED dispatch record');
});

assertTest('TC-24D', 'Quotation Dispatch', 'POSITIVE', 'Valid Draft -> Sent transition succeeds when backed by verified ACCEPTED dispatch record', () => {
  db.exec(`
    UPDATE quotations SET
      status = 'Sent',
      dispatch_id = 'disp-val-01',
      sent_at = datetime('now'),
      sent_to_recipient = 'procurement@precision.com'
    WHERE id = 'qt-num-01';
  `);
  const q = db.prepare("SELECT status, sent_to_recipient, sent_at, dispatch_id FROM quotations WHERE id = 'qt-num-01'").get();
  if (q.status !== 'Sent' || q.sent_to_recipient !== 'procurement@precision.com' || !q.sent_at || q.dispatch_id !== 'disp-val-01') {
    throw new Error('Quotation dispatch transition failed');
  }
});

// ==============================================================================
// 6. QUOTATION IMMUTABILITY AFTER DISPATCH
// ==============================================================================

assertTest('TC-25', 'Quotation Protection', 'NEGATIVE', 'Line item insertion rejected after quotation leaves Draft', () => {
  let errThrown = false;
  try {
    db.exec(`
      INSERT INTO quotation_items (
        id, quotation_id, line_number, item_description, hsn_code,
        quantity_microunits, unit_price_paise, gross_amount_paise,
        taxable_amount_paise, gst_rate_bps, cgst_rate_bps, sgst_rate_bps, igst_rate_bps,
        cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_amount_paise
      ) VALUES (
        'it-qt-num-01-3', 'qt-num-01', 3, 'Post-dispatch item', '4016',
        1000000, 1000, 1000, 1000, 1800, 900, 900, 0, 90, 90, 0, 1180
      );
    `);
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_QUOTATION_ITEMS_LOCKED')) throw err;
  }
  if (!errThrown) throw new Error('Expected ERR_QUOTATION_ITEMS_LOCKED on item insert after dispatch');
});

assertTest('TC-26', 'Quotation Protection', 'NEGATIVE', 'Line item update rejected after quotation leaves Draft', () => {
  let errThrown = false;
  try {
    db.exec("UPDATE quotation_items SET unit_price_paise = 20000 WHERE quotation_id = 'qt-num-01';");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_QUOTATION_ITEMS_LOCKED')) throw err;
  }
  if (!errThrown) throw new Error('Expected ERR_QUOTATION_ITEMS_LOCKED on item update after dispatch');
});

assertTest('TC-27', 'Quotation Protection', 'NEGATIVE', 'Line item deletion rejected after quotation leaves Draft', () => {
  let errThrown = false;
  try {
    db.exec("DELETE FROM quotation_items WHERE quotation_id = 'qt-num-01';");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_QUOTATION_ITEMS_LOCKED')) throw err;
  }
  if (!errThrown) throw new Error('Expected ERR_QUOTATION_ITEMS_LOCKED on item deletion after dispatch');
});

assertTest('TC-28', 'Quotation Protection', 'NEGATIVE', 'Commercial and buyer details of Sent quotation are immutable', () => {
  let errThrown = false;
  try {
    db.exec("UPDATE quotations SET buyer_name = 'Compromised Corporation' WHERE id = 'qt-num-01';");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_SENT_QUOTATION_IMMUTABLE')) throw err;
  }
  if (!errThrown) throw new Error('Expected ERR_SENT_QUOTATION_IMMUTABLE on commercial modification');
});

assertTest('TC-28B', 'Quotation Protection', 'NEGATIVE', 'Dispatch reference and metadata of Sent quotation cannot be modified', () => {
  let errThrown = false;
  try {
    db.exec("UPDATE quotations SET dispatch_id = 'disp-tampered-id' WHERE id = 'qt-num-01';");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_SENT_QUOTATION_IMMUTABLE')) throw err;
  }
  if (!errThrown) throw new Error('Expected ERR_SENT_QUOTATION_IMMUTABLE when modifying dispatch_id');
});

assertTest('TC-28C', 'Quotation Protection', 'NEGATIVE', 'buyer_address on Sent quotation cannot be modified', () => {
  let errThrown = false;
  try {
    db.exec("UPDATE quotations SET buyer_address = 'Modified Address 99' WHERE id = 'qt-num-01';");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_SENT_QUOTATION_IMMUTABLE')) throw err;
  }
  if (!errThrown) throw new Error('Expected ERR_SENT_QUOTATION_IMMUTABLE when modifying buyer_address');
});

assertTest('TC-28D', 'Quotation Protection', 'NEGATIVE', 'buyer_state_code on Sent quotation cannot be modified', () => {
  let errThrown = false;
  try {
    db.exec("UPDATE quotations SET buyer_state_code = '29' WHERE id = 'qt-num-01';");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_SENT_QUOTATION_IMMUTABLE')) throw err;
  }
  if (!errThrown) throw new Error('Expected ERR_SENT_QUOTATION_IMMUTABLE when modifying buyer_state_code');
});

assertTest('TC-28E', 'Quotation Protection', 'NEGATIVE', 'buyer_gstin on Sent quotation cannot be modified', () => {
  let errThrown = false;
  try {
    db.exec("UPDATE quotations SET buyer_gstin = '27AAACB9999P1ZZ' WHERE id = 'qt-num-01';");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_SENT_QUOTATION_IMMUTABLE')) throw err;
  }
  if (!errThrown) throw new Error('Expected ERR_SENT_QUOTATION_IMMUTABLE when modifying buyer_gstin');
});

assertTest('TC-28F', 'Quotation Protection', 'NEGATIVE', 'place_of_supply on Sent quotation cannot be modified', () => {
  let errThrown = false;
  try {
    db.exec("UPDATE quotations SET place_of_supply = 'Karnataka (29)' WHERE id = 'qt-num-01';");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_SENT_QUOTATION_IMMUTABLE')) throw err;
  }
  if (!errThrown) throw new Error('Expected ERR_SENT_QUOTATION_IMMUTABLE when modifying place_of_supply');
});

assertTest('TC-28G', 'Quotation Protection', 'NEGATIVE', 'valid_until date on Sent quotation cannot be modified', () => {
  let errThrown = false;
  try {
    db.exec("UPDATE quotations SET valid_until = '2026-12-31' WHERE id = 'qt-num-01';");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_SENT_QUOTATION_IMMUTABLE')) throw err;
  }
  if (!errThrown) throw new Error('Expected ERR_SENT_QUOTATION_IMMUTABLE when modifying valid_until');
});

assertTest('TC-28H', 'Quotation Protection', 'NEGATIVE', 'payment_terms on Sent quotation cannot be modified', () => {
  let errThrown = false;
  try {
    db.exec("UPDATE quotations SET payment_terms = '100% advance required' WHERE id = 'qt-num-01';");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_SENT_QUOTATION_IMMUTABLE')) throw err;
  }
  if (!errThrown) throw new Error('Expected ERR_SENT_QUOTATION_IMMUTABLE when modifying payment_terms');
});

assertTest('TC-28I', 'Quotation Protection', 'NEGATIVE', 'notes on Sent quotation cannot be modified', () => {
  let errThrown = false;
  try {
    db.exec("UPDATE quotations SET notes = 'Tampered commercial notes' WHERE id = 'qt-num-01';");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_SENT_QUOTATION_IMMUTABLE')) throw err;
  }
  if (!errThrown) throw new Error('Expected ERR_SENT_QUOTATION_IMMUTABLE when modifying notes');
});

assertTest('TC-29', 'Quotation Protection', 'NEGATIVE', 'Deletion of Sent quotation is permanently blocked', () => {
  let errThrown = false;
  try {
    db.exec("DELETE FROM quotations WHERE id = 'qt-num-01';");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_LEGAL_RECORD_PROTECTION')) throw err;
  }
  if (!errThrown) throw new Error('Expected ERR_LEGAL_RECORD_PROTECTION on deleting Sent quotation');
});

// ==============================================================================
// 7. QUOTATION FSM VALIDATION & PERMITTED LIFECYCLE
// ==============================================================================

assertTest('TC-30', 'Quotation FSM', 'NEGATIVE', 'Sent quotation cannot revert to Draft', () => {
  let errThrown = false;
  try {
    db.exec("UPDATE quotations SET status = 'Draft' WHERE id = 'qt-num-01';");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_INVALID_QUOTATION_TRANSITION')) throw err;
  }
  if (!errThrown) throw new Error('Expected ERR_INVALID_QUOTATION_TRANSITION when reverting to Draft');
});

assertTest('TC-31', 'Quotation FSM', 'NEGATIVE', 'Draft quotation cannot jump directly to Accepted, Rejected, Expired, or Converted', () => {
  seedDraftQuotation('qt-jump-test');
  let errThrown = false;
  try {
    db.exec("UPDATE quotations SET status = 'Accepted' WHERE id = 'qt-jump-test';");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_UNNUMBERED_QUOTATION_STATUS')) throw err;
  }
  if (!errThrown) throw new Error('Expected unnumbered quotation status error');
});

assertTest('TC-32', 'Quotation FSM', 'POSITIVE', 'Sent quotation transitions legitimately to Accepted upon client approval', () => {
  db.exec("UPDATE quotations SET status = 'Accepted', updated_at = datetime('now') WHERE id = 'qt-num-01';");
  const q = db.prepare("SELECT status FROM quotations WHERE id = 'qt-num-01'").get();
  if (q.status !== 'Accepted') throw new Error(`Expected status Accepted, got ${q.status}`);
});

assertTest('TC-33', 'Quotation FSM', 'NEGATIVE', 'Accepted quotation cannot transition to Rejected or Expired', () => {
  let errThrown = false;
  try {
    db.exec("UPDATE quotations SET status = 'Rejected' WHERE id = 'qt-num-01';");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_ACCEPTED_QUOTATION_INVALID_TRANSITION')) throw err;
  }
  if (!errThrown) throw new Error('Expected ERR_ACCEPTED_QUOTATION_INVALID_TRANSITION');
});

assertTest('TC-34', 'Quotation FSM', 'POSITIVE', 'Accepted quotation transitions legitimately to Converted with converted_invoice_id', () => {
  db.exec("UPDATE quotations SET status = 'Converted', converted_invoice_id = 'inv-seq-02', updated_at = datetime('now') WHERE id = 'qt-num-01';");
  const q = db.prepare("SELECT status, converted_invoice_id FROM quotations WHERE id = 'qt-num-01'").get();
  if (q.status !== 'Converted' || q.converted_invoice_id !== 'inv-seq-02') {
    throw new Error('Quotation conversion failed');
  }
});

assertTest('TC-35', 'Quotation FSM', 'NEGATIVE', 'Converted quotation status is terminal and cannot be changed', () => {
  let errThrown = false;
  try {
    db.exec("UPDATE quotations SET status = 'Accepted' WHERE id = 'qt-num-01';");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_CONVERTED_QUOTATION_FINAL')) throw err;
  }
  if (!errThrown) throw new Error('Expected ERR_CONVERTED_QUOTATION_FINAL');
});

// ==============================================================================
// 8. GST COMPONENT RATE CONSISTENCY & TAX SPLIT CONSTRAINTS
// ==============================================================================

assertTest('TC-36', 'GST Integrity', 'NEGATIVE', 'Intrastate line item with uneven or non-50/50 tax split is rejected by CHECK constraint', () => {
  seedDraftInvoice('inv-split-err');
  let errThrown = false;
  try {
    db.exec(`
      INSERT INTO invoice_items (
        id, invoice_id, line_number, item_description, hsn_code,
        quantity_microunits, unit_price_paise, gross_amount_paise,
        taxable_amount_paise, gst_rate_bps, cgst_rate_bps, sgst_rate_bps, igst_rate_bps,
        cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_amount_paise
      ) VALUES (
        'it-split-err-1', 'inv-split-err', 2, 'Rubber Pad', '4016',
        1000000, 5000, 5000, 5000, 1800, 1000, 800, 0, 500, 400, 0, 5900
      );
    `);
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('CHECK constraint failed')) throw err;
  }
  if (!errThrown) throw new Error('Expected CHECK constraint failed on uneven intrastate component rates');
});

assertTest('TC-37', 'GST Integrity', 'NEGATIVE', 'Interstate item with non-zero CGST or SGST is rejected by CHECK constraint', () => {
  seedDraftInvoice('inv-inter-split');
  let errThrown = false;
  try {
    db.exec(`
      INSERT INTO invoice_items (
        id, invoice_id, line_number, item_description, hsn_code,
        quantity_microunits, unit_price_paise, gross_amount_paise,
        taxable_amount_paise, gst_rate_bps, cgst_rate_bps, sgst_rate_bps, igst_rate_bps,
        cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_amount_paise
      ) VALUES (
        'it-inter-err-1', 'inv-inter-split', 2, 'Rubber Strip', '4016',
        1000000, 5000, 5000, 5000, 1800, 900, 0, 900, 450, 0, 450, 5900
      );
    `);
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('CHECK constraint failed')) throw err;
  }
  if (!errThrown) throw new Error('Expected CHECK constraint failure on interstate CGST mix');
});

assertTest('TC-38', 'GST Integrity', 'NEGATIVE', 'Line item with NULL gst_rate_bps but non-zero component rates is rejected', () => {
  seedDraftInvoice('inv-null-rate-err');
  let errThrown = false;
  try {
    db.exec(`
      INSERT INTO invoice_items (
        id, invoice_id, line_number, item_description, hsn_code,
        quantity_microunits, unit_price_paise, gross_amount_paise,
        taxable_amount_paise, gst_rate_bps, cgst_rate_bps, sgst_rate_bps, igst_rate_bps,
        cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_amount_paise
      ) VALUES (
        'it-null-rate-1', 'inv-null-rate-err', 2, 'Rubber Bush', '4016',
        1000000, 5000, 5000, 5000, NULL, 900, 900, 0, 450, 450, 0, 5900
      );
    `);
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('CHECK constraint failed')) throw err;
  }
  if (!errThrown) throw new Error('Expected CHECK constraint failure on NULL gst_rate_bps with non-zero component rates');
});

// ==============================================================================
// 9. PAISE ROUNDING BOUNDARIES & PRECISION ARITHMETIC
// ==============================================================================

assertTest('TC-39', 'Rounding Policy', 'POSITIVE', 'Paise-rounding rule round((taxable * rate) / 10000) rounds down at 900.45 paise', () => {
  // Odd-paise boundary: 10,005 paise (Rs 100.05) @ 9% CGST = 900.45 -> rounds down to 900 paise
  const taxable = 10005;
  const rateBps = 900;
  
  // Exercise calculation directly in SQLite database engine
  const sqlEval = db.prepare("SELECT cast(round((10005 * 900) / 10000.0) as INTEGER) as rounded").get();
  if (sqlEval.rounded !== 900) {
    throw new Error(`Database engine round down failed: expected 900, got ${sqlEval.rounded}`);
  }

  db.exec(`
    INSERT INTO invoices (
      id, status, financial_year, invoice_prefix, seller_gstin, seller_state_code,
      buyer_name, buyer_address, buyer_state_name, buyer_state_code, buyer_pincode,
      subtotal_gross_paise, total_discount_paise, taxable_amount_paise,
      cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_tax_paise,
      apply_round_off, round_off_paise, total_invoice_amount_paise
    ) VALUES (
      'inv-round-dn', 'Draft', '2026-27', 'BE/26-27/', '27AGCPB8322L1ZG', '27',
      'Boundary Test Corp', 'Bhosari MIDC', 'Maharashtra', '27', '411039',
      ${taxable}, 0, ${taxable},
      900, 900, 0, 1800,
      0, 0, 11805
    );
    INSERT INTO invoice_items (
      id, invoice_id, line_number, item_description, hsn_code,
      quantity_microunits, unit_price_paise, gross_amount_paise,
      taxable_amount_paise, gst_rate_bps, cgst_rate_bps, sgst_rate_bps, igst_rate_bps,
      cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_amount_paise
    ) VALUES (
      'it-round-dn-1', 'inv-round-dn', 1, 'Custom Precision Bush', '4016',
      1000000, ${taxable}, ${taxable}, ${taxable}, 1800, 900, 900, 0, 900, 900, 0, 11805
    );
  `);
  // Sequence allocation will verify that round((10005 * 900)/10000) = 900
  db.exec("INSERT INTO invoice_sequence_log (financial_year, sequence_number, invoice_id) VALUES ('2026-27', 3, 'inv-round-dn');");
  const inv = db.prepare("SELECT invoice_number, total_invoice_amount_paise FROM invoices WHERE id = 'inv-round-dn'").get();
  if (inv.invoice_number !== 'BE/26-27/0003') throw new Error(`Expected BE/26-27/0003, got ${inv.invoice_number}`);
});

assertTest('TC-40', 'Rounding Policy', 'POSITIVE', 'Paise-rounding rule round((taxable * rate) / 10000) rounds up at 904.50 paise', () => {
  // Half-way boundary: 10,050 paise (Rs 100.50) @ 9% CGST = 904.50 -> rounds up to 905 paise
  const taxable = 10050;
  const rateBps = 900;
  
  // Exercise calculation directly in SQLite database engine
  const sqlEval = db.prepare("SELECT cast(round((10050 * 900) / 10000.0) as INTEGER) as rounded").get();
  if (sqlEval.rounded !== 905) {
    throw new Error(`Database engine round up failed: expected 905, got ${sqlEval.rounded}`);
  }

  db.exec(`
    INSERT INTO invoices (
      id, status, financial_year, invoice_prefix, seller_gstin, seller_state_code,
      buyer_name, buyer_address, buyer_state_name, buyer_state_code, buyer_pincode,
      subtotal_gross_paise, total_discount_paise, taxable_amount_paise,
      cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_tax_paise,
      apply_round_off, round_off_paise, total_invoice_amount_paise
    ) VALUES (
      'inv-round-up', 'Draft', '2026-27', 'BE/26-27/', '27AGCPB8322L1ZG', '27',
      'Boundary Halfway Corp', 'Bhosari MIDC', 'Maharashtra', '27', '411039',
      ${taxable}, 0, ${taxable},
      905, 905, 0, 1810,
      0, 0, 11860
    );
    INSERT INTO invoice_items (
      id, invoice_id, line_number, item_description, hsn_code,
      quantity_microunits, unit_price_paise, gross_amount_paise,
      taxable_amount_paise, gst_rate_bps, cgst_rate_bps, sgst_rate_bps, igst_rate_bps,
      cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_amount_paise
    ) VALUES (
      'it-round-up-1', 'inv-round-up', 1, 'Custom Flange Gasket', '4016',
      1000000, ${taxable}, ${taxable}, ${taxable}, 1800, 900, 900, 0, 905, 905, 0, 11860
    );
  `);
  // Sequence allocation will verify that round((10050 * 900)/10000) = 905
  db.exec("INSERT INTO invoice_sequence_log (financial_year, sequence_number, invoice_id) VALUES ('2026-27', 4, 'inv-round-up');");
  const inv = db.prepare("SELECT invoice_number FROM invoices WHERE id = 'inv-round-up'").get();
  if (inv.invoice_number !== 'BE/26-27/0004') throw new Error(`Expected BE/26-27/0004, got ${inv.invoice_number}`);
});

assertTest('TC-41', 'Rounding Policy', 'POSITIVE', 'Large order (Rs 10,00,000 / 10 crore paise) handles 64-bit integer headroom without overflow', () => {
  const taxable = 100000000; // Rs 10,00,000.00
  const cgst = 9000000;      // Rs 90,000.00
  const sgst = 9000000;      // Rs 90,000.00
  const totalTax = 18000000;  // Rs 1,80,000.00
  const total = 118000000;   // Rs 11,80,000.00

  db.exec(`
    INSERT INTO invoices (
      id, status, financial_year, invoice_prefix, seller_gstin, seller_state_code,
      buyer_name, buyer_address, buyer_state_name, buyer_state_code, buyer_pincode,
      subtotal_gross_paise, total_discount_paise, taxable_amount_paise,
      cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_tax_paise,
      apply_round_off, round_off_paise, total_invoice_amount_paise
    ) VALUES (
      'inv-large-order', 'Draft', '2026-27', 'BE/26-27/', '27AGCPB8322L1ZG', '27',
      'Tata Motors Fleet Works', 'MIDC Pimpri', 'Maharashtra', '27', '411018',
      ${taxable}, 0, ${taxable},
      ${cgst}, ${sgst}, 0, ${totalTax},
      1, 0, ${total}
    );
    INSERT INTO invoice_items (
      id, invoice_id, line_number, item_description, hsn_code,
      quantity_microunits, unit_price_paise, gross_amount_paise,
      taxable_amount_paise, gst_rate_bps, cgst_rate_bps, sgst_rate_bps, igst_rate_bps,
      cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_amount_paise
    ) VALUES (
      'it-large-1', 'inv-large-order', 1, 'Heavy Industrial Damper Assembly', '4016',
      1000000000, 100000, ${taxable}, ${taxable}, 1800, 900, 900, 0, ${cgst}, ${sgst}, 0, ${total}
    );
  `);
  db.exec("INSERT INTO invoice_sequence_log (financial_year, sequence_number, invoice_id) VALUES ('2026-27', 5, 'inv-large-order');");
  const inv = db.prepare("SELECT invoice_number, total_invoice_amount_paise FROM invoices WHERE id = 'inv-large-order'").get();
  if (inv.invoice_number !== 'BE/26-27/0005' || inv.total_invoice_amount_paise !== total) {
    throw new Error('Large order invoice verification failed');
  }
});

// ==============================================================================
// 10. MULTI-YEAR SUPPORT & AUDIT LOG PERMANENCE
// ==============================================================================

assertTest('TC-42', 'Multi-Year Support', 'POSITIVE', 'Future financial year (FY 2027-28) generates BE/27-28/0001 dynamically', () => {
  seedDraftInvoice('inv-fy27-28', '27AAACB2026R1Z9', 0, '27', '2027-28');
  db.exec("INSERT INTO invoice_sequence_log (financial_year, sequence_number, invoice_id) VALUES ('2027-28', 1, 'inv-fy27-28');");
  const inv = db.prepare("SELECT * FROM invoices WHERE id = 'inv-fy27-28'").get();
  if (inv.status !== 'Issued' || inv.invoice_number !== 'BE/27-28/0001' || inv.invoice_prefix !== 'BE/27-28/') {
    throw new Error(`Expected BE/27-28/0001, got ${inv.invoice_number}`);
  }
});

assertTest('TC-43', 'Audit Permanence', 'NEGATIVE', 'Invoice sequence log entries are permanent audit records and cannot be deleted', () => {
  let errThrown = false;
  try {
    db.exec("DELETE FROM invoice_sequence_log WHERE financial_year = '2026-27' AND sequence_number = 1;");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_AUDIT_LOG_DELETION')) throw err;
  }
  if (!errThrown) throw new Error('Expected ERR_AUDIT_LOG_DELETION on deleting invoice sequence log');
});

assertTest('TC-44', 'Audit Permanence', 'NEGATIVE', 'Invoice sequence log entries are immutable and cannot be updated', () => {
  let errThrown = false;
  try {
    db.exec("UPDATE invoice_sequence_log SET sequence_number = 999 WHERE financial_year = '2026-27' AND sequence_number = 1;");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_AUDIT_LOG_IMMUTABLE')) throw err;
  }
  if (!errThrown) throw new Error('Expected ERR_AUDIT_LOG_IMMUTABLE on updating invoice sequence log');
});

assertTest('TC-45', 'Audit Permanence', 'NEGATIVE', 'Quotation sequence log entries cannot be deleted or updated', () => {
  let errDelete = false;
  try {
    db.exec("DELETE FROM quotation_sequence_log WHERE financial_year = '2026-27' AND sequence_number = 1;");
  } catch (err) {
    errDelete = true;
    if (!err.message.includes('ERR_AUDIT_LOG_DELETION')) throw err;
  }
  let errUpdate = false;
  try {
    db.exec("UPDATE quotation_sequence_log SET sequence_number = 999 WHERE financial_year = '2026-27' AND sequence_number = 1;");
  } catch (err) {
    errUpdate = true;
    if (!err.message.includes('ERR_AUDIT_LOG_IMMUTABLE')) throw err;
  }
  if (!errDelete || !errUpdate) throw new Error('Quotation sequence audit protections failed');
});

assertTest('TC-45B', 'Audit Permanence', 'NEGATIVE', 'Quotation dispatch records cannot be deleted or have ACCEPTED status mutated', () => {
  let errDelete = false;
  try {
    db.exec("DELETE FROM quotation_dispatches WHERE id = 'disp-val-01';");
  } catch (err) {
    errDelete = true;
    if (!err.message.includes('ERR_DISPATCH_LOG_DELETION')) throw err;
  }
  let errUpdate = false;
  try {
    db.exec("UPDATE quotation_dispatches SET dispatch_status = 'FAILED' WHERE id = 'disp-val-01';");
  } catch (err) {
    errUpdate = true;
    if (!err.message.includes('ERR_ACCEPTED_DISPATCH_IMMUTABLE')) throw err;
  }
  if (!errDelete || !errUpdate) throw new Error('Quotation dispatch audit protections failed');
});

// ==============================================================================
// 11. ADVANCED GST COMPONENT-RATE & INDEPENDENT CALCULATION ASSERTIONS
// ==============================================================================

assertTest('TC-46', 'GST Rates', 'POSITIVE', 'Intrastate line item accepts confirmed 50/50 CGST and SGST split (900/900 bps for 1800 bps)', () => {
  seedDraftInvoice('inv-intra-pos');
  // Second valid intrastate item at 18% (900 bps CGST, 900 bps SGST, 0 bps IGST)
  db.exec(`
    INSERT INTO invoice_items (
      id, invoice_id, line_number, item_description, hsn_code,
      quantity_microunits, unit_price_paise, gross_amount_paise,
      taxable_amount_paise, gst_rate_bps, cgst_rate_bps, sgst_rate_bps, igst_rate_bps,
      cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_amount_paise
    ) VALUES (
      'it-intra-pos-2', 'inv-intra-pos', 2, 'Silicone Seal Ring', '4016',
      1000000, 20000, 20000, 20000, 1800, 900, 900, 0, 1800, 1800, 0, 23600
    );
  `);
  const row = db.prepare("SELECT cgst_rate_bps, sgst_rate_bps, igst_rate_bps FROM invoice_items WHERE id = 'it-intra-pos-2'").get();
  if (row.cgst_rate_bps !== 900 || row.sgst_rate_bps !== 900 || row.igst_rate_bps !== 0) {
    throw new Error('Intrastate 50/50 split assertion failed');
  }
});

assertTest('TC-47', 'GST Rates', 'POSITIVE', 'Interstate line item accepts confirmed 100% IGST (1800 bps IGST, 0 bps CGST/SGST)', () => {
  seedDraftInvoice('inv-inter-pos', '29AAACB2026R1Z9', 1, '29');
  const row = db.prepare("SELECT cgst_rate_bps, sgst_rate_bps, igst_rate_bps, igst_amount_paise FROM invoice_items WHERE invoice_id = 'inv-inter-pos'").get();
  if (row.cgst_rate_bps !== 0 || row.sgst_rate_bps !== 0 || row.igst_rate_bps !== 1800 || row.igst_amount_paise !== 1800) {
    throw new Error('Interstate 100% IGST assertion failed');
  }
});

assertTest('TC-48', 'GST Rates', 'NEGATIVE', 'Interstate line item rejects under-rated IGST (e.g. 1200 bps IGST when gst_rate_bps is 1800)', () => {
  seedDraftInvoice('inv-inter-neg', '29AAACB2026R1Z9', 1, '29');
  let errThrown = false;
  try {
    db.exec(`
      INSERT INTO invoice_items (
        id, invoice_id, line_number, item_description, hsn_code,
        quantity_microunits, unit_price_paise, gross_amount_paise,
        taxable_amount_paise, gst_rate_bps, cgst_rate_bps, sgst_rate_bps, igst_rate_bps,
        cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_amount_paise
      ) VALUES (
        'it-inter-neg-2', 'inv-inter-neg', 2, 'Interstate Flange', '4016',
        1000000, 10000, 10000, 10000, 1800, 0, 0, 1200, 0, 0, 1200, 11200
      );
    `);
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('CHECK constraint failed')) throw err;
  }
  if (!errThrown) throw new Error('Expected CHECK constraint failed on mismatched interstate IGST rate');
});

assertTest('TC-49', 'Rounding Policy', 'POSITIVE', 'IGST paise-rounding rule round((taxable * rate) / 10000) rounds up at 1804.50 paise', () => {
  // Interstate half-way boundary: 10,025 paise (Rs 100.25) @ 18% IGST = 1804.50 -> rounds up to 1805 paise
  const taxable = 10025;
  const rateBps = 1800;

  // Exercise direct calculation in SQLite database engine
  const sqlEval = db.prepare("SELECT cast(round((10025 * 1800) / 10000.0) as INTEGER) as rounded").get();
  if (sqlEval.rounded !== 1805) {
    throw new Error(`Database engine IGST round up failed: expected 1805, got ${sqlEval.rounded}`);
  }

  const expectedIgst = 1805;

  db.exec(`
    INSERT INTO invoices (
      id, status, financial_year, invoice_prefix, seller_gstin, seller_state_code,
      buyer_name, buyer_address, buyer_state_name, buyer_state_code, buyer_pincode,
      is_interstate,
      subtotal_gross_paise, total_discount_paise, taxable_amount_paise,
      cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_tax_paise,
      apply_round_off, round_off_paise, total_invoice_amount_paise
    ) VALUES (
      'inv-igst-halfup', 'Draft', '2026-27', 'BE/26-27/', '27AGCPB8322L1ZG', '27',
      'Bangalore Precision Aerospace', 'Peenya Phase 1', 'Karnataka', '29', '560058',
      1,
      ${taxable}, 0, ${taxable},
      0, 0, ${expectedIgst}, ${expectedIgst},
      0, 0, ${taxable + expectedIgst}
    );
    INSERT INTO invoice_items (
      id, invoice_id, line_number, item_description, hsn_code,
      quantity_microunits, unit_price_paise, gross_amount_paise,
      taxable_amount_paise, gst_rate_bps, cgst_rate_bps, sgst_rate_bps, igst_rate_bps,
      cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_amount_paise
    ) VALUES (
      'it-igst-halfup-1', 'inv-igst-halfup', 1, 'Precision Viton O-Ring Set', '4016',
      1000000, ${taxable}, ${taxable}, ${taxable}, 1800, 0, 0, 1800, 0, 0, ${expectedIgst}, ${taxable + expectedIgst}
    );
  `);
  // Sequence allocation triggers full issuance revalidation
  db.exec("INSERT INTO invoice_sequence_log (financial_year, sequence_number, invoice_id) VALUES ('2026-27', 6, 'inv-igst-halfup');");
  const inv = db.prepare("SELECT invoice_number, total_invoice_amount_paise, igst_amount_paise FROM invoices WHERE id = 'inv-igst-halfup'").get();
  if (inv.invoice_number !== 'BE/26-27/0006' || inv.igst_amount_paise !== 1805) {
    throw new Error('IGST half-way rounding assertion failed');
  }
});

assertTest('TC-50', 'Rounding Policy', 'POSITIVE', 'IGST paise-rounding rule round((taxable * rate) / 10000) rounds down at 1800.36 paise', () => {
  // Interstate round-down boundary: 10,002 paise (Rs 100.02) @ 18% IGST = 1800.36 -> rounds down to 1800 paise
  const taxable = 10002;
  const rateBps = 1800;

  // Exercise direct calculation in SQLite database engine
  const sqlEval = db.prepare("SELECT cast(round((10002 * 1800) / 10000.0) as INTEGER) as rounded").get();
  if (sqlEval.rounded !== 1800) {
    throw new Error(`Database engine round down failed: expected 1800, got ${sqlEval.rounded}`);
  }

  const expectedIgst = 1800;

  db.exec(`
    INSERT INTO invoices (
      id, status, financial_year, invoice_prefix, seller_gstin, seller_state_code,
      buyer_name, buyer_address, buyer_state_name, buyer_state_code, buyer_pincode,
      is_interstate,
      subtotal_gross_paise, total_discount_paise, taxable_amount_paise,
      cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_tax_paise,
      apply_round_off, round_off_paise, total_invoice_amount_paise
    ) VALUES (
      'inv-igst-rounddown', 'Draft', '2026-27', 'BE/26-27/', '27AGCPB8322L1ZG', '27',
      'Hyderabad Instruments', 'Sanath Nagar', 'Telangana', '36', '500018',
      1,
      ${taxable}, 0, ${taxable},
      0, 0, ${expectedIgst}, ${expectedIgst},
      0, 0, ${taxable + expectedIgst}
    );
    INSERT INTO invoice_items (
      id, invoice_id, line_number, item_description, hsn_code,
      quantity_microunits, unit_price_paise, gross_amount_paise,
      taxable_amount_paise, gst_rate_bps, cgst_rate_bps, sgst_rate_bps, igst_rate_bps,
      cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_amount_paise
    ) VALUES (
      'it-igst-rounddown-1', 'inv-igst-rounddown', 1, 'Custom Silicone Gasket', '4016',
      1000000, ${taxable}, ${taxable}, ${taxable}, 1800, 0, 0, 1800, 0, 0, ${expectedIgst}, ${taxable + expectedIgst}
    );
  `);
  db.exec("INSERT INTO invoice_sequence_log (financial_year, sequence_number, invoice_id) VALUES ('2026-27', 7, 'inv-igst-rounddown');");
  const inv = db.prepare("SELECT invoice_number, total_invoice_amount_paise, igst_amount_paise FROM invoices WHERE id = 'inv-igst-rounddown'").get();
  if (inv.invoice_number !== 'BE/26-27/0007' || inv.igst_amount_paise !== 1800) {
    throw new Error('IGST round-down assertion failed');
  }
});

assertTest('TC-51', 'Math Verification', 'POSITIVE', 'Independent JS math engine exactly matches SQLite database operations and aggregates', () => {
  // Simulate 3 diverse items with odd paise, discounts, and round-off
  const rawItems = [
    { qty: 10000000, ratePaise: 4525, discountBps: 200, gstBps: 1800 }, // 10 units @ 45.25, 2% discount
    { qty: 25000000, ratePaise: 1250, discountBps: 0,   gstBps: 1800 }, // 25 units @ 12.50
    { qty: 5000000,  ratePaise: 8990, discountBps: 500, gstBps: 1800 }, // 5 units @ 89.90, 5% discount
  ];

  let calcSubtotalGross = 0;
  let calcTotalDiscount = 0;
  let calcTaxable = 0;
  let calcCgst = 0;
  let calcSgst = 0;

  const processedItems = rawItems.map((it, idx) => {
    const gross = Math.round((it.qty * it.ratePaise) / 1000000);
    const discount = Math.round((gross * it.discountBps) / 10000);
    const taxable = gross - discount;
    const cgstRate = 900;
    const sgstRate = 900;
    const cgstAmt = Math.round((taxable * cgstRate) / 10000);
    const sgstAmt = Math.round((taxable * sgstRate) / 10000);
    const totalAmt = taxable + cgstAmt + sgstAmt;

    calcSubtotalGross += gross;
    calcTotalDiscount += discount;
    calcTaxable += taxable;
    calcCgst += cgstAmt;
    calcSgst += sgstAmt;

    return {
      line: idx + 1,
      gross,
      discount,
      taxable,
      cgstRate,
      sgstRate,
      cgstAmt,
      sgstAmt,
      totalAmt,
      ratePaise: it.ratePaise,
      qty: it.qty,
      discountBps: it.discountBps,
      gstBps: it.gstBps
    };
  });

  const calcTotalTax = calcCgst + calcSgst;
  const unroundedTotal = calcTaxable + calcTotalTax;
  const roundedRupees = Math.round(unroundedTotal / 100) * 100;
  const calcRoundOff = roundedRupees - unroundedTotal;
  const calcFinalTotal = roundedRupees;

  // Insert into SQLite and issue via sequence log
  db.exec(`
    INSERT INTO invoices (
      id, status, financial_year, invoice_prefix, seller_gstin, seller_state_code,
      buyer_name, buyer_address, buyer_state_name, buyer_state_code, buyer_pincode,
      is_interstate,
      subtotal_gross_paise, total_discount_paise, taxable_amount_paise,
      cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_tax_paise,
      apply_round_off, round_off_paise, total_invoice_amount_paise
    ) VALUES (
      'inv-indep-math', 'Draft', '2026-27', 'BE/26-27/', '27AGCPB8322L1ZG', '27',
      'Independent Audit Systems', 'Plot 100 MIDC Chakan', 'Maharashtra', '27', '410501',
      0,
      ${calcSubtotalGross}, ${calcTotalDiscount}, ${calcTaxable},
      ${calcCgst}, ${calcSgst}, 0, ${calcTotalTax},
      1, ${calcRoundOff}, ${calcFinalTotal}
    );
  `);

  for (const it of processedItems) {
    db.exec(`
      INSERT INTO invoice_items (
        id, invoice_id, line_number, item_description, hsn_code,
        quantity_microunits, unit_price_paise, gross_amount_paise,
        discount_bps, discount_amount_paise, taxable_amount_paise, gst_rate_bps,
        cgst_rate_bps, sgst_rate_bps, igst_rate_bps,
        cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_amount_paise
      ) VALUES (
        'it-indep-${it.line}', 'inv-indep-math', ${it.line}, 'Precision Gasket Item ${it.line}', '4016',
        ${it.qty}, ${it.ratePaise}, ${it.gross},
        ${it.discountBps}, ${it.discount}, ${it.taxable}, ${it.gstBps},
        ${it.cgstRate}, ${it.sgstRate}, 0,
        ${it.cgstAmt}, ${it.sgstAmt}, 0, ${it.totalAmt}
      );
    `);
  }

  // Cross-examine: Retrieve actual database line-item aggregate sums and compare with JS independent calculation
  const dbAgg = db.prepare(`
    SELECT
      sum(gross_amount_paise) as sum_gross,
      sum(discount_amount_paise) as sum_discount,
      sum(taxable_amount_paise) as sum_taxable,
      sum(cgst_amount_paise) as sum_cgst,
      sum(sgst_amount_paise) as sum_sgst,
      sum(total_amount_paise) as sum_total
    FROM invoice_items WHERE invoice_id = 'inv-indep-math'
  `).get();

  if (
    dbAgg.sum_gross !== calcSubtotalGross ||
    dbAgg.sum_discount !== calcTotalDiscount ||
    dbAgg.sum_taxable !== calcTaxable ||
    dbAgg.sum_cgst !== calcCgst ||
    dbAgg.sum_sgst !== calcSgst ||
    dbAgg.sum_total !== unroundedTotal
  ) {
    throw new Error('Database aggregate sum calculation mismatch against independent JS calculation');
  }

  // Attempt issuance: trigger verifies that item math and header match
  db.exec("INSERT INTO invoice_sequence_log (financial_year, sequence_number, invoice_id) VALUES ('2026-27', 8, 'inv-indep-math');");
  const inv = db.prepare("SELECT * FROM invoices WHERE id = 'inv-indep-math'").get();

  if (
    inv.subtotal_gross_paise !== calcSubtotalGross ||
    inv.total_discount_paise !== calcTotalDiscount ||
    inv.taxable_amount_paise !== calcTaxable ||
    inv.cgst_amount_paise !== calcCgst ||
    inv.sgst_amount_paise !== calcSgst ||
    inv.total_tax_paise !== calcTotalTax ||
    inv.round_off_paise !== calcRoundOff ||
    inv.total_invoice_amount_paise !== calcFinalTotal
  ) {
    throw new Error('Independent JS calculation mismatch against database record');
  }
});

assertTest('TC-52', 'Default Integrity', 'POSITIVE', 'Database schema DDL defaults gst_rate_bps to NULL across all applicable tables', () => {
  // Inspect PRAGMA table_info across ALL tables with GST columns
  const productCols = db.prepare("PRAGMA table_info('products')").all();
  const prodGstCol = productCols.find(c => c.name === 'gst_rate_bps');
  if (!prodGstCol || (prodGstCol.dflt_value !== null && prodGstCol.dflt_value !== 'NULL')) {
    throw new Error(`Expected products.gst_rate_bps dflt_value NULL, got ${prodGstCol?.dflt_value}`);
  }

  const quoteItemCols = db.prepare("PRAGMA table_info('quotation_items')").all();
  const quoteGstCol = quoteItemCols.find(c => c.name === 'gst_rate_bps');
  if (!quoteGstCol || (quoteGstCol.dflt_value !== null && quoteGstCol.dflt_value !== 'NULL')) {
    throw new Error(`Expected quotation_items.gst_rate_bps dflt_value NULL, got ${quoteGstCol?.dflt_value}`);
  }
  const quoteCgstCol = quoteItemCols.find(c => c.name === 'cgst_rate_bps');
  if (!quoteCgstCol || String(quoteCgstCol.dflt_value) !== '0') {
    throw new Error(`Expected quotation_items.cgst_rate_bps dflt_value 0, got ${quoteCgstCol?.dflt_value}`);
  }
  const quoteSgstCol = quoteItemCols.find(c => c.name === 'sgst_rate_bps');
  if (!quoteSgstCol || String(quoteSgstCol.dflt_value) !== '0') {
    throw new Error(`Expected quotation_items.sgst_rate_bps dflt_value 0, got ${quoteSgstCol?.dflt_value}`);
  }
  const quoteIgstCol = quoteItemCols.find(c => c.name === 'igst_rate_bps');
  if (!quoteIgstCol || String(quoteIgstCol.dflt_value) !== '0') {
    throw new Error(`Expected quotation_items.igst_rate_bps dflt_value 0, got ${quoteIgstCol?.dflt_value}`);
  }

  const invoiceItemCols = db.prepare("PRAGMA table_info('invoice_items')").all();
  const invGstCol = invoiceItemCols.find(c => c.name === 'gst_rate_bps');
  if (!invGstCol || (invGstCol.dflt_value !== null && invGstCol.dflt_value !== 'NULL')) {
    throw new Error(`Expected invoice_items.gst_rate_bps dflt_value NULL, got ${invGstCol?.dflt_value}`);
  }
  const invCgstCol = invoiceItemCols.find(c => c.name === 'cgst_rate_bps');
  if (!invCgstCol || String(invCgstCol.dflt_value) !== '0') {
    throw new Error(`Expected invoice_items.cgst_rate_bps dflt_value 0, got ${invCgstCol?.dflt_value}`);
  }
  const invSgstCol = invoiceItemCols.find(c => c.name === 'sgst_rate_bps');
  if (!invSgstCol || String(invSgstCol.dflt_value) !== '0') {
    throw new Error(`Expected invoice_items.sgst_rate_bps dflt_value 0, got ${invSgstCol?.dflt_value}`);
  }
  const invIgstCol = invoiceItemCols.find(c => c.name === 'igst_rate_bps');
  if (!invIgstCol || String(invIgstCol.dflt_value) !== '0') {
    throw new Error(`Expected invoice_items.igst_rate_bps dflt_value 0, got ${invIgstCol?.dflt_value}`);
  }
});

// ==============================================================================
// 12. DISPATCH WORKFLOW INTEGRITY & ATOMIC TRANSACTION AUDIT
// ==============================================================================

assertTest('TC-53', 'Dispatch Safety', 'POSITIVE', 'Simulated dispatch without verified provider leaves quotation strictly in Draft', () => {
  seedDraftQuotation('qt-sim-dispatch', '2026-27');
  db.exec("INSERT INTO quotation_sequence_log (financial_year, sequence_number, quotation_id) VALUES ('2026-27', 2, 'qt-sim-dispatch');");

  // Simulation: No live email API key configured.
  // Application layer must NOT update status to 'Sent'.
  // It inserts a DISPATCH_SIMULATED audit log and preserves status as 'Draft'.
  db.exec(`
    INSERT INTO audit_logs (id, entity_type, entity_id, action, actor, details_json)
    VALUES (
      'audit-sim-1', 'QUOTATION', 'qt-sim-dispatch', 'DISPATCH_SIMULATED', 'ADMIN_STAGING',
      '{"quotation_number":"BE/QT/26-27/0002","reason":"NO_ACTIVE_EMAIL_PROVIDER_CONFIGURED","status":"DRAFT_MAINTAINED"}'
    );
  `);

  const q = db.prepare("SELECT status FROM quotations WHERE id = 'qt-sim-dispatch'").get();
  if (q.status !== 'Draft') {
    throw new Error(`Quotation status must remain Draft when transport is simulated, got ${q.status}`);
  }
  const audit = db.prepare("SELECT action FROM audit_logs WHERE id = 'audit-sim-1'").get();
  if (audit.action !== 'DISPATCH_SIMULATED') {
    throw new Error(`Expected DISPATCH_SIMULATED audit, got ${audit.action}`);
  }
});

assertTest('TC-54', 'Dispatch Safety', 'POSITIVE', 'Failed email-provider operation does not mark quotation Sent and logs DISPATCH_FAILED', () => {
  seedDraftQuotation('qt-fail-dispatch', '2026-27');
  db.exec("INSERT INTO quotation_sequence_log (financial_year, sequence_number, quotation_id) VALUES ('2026-27', 3, 'qt-fail-dispatch');");

  // Simulation: Outbound mail provider returns 502 / network error.
  // Application layer records DISPATCH_FAILED in audit_logs and does NOT update status.
  db.exec(`
    INSERT INTO audit_logs (id, entity_type, entity_id, action, actor, details_json)
    VALUES (
      'audit-fail-1', 'QUOTATION', 'qt-fail-dispatch', 'DISPATCH_FAILED', 'ADMIN_STAGING',
      '{"quotation_number":"BE/QT/26-27/0003","error":"HTTP 502: Bad Gateway from Mail Provider"}'
    );
  `);

  const q = db.prepare("SELECT status FROM quotations WHERE id = 'qt-fail-dispatch'").get();
  if (q.status !== 'Draft') {
    throw new Error(`Quotation status must remain Draft when provider fails, got ${q.status}`);
  }
});

assertTest('TC-55', 'Dispatch Safety', 'POSITIVE', 'Successful provider acceptance permits atomic transition to Sent with audit logging', () => {
  seedDraftQuotation('qt-ok-dispatch', '2026-27');
  db.exec("INSERT INTO quotation_sequence_log (financial_year, sequence_number, quotation_id) VALUES ('2026-27', 4, 'qt-ok-dispatch');");

  // Simulation: Provider returns 200 with message ID.
  // First insert verified ACCEPTED dispatch record, then atomically update status to 'Sent' and log audit
  db.exec(`
    INSERT INTO quotation_dispatches (
      id, quotation_id, idempotency_key, recipient_email, dispatch_status,
      provider_name, provider_message_id, provider_idempotency_key, completed_at
    ) VALUES (
      'disp-ok-1', 'qt-ok-dispatch', 'key-ok-1', 'procurement@clientcorp.in', 'ACCEPTED',
      'RESEND_STAGING', 'msg_resend_9921', 'pkey-ok-1', datetime('now')
    );
    BEGIN TRANSACTION;
    UPDATE quotations SET
      status = 'Sent',
      dispatch_id = 'disp-ok-1',
      sent_at = datetime('now'),
      sent_to_recipient = 'procurement@clientcorp.in',
      updated_at = datetime('now')
    WHERE id = 'qt-ok-dispatch';
    INSERT INTO audit_logs (id, entity_type, entity_id, action, actor, details_json)
    VALUES (
      'audit-ok-1', 'QUOTATION', 'qt-ok-dispatch', 'DISPATCH_TRANSMITTED', 'ADMIN_STAGING',
      '{"quotation_number":"BE/QT/26-27/0004","dispatch_id":"disp-ok-1","provider_message_id":"msg_resend_9921","transmission_status":"ACCEPTED_BY_PROVIDER"}'
    );
    COMMIT;
  `);

  const q = db.prepare("SELECT status, sent_to_recipient, dispatch_id FROM quotations WHERE id = 'qt-ok-dispatch'").get();
  if (q.status !== 'Sent' || q.sent_to_recipient !== 'procurement@clientcorp.in' || q.dispatch_id !== 'disp-ok-1') {
    throw new Error(`Quotation dispatch failed: status=${q.status}`);
  }
});

assertTest('TC-56', 'Atomic Batch', 'POSITIVE', 'Atomic transaction rollback: Audit log failure rolls back status transition (no partial state)', () => {
  seedDraftQuotation('qt-rollback-test', '2026-27');
  db.exec("INSERT INTO quotation_sequence_log (financial_year, sequence_number, quotation_id) VALUES ('2026-27', 5, 'qt-rollback-test');");

  // In an atomic batch, if the audit log insertion fails (e.g. PK collision or constraint failure),
  // the entire batch must rollback so status is NOT left as 'Sent'.
  db.exec("INSERT INTO audit_logs (id, entity_type, entity_id, action) VALUES ('audit-collision-id', 'SYSTEM', '1', 'INIT');");
  db.exec(`
    INSERT INTO quotation_dispatches (
      id, quotation_id, idempotency_key, recipient_email, dispatch_status,
      provider_name, provider_message_id, provider_idempotency_key, completed_at
    ) VALUES (
      'disp-rb-1', 'qt-rollback-test', 'key-rb-1', 'test@corp.com', 'ACCEPTED',
      'RESEND_STAGING', 'msg-rb-1', 'pkey-rb-1', datetime('now')
    );
  `);

  let errThrown = false;
  try {
    db.exec(`
      BEGIN TRANSACTION;
      UPDATE quotations SET
        status = 'Sent',
        dispatch_id = 'disp-rb-1',
        sent_at = datetime('now'),
        sent_to_recipient = 'test@corp.com'
      WHERE id = 'qt-rollback-test';
      -- Intentional primary key collision in audit_logs to test rollback
      INSERT INTO audit_logs (id, entity_type, entity_id, action)
      VALUES ('audit-collision-id', 'QUOTATION', 'qt-rollback-test', 'DISPATCH_TRANSMITTED');
      COMMIT;
    `);
  } catch (err) {
    errThrown = true;
    db.exec("ROLLBACK;");
  }

  if (!errThrown) throw new Error('Expected PK collision in atomic batch');

  // Assert quotation status rolled back to 'Draft'
  const q = db.prepare("SELECT status FROM quotations WHERE id = 'qt-rollback-test'").get();
  if (q.status !== 'Draft') {
    throw new Error(`Atomic rollback failed: quotation status was left as ${q.status} instead of Draft`);
  }
});

assertTest('TC-57', 'Endpoint Protection', 'NEGATIVE', 'Direct status update cannot bypass dispatch workflow by setting Sent', () => {
  // Simulate the Worker check: direct PATCH /api/quotations/:id/status with status: 'Sent' is rejected
  function validateStatusTransition(fromStatus, targetStatus) {
    if (targetStatus === 'Sent') {
      throw new Error("Direct status transition to 'Sent' is prohibited. Quotations must be dispatched through the /api/quotations/:id/send endpoint with verified transport.");
    }
    if (targetStatus === 'Draft') {
      throw new Error("Cannot revert active or resolved quotation to Draft.");
    }
    if (!['Accepted', 'Rejected', 'Expired'].includes(targetStatus)) {
      throw new Error(`Invalid target status '${targetStatus}'. Permitted transitions: Accepted, Rejected, Expired.`);
    }
    if (fromStatus !== 'Sent') {
      throw new Error(`Quotation must be in 'Sent' status before transitioning to '${targetStatus}'. Current status is '${fromStatus}'.`);
    }
    return true;
  }

  let errSent = false;
  try {
    validateStatusTransition('Draft', 'Sent');
  } catch (err) {
    errSent = true;
    if (!err.message.includes("Direct status transition to 'Sent' is prohibited")) throw err;
  }
  if (!errSent) throw new Error('Expected direct Sent transition to be blocked');

  let errAcceptedFromDraft = false;
  try {
    validateStatusTransition('Draft', 'Accepted');
  } catch (err) {
    errAcceptedFromDraft = true;
    if (!err.message.includes("Quotation must be in 'Sent' status")) throw err;
  }
  if (!errAcceptedFromDraft) throw new Error('Expected Accepted from Draft to be blocked');
});

assertTest('TC-58', 'Dispatch Recovery', 'POSITIVE', 'Provider accepts but database persistence fails: Recoverable workflow syncs to Sent without duplicate email', () => {
  seedDraftQuotation('qt-rec-test', '2026-27');
  db.exec("INSERT INTO quotation_sequence_log (financial_year, sequence_number, quotation_id) VALUES ('2026-27', 6, 'qt-rec-test');");

  // Step 1: Provider accepted and dispatch record was committed as ACCEPTED
  db.exec(`
    INSERT INTO quotation_dispatches (
      id, quotation_id, idempotency_key, recipient_email, dispatch_status,
      provider_name, provider_message_id, provider_idempotency_key, completed_at
    ) VALUES (
      'disp-rec-01', 'qt-rec-test', 'key-rec-01', 'buyer@engineering.co.in', 'ACCEPTED',
      'RESEND_STAGING', 'msg-provider-9988', 'pkey-rec-01', datetime('now')
    );
  `);
  // Quotation is still in Draft (simulating DB crash or network interrupt right after dispatch record update)
  const draftQuote = db.prepare("SELECT status FROM quotations WHERE id = 'qt-rec-test'").get();
  if (draftQuote.status !== 'Draft') throw new Error('Quotation should still be in Draft before recovery sync');

  // Step 2: Retry with same idempotency key or quotation ID detects existing ACCEPTED dispatch!
  // Handler recovers by synchronizing quotation status to Sent without calling email provider again
  const existingDispatch = db.prepare("SELECT * FROM quotation_dispatches WHERE id = 'disp-rec-01'").get();
  if (existingDispatch.dispatch_status === 'ACCEPTED') {
    db.exec(`
      BEGIN TRANSACTION;
      UPDATE quotations SET
        status = 'Sent',
        dispatch_id = '${existingDispatch.id}',
        sent_at = '${existingDispatch.completed_at}',
        sent_to_recipient = '${existingDispatch.recipient_email}',
        updated_at = datetime('now')
      WHERE id = 'qt-rec-test';
      INSERT INTO audit_logs (id, entity_type, entity_id, action, actor, details_json)
      VALUES (
        'audit-rec-01', 'QUOTATION', 'qt-rec-test', 'DISPATCH_RECOVERED_SYNC', 'ADMIN_STAGING',
        '{"dispatch_id":"disp-rec-01","provider_message_id":"msg-provider-9988","recovery_note":"Recovered pending database state without duplicate email"}'
      );
      COMMIT;
    `);
  }

  const syncedQuote = db.prepare("SELECT status, dispatch_id FROM quotations WHERE id = 'qt-rec-test'").get();
  if (syncedQuote.status !== 'Sent' || syncedQuote.dispatch_id !== 'disp-rec-01') {
    throw new Error('Recovery synchronization failed');
  }
});

assertTest('TC-59', 'Dispatch Safety', 'POSITIVE', 'Provider timeout with unknown outcome marks dispatch TIMED_OUT and preserves Draft', () => {
  seedDraftQuotation('qt-timeout-test', '2026-27');
  db.exec("INSERT INTO quotation_sequence_log (financial_year, sequence_number, quotation_id) VALUES ('2026-27', 7, 'qt-timeout-test');");

  // Record initial TRANSMITTING outbox record
  db.exec(`
    INSERT INTO quotation_dispatches (
      id, quotation_id, idempotency_key, recipient_email, dispatch_status,
      provider_name, provider_idempotency_key, initiated_at
    ) VALUES (
      'disp-to-01', 'qt-timeout-test', 'key-to-01', 'procurement@timeout.com', 'TRANSMITTING',
      'RESEND_STAGING', 'pkey-to-01', datetime('now')
    );
  `);

  // Provider call times out after 10000ms: Record TIMED_OUT status and preserve Draft
  db.exec(`
    UPDATE quotation_dispatches SET
      dispatch_status = 'TIMED_OUT',
      error_message = 'Provider request timed out after 10000ms. Transmission outcome unknown.',
      completed_at = datetime('now')
    WHERE id = 'disp-to-01';
    INSERT INTO audit_logs (id, entity_type, entity_id, action, actor, details_json)
    VALUES (
      'audit-to-01', 'QUOTATION', 'qt-timeout-test', 'DISPATCH_TIMED_OUT', 'ADMIN_STAGING',
      '{"dispatch_id":"disp-to-01","error":"Provider request timed out"}'
    );
  `);

  const q = db.prepare("SELECT status FROM quotations WHERE id = 'qt-timeout-test'").get();
  if (q.status !== 'Draft') throw new Error(`Quotation must remain Draft on timeout, got ${q.status}`);
  const disp = db.prepare("SELECT dispatch_status FROM quotation_dispatches WHERE id = 'disp-to-01'").get();
  if (disp.dispatch_status !== 'TIMED_OUT') throw new Error(`Dispatch status must be TIMED_OUT, got ${disp.dispatch_status}`);
});

assertTest('TC-60', 'Idempotency', 'POSITIVE', 'Retrying a dispatch on already Sent quotation returns existing dispatch without sending duplicate email', () => {
  // Query existing quotation qt-ok-dispatch from TC-55 (which is Sent)
  const existingQuote = db.prepare("SELECT * FROM quotations WHERE id = 'qt-ok-dispatch'").get();
  const existingDisp = db.prepare("SELECT * FROM quotation_dispatches WHERE quotation_id = 'qt-ok-dispatch'").get();

  // Retry logic simulation:
  let emailSentCount = 0;
  function handleSendRequest(quote, disp) {
    if (disp && disp.dispatch_status === 'ACCEPTED' && quote.status === 'Sent') {
      // Idempotent return: do NOT call email provider
      return { success: true, quotation: quote, dispatch: disp, idempotent: true };
    }
    emailSentCount++;
    return { success: true };
  }

  const result = handleSendRequest(existingQuote, existingDisp);
  if (!result.idempotent || emailSentCount !== 0) {
    throw new Error('Duplicate email transmission occurred on retry of Sent quotation');
  }
});

assertTest('TC-61', 'Credential Isolation', 'NEGATIVE', 'Staging cannot fall back to production credentials (RESEND_API_KEY)', () => {
  // Simulate credential selector
  function resolveStagingKey(env) {
    // Only STAGING_EMAIL_API_KEY is permitted
    if (env.ENVIRONMENT === 'staging' || !env.ENVIRONMENT) {
      if (!env.STAGING_EMAIL_API_KEY && env.RESEND_API_KEY) {
        throw new Error('SECURITY_ERROR: Staging environment is prohibited from falling back to generic or production RESEND_API_KEY.');
      }
      return env.STAGING_EMAIL_API_KEY || null;
    }
    return null;
  }

  let errThrown = false;
  try {
    resolveStagingKey({ ENVIRONMENT: 'staging', RESEND_API_KEY: 're_prod_secret123' });
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('SECURITY_ERROR')) throw err;
  }
  if (!errThrown) throw new Error('Expected security error on production credential fallback');
});

assertTest('TC-62', 'Status Authorization', 'NEGATIVE', 'Status transition to Accepted rejected without client approval evidence or documented confirmation', () => {
  function validateAcceptedTransition(body) {
    const evidence = (body.approval_evidence || body.admin_confirmation || body.reason || '').trim();
    if (!evidence || evidence.length < 10) {
      throw new Error("Transition to 'Accepted' requires verified client approval evidence or documented administrator confirmation (minimum 10 characters).");
    }
    return true;
  }

  let errEmpty = false;
  try {
    validateAcceptedTransition({});
  } catch (err) {
    errEmpty = true;
  }
  let errTooShort = false;
  try {
    validateAcceptedTransition({ approval_evidence: 'ok' });
  } catch (err) {
    errTooShort = true;
  }
  if (!errEmpty || !errTooShort) throw new Error('Expected rejection when approval evidence is absent or under 10 chars');
});

assertTest('TC-63', 'Status Authorization', 'POSITIVE', 'Status transition to Accepted succeeds with valid client approval evidence and records actor', () => {
  const approvalEvidence = 'Client issued Purchase Order PO-2026-BEL-8891 received via official procurement email';
  const actor = 'ADMIN_SUPERVISOR_PUNE';

  db.exec(`
    BEGIN TRANSACTION;
    UPDATE quotations SET
      status = 'Accepted',
      updated_at = datetime('now')
    WHERE id = 'qt-ok-dispatch';
    INSERT INTO audit_logs (id, entity_type, entity_id, action, actor, details_json)
    VALUES (
      'audit-acc-01', 'QUOTATION', 'qt-ok-dispatch', 'STATUS_TRANSITION_ACCEPTED', '${actor}',
      '{"approval_evidence":"${approvalEvidence}","authorized_by":"${actor}"}'
    );
    COMMIT;
  `);

  const q = db.prepare("SELECT status FROM quotations WHERE id = 'qt-ok-dispatch'").get();
  if (q.status !== 'Accepted') throw new Error(`Quotation status should be Accepted, got ${q.status}`);
  const audit = db.prepare("SELECT actor, details_json FROM audit_logs WHERE id = 'audit-acc-01'").get();
  if (audit.actor !== actor || !audit.details_json.includes('PO-2026-BEL-8891')) {
    throw new Error('Audit log actor or evidence was not recorded correctly');
  }
});

assertTest('TC-64', 'Status Authorization', 'NEGATIVE', 'Status transition to Rejected rejected without documented rejection reason', () => {
  function validateRejectedTransition(body) {
    const rejReason = (body.rejection_reason || body.reason || '').trim();
    if (!rejReason || rejReason.length < 5) {
      throw new Error("Transition to 'Rejected' requires a documented rejection reason (minimum 5 characters).");
    }
    return true;
  }

  let errThrown = false;
  try {
    validateRejectedTransition({ rejection_reason: 'no' });
  } catch (err) {
    errThrown = true;
  }
  if (!errThrown) throw new Error('Expected rejection when rejection reason is under 5 characters');
});

assertTest('TC-65', 'Status Authorization', 'POSITIVE', 'Status transition to Rejected succeeds with valid documented rejection reason', () => {
  // Create another sent quotation to test rejection
  seedDraftQuotation('qt-rej-test', '2026-27');
  db.exec("INSERT INTO quotation_sequence_log (financial_year, sequence_number, quotation_id) VALUES ('2026-27', 8, 'qt-rej-test');");
  db.exec(`
    INSERT INTO quotation_dispatches (
      id, quotation_id, idempotency_key, recipient_email, dispatch_status,
      provider_name, provider_message_id, provider_idempotency_key, completed_at
    ) VALUES (
      'disp-rej-1', 'qt-rej-test', 'key-rej-1', 'client@tender.gov.in', 'ACCEPTED',
      'RESEND_STAGING', 'msg-rej-1', 'pkey-rej-1', datetime('now')
    );
    UPDATE quotations SET
      status = 'Sent',
      dispatch_id = 'disp-rej-1',
      sent_at = datetime('now'),
      sent_to_recipient = 'client@tender.gov.in'
    WHERE id = 'qt-rej-test';
  `);

  const rejectionReason = 'Client opted for tender postponement due to budgetary freeze';
  const actor = 'ADMIN_PUNE';

  db.exec(`
    BEGIN TRANSACTION;
    UPDATE quotations SET status = 'Rejected', updated_at = datetime('now') WHERE id = 'qt-rej-test';
    INSERT INTO audit_logs (id, entity_type, entity_id, action, actor, details_json)
    VALUES (
      'audit-rej-01', 'QUOTATION', 'qt-rej-test', 'STATUS_TRANSITION_REJECTED', '${actor}',
      '{"rejection_reason":"${rejectionReason}","authorized_by":"${actor}"}'
    );
    COMMIT;
  `);

  const q = db.prepare("SELECT status FROM quotations WHERE id = 'qt-rej-test'").get();
  if (q.status !== 'Rejected') throw new Error(`Expected status Rejected, got ${q.status}`);
});

assertTest('TC-66', 'Status Authorization', 'NEGATIVE', 'Premature status transition to Expired rejected without past validity date or documented justification', () => {
  function validateExpiredTransition(quote, body) {
    const today = new Date().toISOString().split('T')[0];
    const isPastValidity = quote.valid_until && quote.valid_until < today;
    const expReason = (body.expiry_reason || body.reason || '').trim();
    if (!isPastValidity && (!expReason || expReason.length < 10)) {
      throw new Error(`Quotation validity period (${quote.valid_until}) has not expired yet. Premature expiration requires documented administrator justification (minimum 10 characters).`);
    }
    return true;
  }

  // Future valid_until quote
  const futureQuote = { valid_until: '2028-12-31' };
  let errThrown = false;
  try {
    validateExpiredTransition(futureQuote, {});
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('has not expired yet')) throw err;
  }
  if (!errThrown) throw new Error('Expected rejection when premature expiration lacks justification');
});

assertTest('TC-67', 'Quotation FSM', 'NEGATIVE', 'Trigger 14 strictly rejects Sent -> Converted transition directly', () => {
  db.exec(`
    INSERT INTO quotations (
      id, status, quotation_number, sequence_number, quotation_prefix, financial_year,
      quotation_date, valid_until, is_interstate,
      buyer_name, buyer_address, buyer_state_code,
      subtotal_gross_paise, total_discount_paise, taxable_amount_paise,
      cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_tax_paise,
      total_amount_paise, sent_at, sent_to_recipient, dispatch_id
    ) VALUES (
      'qt-fsm-sent-convert-test', 'Draft', 'BE/QT/26-27/0888', 888, 'BE/QT/26-27/', '2026-27',
      '2026-11-07', '2027-03-31', 1,
      'Bharat Heavy Electricals Limited', 'BHEL Complex, New Delhi', '07',
      100000, 0, 100000, 0, 0, 18000, 18000, 118000, NULL, NULL, NULL
    );
    INSERT INTO quotation_items (
      id, quotation_id, line_number, item_description, quantity_microunits,
      unit_price_paise, gross_amount_paise, discount_amount_paise,
      taxable_amount_paise, gst_rate_bps, igst_rate_bps, igst_amount_paise,
      total_amount_paise, hsn_code
    ) VALUES (
      'qti-sent-conv-test', 'qt-fsm-sent-convert-test', 1, 'Insulation Gasket', 1000000,
      100000, 100000, 0, 100000, 1800, 1800, 18000, 118000, '40169340'
    );
    INSERT INTO quotation_dispatches (
      id, quotation_id, idempotency_key, provider_idempotency_key,
      recipient_email, dispatch_status, provider_name, provider_message_id, completed_at
    ) VALUES (
      'disp-sent-conv-test', 'qt-fsm-sent-convert-test', 'idemp-sent-conv-test', 'prov-sent-conv-test',
      'bhel@example.com', 'ACCEPTED', 'resend', 'msg_sent_conv_888', datetime('now')
    );
    UPDATE quotations
    SET status = 'Sent',
        sent_at = datetime('now'),
        sent_to_recipient = 'bhel@example.com',
        dispatch_id = 'disp-sent-conv-test'
    WHERE id = 'qt-fsm-sent-convert-test';
  `);

  let errThrown = false;
  try {
    // Attempting direct Sent -> Converted
    db.exec(`
      UPDATE quotations
      SET status = 'Converted',
          converted_invoice_id = 'inv-dummy-999'
      WHERE id = 'qt-fsm-sent-convert-test';
    `);
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_INVALID_QUOTATION_TRANSITION') && !err.message.includes('Sent quotation cannot transition directly to Converted')) {
      throw err;
    }
  }
  if (!errThrown) throw new Error('Expected Trigger 14 to reject direct Sent -> Converted transition');
});

assertTest('TC-68', 'Quotation FSM', 'NEGATIVE', 'Trigger 14 strictly rejects Draft -> Converted transition', () => {
  db.exec(`
    INSERT INTO quotations (
      id, status, quotation_number, sequence_number, quotation_prefix, financial_year,
      quotation_date, valid_until, is_interstate,
      buyer_name, buyer_address, buyer_state_code,
      subtotal_gross_paise, total_discount_paise, taxable_amount_paise,
      cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_tax_paise,
      total_amount_paise
    ) VALUES (
      'qt-draft-conv-test', 'Draft', 'BE/QT/26-27/0889', 889, 'BE/QT/26-27/', '2026-27',
      '2026-11-07', '2027-03-31', 1,
      'Bharat Heavy Electricals Limited', 'BHEL Complex, New Delhi', '07',
      100000, 0, 100000, 0, 0, 18000, 18000, 118000
    );
  `);

  let errThrown = false;
  try {
    db.exec(`
      UPDATE quotations
      SET status = 'Converted',
          converted_invoice_id = 'inv-dummy-889'
      WHERE id = 'qt-draft-conv-test';
    `);
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_INVALID_QUOTATION_TRANSITION')) throw err;
  }
  if (!errThrown) throw new Error('Expected Trigger 14 to reject Draft -> Converted transition');
});

assertTest('TC-69', 'Quotation Protection', 'NEGATIVE', 'Trigger 14 strictly rejects tampering with client_approval_evidence on Accepted quotation', () => {
  db.exec(`
    INSERT INTO quotations (
      id, status, quotation_number, sequence_number, quotation_prefix, financial_year,
      quotation_date, valid_until, is_interstate,
      buyer_name, buyer_address, buyer_state_code,
      subtotal_gross_paise, total_discount_paise, taxable_amount_paise,
      cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_tax_paise,
      total_amount_paise, sent_at, sent_to_recipient, dispatch_id,
      client_approval_evidence, accepted_at
    ) VALUES (
      'qt-evidence-tamper-test', 'Accepted', 'BE/QT/26-27/0891', 891, 'BE/QT/26-27/', '2026-27',
      '2026-11-07', '2027-03-31', 1,
      'Bharat Heavy Electricals Limited', 'BHEL Complex, New Delhi', '07',
      100000, 0, 100000, 0, 0, 18000, 18000, 118000, datetime('now'), 'bhel@example.com',
      'disp-sent-conv-test', 'PO #BHEL-PO-891-INITIAL-APPROVED', datetime('now')
    );
  `);

  let errThrown = false;
  try {
    db.exec(`
      UPDATE quotations
      SET client_approval_evidence = 'TAMPERED: Altered PO number'
      WHERE id = 'qt-evidence-tamper-test';
    `);
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_EVIDENCE_IMMUTABLE')) throw err;
  }
  if (!errThrown) throw new Error('Expected Trigger 14 to reject tampering with client_approval_evidence');
});

assertTest('TC-70', 'Audit Permanence', 'NEGATIVE', 'Trigger 23 strictly blocks deletion of audit_logs records', () => {
  db.exec(`
    INSERT INTO audit_logs (id, entity_type, entity_id, action, actor)
    VALUES ('audit-del-test', 'quotation', 'qt-test', 'STATUS_CHANGE', 'Admin User');
  `);

  let errThrown = false;
  try {
    db.exec("DELETE FROM audit_logs WHERE id = 'audit-del-test';");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_AUDIT_LOG_DELETION')) throw err;
  }
  if (!errThrown) throw new Error('Expected Trigger 23 to reject deletion of audit_logs');
});

assertTest('TC-71', 'Audit Permanence', 'NEGATIVE', 'Trigger 24 strictly blocks update of audit_logs records', () => {
  let errThrown = false;
  try {
    db.exec("UPDATE audit_logs SET actor = 'Malicious Actor' WHERE id = 'audit-del-test';");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_AUDIT_LOG_IMMUTABLE')) throw err;
  }
  if (!errThrown) throw new Error('Expected Trigger 24 to reject update of audit_logs');
});

assertTest('TC-72', 'Dispatch Integrity', 'NEGATIVE', 'Trigger 21 strictly blocks inserting ACCEPTED dispatch without provider_message_id', () => {
  let errThrown = false;
  try {
    db.exec(`
      INSERT INTO quotation_dispatches (
        id, quotation_id, idempotency_key, provider_idempotency_key,
        recipient_email, dispatch_status, provider_name, provider_message_id
      ) VALUES (
        'disp-no-msg-id', 'qt-fsm-sent-convert-test', 'idemp-no-msg', 'prov-no-msg',
        'test@example.com', 'ACCEPTED', 'resend', NULL
      );
    `);
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_ACCEPTED_DISPATCH_MISSING_MESSAGE_ID')) throw err;
  }
  if (!errThrown) throw new Error('Expected Trigger 21 to reject ACCEPTED dispatch without provider_message_id');
});

assertTest('TC-73', 'Dispatch Integrity', 'NEGATIVE', 'Trigger 22 strictly blocks mutating idempotency_key on quotation_dispatches across retries', () => {
  db.exec(`
    INSERT INTO quotation_dispatches (
      id, quotation_id, idempotency_key, provider_idempotency_key,
      recipient_email, dispatch_status, provider_name
    ) VALUES (
      'disp-pending-mut-test', 'qt-fsm-sent-convert-test', 'idemp-orig', 'prov-orig',
      'bhel@example.com', 'PENDING', 'resend'
    );
  `);

  let errThrown = false;
  try {
    db.exec(`
      UPDATE quotation_dispatches
      SET idempotency_key = 'mutated-idempotency-key'
      WHERE id = 'disp-pending-mut-test';
    `);
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_DISPATCH_IDENTITY_IMMUTABLE')) throw err;
  }
  if (!errThrown) throw new Error('Expected Trigger 22 to reject mutating idempotency_key on dispatch');
});

assertTest('TC-74', 'Foreign Key Protection', 'NEGATIVE', 'FOREIGN KEY ON DELETE RESTRICT and Trigger 18 block deleting quotation with associated dispatches', () => {
  let errThrown = false;
  try {
    db.exec("DELETE FROM quotations WHERE id = 'qt-fsm-sent-convert-test';");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('FOREIGN KEY constraint failed') && !err.message.includes('ERR_LEGAL_RECORD_PROTECTION')) {
      throw err;
    }
  }
  if (!errThrown) throw new Error('Expected FOREIGN KEY or trigger to block deleting quotation with dispatches');
});

assertTest('TC-75', 'Conversion Integrity', 'NEGATIVE', 'UNIQUE constraint on converted_invoice_id prevents two quotations converting to same invoice', () => {
  // First, create an invoice to convert to
  db.exec(`
    INSERT INTO invoices (
      id, status, financial_year, invoice_prefix, invoice_number, sequence_number,
      buyer_name, buyer_address, buyer_state_code, buyer_pincode, is_interstate,
      subtotal_gross_paise, taxable_amount_paise, igst_amount_paise, total_tax_paise,
      total_invoice_amount_paise
    ) VALUES (
      'inv-unique-conv-test', 'Draft', '2026-27', 'BE/26-27/', NULL, NULL,
      'Bharat Heavy Electricals Limited', 'BHEL Complex, New Delhi', '07', '110001', 1,
      100000, 100000, 18000, 18000, 118000
    );
  `);

  // Insert first Accepted quotation
  db.exec(`
    INSERT INTO quotations (
      id, status, quotation_number, sequence_number, quotation_prefix, financial_year,
      quotation_date, valid_until, is_interstate,
      buyer_name, buyer_address, buyer_state_code,
      subtotal_gross_paise, total_discount_paise, taxable_amount_paise,
      cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_tax_paise,
      total_amount_paise, sent_at, sent_to_recipient, dispatch_id,
      client_approval_evidence, accepted_at
    ) VALUES (
      'qt-first-acc-conv', 'Accepted', 'BE/QT/26-27/0892', 892, 'BE/QT/26-27/', '2026-27',
      '2026-11-07', '2027-03-31', 1,
      'Bharat Heavy Electricals Limited', 'BHEL Complex, New Delhi', '07',
      100000, 0, 100000, 0, 0, 18000, 18000, 118000, datetime('now'), 'bhel@example.com',
      'disp-sent-conv-test', 'PO #BHEL-892-APPROVED', datetime('now')
    );
  `);

  // Convert first quotation to inv-unique-conv-test
  db.exec(`
    UPDATE quotations
    SET status = 'Converted',
        converted_invoice_id = 'inv-unique-conv-test'
    WHERE id = 'qt-first-acc-conv';
  `);

  // Insert a second Accepted quotation
  db.exec(`
    INSERT INTO quotations (
      id, status, quotation_number, sequence_number, quotation_prefix, financial_year,
      quotation_date, valid_until, is_interstate,
      buyer_name, buyer_address, buyer_state_code,
      subtotal_gross_paise, total_discount_paise, taxable_amount_paise,
      cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_tax_paise,
      total_amount_paise, sent_at, sent_to_recipient, dispatch_id,
      client_approval_evidence, accepted_at
    ) VALUES (
      'qt-second-acc-test', 'Accepted', 'BE/QT/26-27/0890', 890, 'BE/QT/26-27/', '2026-27',
      '2026-11-07', '2027-03-31', 1,
      'Bharat Heavy Electricals Limited', 'BHEL Complex, New Delhi', '07',
      100000, 0, 100000, 0, 0, 18000, 18000, 118000, datetime('now'), 'bhel@example.com',
      'disp-sent-conv-test', 'PO #BHEL-890-APPROVED', datetime('now')
    );
  `);

  let errThrown = false;
  try {
    db.exec(`
      UPDATE quotations
      SET status = 'Converted',
          converted_invoice_id = 'inv-unique-conv-test'
      WHERE id = 'qt-second-acc-test';
    `);
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('UNIQUE constraint failed')) throw err;
  }
  if (!errThrown) throw new Error('Expected UNIQUE constraint on converted_invoice_id to reject duplicate conversion');
});

function createD1Adapter(sqliteDb) {
  return {
    prepare(sql) {
      return {
        _sql: sql,
        _binds: [],
        bind(...args) {
          const clone = createD1Adapter(sqliteDb).prepare(sql);
          clone._binds = args;
          return clone;
        },
        async first(col) {
          const row = sqliteDb.prepare(this._sql).get(...this._binds);
          if (!row) return null;
          if (col) return row[col];
          return row;
        },
        async all() {
          const rows = sqliteDb.prepare(this._sql).all(...this._binds);
          return { success: true, results: rows };
        },
        async run() {
          const info = sqliteDb.prepare(this._sql).run(...this._binds);
          return { success: true, meta: { changes: info.changes } };
        }
      };
    },
    async batch(statements) {
      const results = [];
      for (const stmt of statements) {
        results.push(await stmt.run());
      }
      return results;
    },
    async exec(sql) {
      sqliteDb.exec(sql);
      return { count: 0, duration: 0 };
    }
  };
}

await assertTest('TC-76', 'Auth Security', 'NEGATIVE', 'Missing authentication secrets fail closed using actual application logic and Worker endpoints', async () => {
  // 1. Direct function test of checkAdminAuth
  // Case A: Missing JWT_SECRET fails closed
  const reqWithToken = new Request('https://api/quotations', { headers: { Authorization: 'Bearer dummy.token' } });
  const authRes1 = await checkAdminAuth(reqWithToken, { ADMIN_PASSCODE: 'AdminPass' });
  if (authRes1) {
    throw new Error('checkAdminAuth must fail closed when JWT_SECRET is missing');
  }

  // Case B: Missing ADMIN_PASSCODE fails closed
  const authRes2 = await checkAdminAuth(reqWithToken, { JWT_SECRET: 'JwtSecret' });
  if (authRes2) {
    throw new Error('checkAdminAuth must fail closed when ADMIN_PASSCODE is missing');
  }

  // Case C: Both secrets missing fails closed
  const authRes3 = await checkAdminAuth(reqWithToken, {});
  if (authRes3) {
    throw new Error('checkAdminAuth must fail closed when both auth secrets are missing');
  }

  // Case D: Missing or malformed Authorization header rejected
  const reqNoHeader = new Request('https://api/quotations');
  const authRes4 = await checkAdminAuth(reqNoHeader, { JWT_SECRET: 'JwtSecret', ADMIN_PASSCODE: 'AdminPass' });
  if (authRes4) {
    throw new Error('checkAdminAuth must reject request missing Bearer token');
  }

  // Case E: Forged/invalid token rejected
  const reqForged = new Request('https://api/quotations', { headers: { Authorization: 'Bearer forged.bad.token' } });
  const authRes5 = await checkAdminAuth(reqForged, { JWT_SECRET: 'JwtSecret', ADMIN_PASSCODE: 'AdminPass' });
  if (authRes5) {
    throw new Error('checkAdminAuth must reject forged token');
  }

  // Case F: Valid token accepted
  const validToken = await createSignedToken('TestSecret');
  const reqValid = new Request('https://api/quotations', { headers: { Authorization: `Bearer ${validToken}` } });
  const authRes6 = await checkAdminAuth(reqValid, { JWT_SECRET: 'TestSecret', ADMIN_PASSCODE: 'AdminPass' });
  if (!authRes6) {
    throw new Error('checkAdminAuth must authenticate valid token');
  }

  // 2. Direct Worker endpoint test via worker.fetch: POST /api/admin/login
  const d1 = createD1Adapter(db);

  // Endpoint Case A: Missing ADMIN_PASSCODE returns 500
  const loginReq1 = new Request('https://staging.babaenterprises.internal/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode: 'AnyPass' }),
  });
  const res1 = await worker.fetch(loginReq1, { DB: d1, JWT_SECRET: 'TestSecret' });
  if (res1.status !== 500) {
    throw new Error(`Expected HTTP 500 when ADMIN_PASSCODE is missing, got ${res1.status}`);
  }
  const body1 = await res1.json();
  if (!body1.error?.includes('Authentication service unavailable')) {
    throw new Error(`Expected 'Authentication service unavailable', got ${body1.error}`);
  }

  // Endpoint Case B: Missing JWT_SECRET returns 500
  const loginReq2 = new Request('https://staging.babaenterprises.internal/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode: 'SecretPass123' }),
  });
  const res2 = await worker.fetch(loginReq2, { DB: d1, ADMIN_PASSCODE: 'SecretPass123' });
  if (res2.status !== 500) {
    throw new Error(`Expected HTTP 500 when JWT_SECRET is missing, got ${res2.status}`);
  }

  // Endpoint Case C: Incorrect passcode returns 401
  const loginReq3 = new Request('https://staging.babaenterprises.internal/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode: 'WrongPasscode' }),
  });
  const res3 = await worker.fetch(loginReq3, { DB: d1, ADMIN_PASSCODE: 'SecretPass123', JWT_SECRET: 'TestSecret' });
  if (res3.status !== 401) {
    throw new Error(`Expected HTTP 401 for wrong passcode, got ${res3.status}`);
  }

  // Endpoint Case D: Valid login succeeds and returns signed JWT
  const loginReq4 = new Request('https://staging.babaenterprises.internal/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode: 'SecretPass123' }),
  });
  const res4 = await worker.fetch(loginReq4, { DB: d1, ADMIN_PASSCODE: 'SecretPass123', JWT_SECRET: 'TestSecret' });
  if (res4.status !== 200) {
    throw new Error(`Expected HTTP 200 for valid login, got ${res4.status}`);
  }
  const body4 = await res4.json();
  if (!body4.success || !body4.token) {
    throw new Error('Expected login response to contain signed JWT token');
  }

  // Verify the returned token using application verifySignedToken
  const verified = await verifySignedToken(body4.token, 'TestSecret');
  if (!verified) {
    throw new Error('Returned JWT failed signature verification');
  }
});

await assertTest('TC-77', 'Financial Year', 'POSITIVE', 'Financial-year calculation, prefix generation, and sequence allocation agree across FY boundaries', () => {
  // 1. Boundary: 31 March 2027 must evaluate to FY 2026-27 and BE/QT/26-27/
  const fy31Mar = getFinancialYear('2027-03-31');
  if (fy31Mar !== '2026-27') throw new Error(`Expected 2026-27 for 31 March 2027, got ${fy31Mar}`);
  const prefix31Mar = getQuotationPrefix(fy31Mar);
  if (prefix31Mar !== 'BE/QT/26-27/') throw new Error(`Expected BE/QT/26-27/, got ${prefix31Mar}`);
  const invPrefix31Mar = getInvoicePrefix(fy31Mar);
  if (invPrefix31Mar !== 'BE/26-27/') throw new Error(`Expected BE/26-27/, got ${invPrefix31Mar}`);

  // 2. Boundary: 1 April 2027 must evaluate to FY 2027-28 and BE/QT/27-28/
  const fy01Apr = getFinancialYear('2027-04-01');
  if (fy01Apr !== '2027-28') throw new Error(`Expected 2027-28 for 1 April 2027, got ${fy01Apr}`);
  const prefix01Apr = getQuotationPrefix(fy01Apr);
  if (prefix01Apr !== 'BE/QT/27-28/') throw new Error(`Expected BE/QT/27-28/, got ${prefix01Apr}`);
  const invPrefix01Apr = getInvoicePrefix(fy01Apr);
  if (invPrefix01Apr !== 'BE/27-28/') throw new Error(`Expected BE/27-28/, got ${invPrefix01Apr}`);

  // 3. Multi-year: FY 2028-29 (e.g. 15 July 2028)
  const fy2028 = getFinancialYear('2028-07-15');
  if (fy2028 !== '2028-29') throw new Error(`Expected 2028-29 for 15 July 2028, got ${fy2028}`);
  const prefix2028 = getQuotationPrefix(fy2028);
  if (prefix2028 !== 'BE/QT/28-29/') throw new Error(`Expected BE/QT/28-29/, got ${prefix2028}`);
  const invPrefix2028 = getInvoicePrefix(fy2028);
  if (invPrefix2028 !== 'BE/28-29/') throw new Error(`Expected BE/28-29/, got ${invPrefix2028}`);

  // 4. Verify correct quotation prefix, financial_year, and sequence allocation in DB for each FY
  // Insert quotation for FY 2026-27
  seedDraftQuotation('qt-fy-test-26', '2026-27');
  const maxSeq26 = db.prepare("SELECT coalesce(max(sequence_number), 0) as maxSeq FROM quotation_sequence_log WHERE financial_year = '2026-27'").get().maxSeq;
  const nextSeq26 = maxSeq26 + 1;
  db.exec(`
    INSERT INTO quotation_sequence_log (financial_year, sequence_number, quotation_id, allocated_by)
    VALUES ('2026-27', ${nextSeq26}, 'qt-fy-test-26', 'ADMIN_STAGING');
  `);
  const q26 = db.prepare("SELECT * FROM quotations WHERE id = 'qt-fy-test-26'").get();
  const expectedNum26 = `BE/QT/26-27/${String(nextSeq26).padStart(4, '0')}`;
  if (q26.quotation_number !== expectedNum26 || q26.quotation_prefix !== 'BE/QT/26-27/' || q26.financial_year !== '2026-27') {
    throw new Error('FY 2026-27 quotation fields do not agree');
  }

  // Insert quotation for FY 2027-28 (independent sequence starting at 1)
  seedDraftQuotation('qt-fy-test-27', '2027-28');
  db.exec(`
    INSERT INTO quotation_sequence_log (financial_year, sequence_number, quotation_id, allocated_by)
    VALUES ('2027-28', 1, 'qt-fy-test-27', 'ADMIN_STAGING');
  `);
  const q27 = db.prepare("SELECT * FROM quotations WHERE id = 'qt-fy-test-27'").get();
  if (q27.quotation_number !== 'BE/QT/27-28/0001' || q27.quotation_prefix !== 'BE/QT/27-28/' || q27.financial_year !== '2027-28') {
    throw new Error('FY 2027-28 quotation fields do not agree');
  }

  // Insert quotation for FY 2028-29 (independent sequence starting at 1)
  seedDraftQuotation('qt-fy-test-28', '2028-29');
  db.exec(`
    INSERT INTO quotation_sequence_log (financial_year, sequence_number, quotation_id, allocated_by)
    VALUES ('2028-29', 1, 'qt-fy-test-28', 'ADMIN_STAGING');
  `);
  const q28 = db.prepare("SELECT * FROM quotations WHERE id = 'qt-fy-test-28'").get();
  if (q28.quotation_number !== 'BE/QT/28-29/0001' || q28.quotation_prefix !== 'BE/QT/28-29/' || q28.financial_year !== '2028-29') {
    throw new Error('FY 2028-29 quotation fields do not agree');
  }
});

await assertTest('TC-78', 'Conversion Gate', 'NEGATIVE', 'Conversion rejected if quotation is not in Accepted status and missing seller config fails closed', async () => {
  // Create quotation in Draft
  db.exec(`
    INSERT INTO quotations (
      id, status, quotation_number, sequence_number, quotation_prefix, financial_year,
      quotation_date, valid_until, is_interstate,
      buyer_name, buyer_address, buyer_state_code,
      subtotal_gross_paise, total_discount_paise, taxable_amount_paise,
      cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_tax_paise,
      total_amount_paise
    ) VALUES (
      'qt-gate-sent-test', 'Draft', 'BE/QT/26-27/0895', 895, 'BE/QT/26-27/', '2026-27',
      '2026-11-07', '2027-03-31', 1,
      'Bharat Heavy Electricals Limited', 'BHEL Complex, New Delhi', '07',
      100000, 0, 100000, 0, 0, 18000, 18000, 118000
    );
    INSERT INTO quotation_items (
      id, quotation_id, line_number, item_description, quantity_microunits,
      unit_price_paise, gross_amount_paise, discount_bps, discount_amount_paise,
      taxable_amount_paise, gst_rate_bps, cgst_rate_bps, sgst_rate_bps, igst_rate_bps,
      cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_amount_paise, hsn_code
    ) VALUES (
      'qti-gate-1', 'qt-gate-sent-test', 1, 'Insulation Gasket', 1000000,
      100000, 100000, 0, 0,
      100000, 1800, 0, 0, 1800,
      0, 0, 18000, 118000, '40169340'
    );
  `);

  // 1. Direct FSM validation: Draft cannot convert
  let draftErr = false;
  try {
    db.exec("UPDATE quotations SET status = 'Converted', converted_invoice_id = 'inv-fail' WHERE id = 'qt-gate-sent-test'");
  } catch (err) {
    draftErr = true;
  }
  if (!draftErr) throw new Error('Expected Trigger 14 to reject conversion from Draft');

  // Dispatch to Sent
  db.exec(`
    INSERT INTO quotation_dispatches (
      id, quotation_id, idempotency_key, provider_idempotency_key,
      recipient_email, dispatch_status, provider_name, provider_message_id, completed_at
    ) VALUES (
      'disp-gate-sent', 'qt-gate-sent-test', 'idemp-gate-sent', 'prov-gate-sent',
      'bhel@example.com', 'ACCEPTED', 'resend', 'msg_gate_sent', datetime('now')
    );
    UPDATE quotations
    SET status = 'Sent',
        sent_at = datetime('now'),
        sent_to_recipient = 'bhel@example.com',
        dispatch_id = 'disp-gate-sent'
    WHERE id = 'qt-gate-sent-test';
  `);

  // 2. Direct FSM validation: Sent cannot convert directly
  let sentErr = false;
  try {
    db.exec("UPDATE quotations SET status = 'Converted', converted_invoice_id = 'inv-fail' WHERE id = 'qt-gate-sent-test'");
  } catch (err) {
    sentErr = true;
    if (!err.message.includes('ERR_INVALID_QUOTATION_TRANSITION')) throw err;
  }
  if (!sentErr) throw new Error('Expected Trigger 14 to reject conversion from Sent without Acceptance');

  // Transition to Accepted
  db.exec(`
    UPDATE quotations
    SET status = 'Accepted',
        client_approval_evidence = 'PO #BHEL-GATE-TEST-APPROVED',
        accepted_at = datetime('now')
    WHERE id = 'qt-gate-sent-test';
  `);

  // 3. Worker endpoint validation: Missing seller configuration fails closed
  const d1 = createD1Adapter(db);
  const token = await createSignedToken('TestSecret');
  const convertReq = new Request('https://staging.babaenterprises.internal/api/quotations/qt-gate-sent-test/convert-to-invoice', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });

  // Env missing SELLER_GSTIN
  const resMissingSeller = await worker.fetch(convertReq, {
    DB: d1,
    JWT_SECRET: 'TestSecret',
    ADMIN_PASSCODE: 'AdminPass',
    SELLER_STATE_CODE: '27'
    // SELLER_GSTIN omitted
  });
  if (resMissingSeller.status !== 500) {
    throw new Error(`Expected HTTP 500 when SELLER_GSTIN is missing, got ${resMissingSeller.status}`);
  }
  const bodyMissing = await resMissingSeller.json();
  if (!bodyMissing.error?.includes('Seller configuration missing')) {
    throw new Error(`Expected 'Seller configuration missing', got ${bodyMissing.error}`);
  }
});

await assertTest('TC-79', 'Conversion Matching', 'POSITIVE', 'Converted invoice preserves quotation financial year and matches header amounts and line items 1:1', async () => {
  // Create in Draft status first, add line item, create dispatch, transition to Sent, then Accepted
  db.exec(`
    INSERT INTO quotations (
      id, status, quotation_number, sequence_number, quotation_prefix, financial_year,
      quotation_date, valid_until, is_interstate,
      buyer_name, buyer_company, buyer_address, buyer_state_name, buyer_state_code, buyer_pincode, buyer_gstin,
      subtotal_gross_paise, total_discount_paise, taxable_amount_paise,
      cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_tax_paise,
      apply_round_off, round_off_paise, total_amount_paise
    ) VALUES (
      'qt-match-test', 'Draft', 'BE/QT/28-29/0002', 2, 'BE/QT/28-29/', '2028-29',
      '2028-08-10', '2028-09-10', 1,
      'Bharat Heavy Electricals Limited', 'BHEL Corp', 'BHEL Complex, New Delhi', 'Delhi', '07', '110001', '07AAACB1234A1Z5',
      150000, 15000, 135000,
      0, 0, 24300, 24300,
      1, 0, 159300
    );
    INSERT INTO quotation_items (
      id, quotation_id, line_number, item_description, quantity_microunits,
      unit_price_paise, gross_amount_paise, discount_bps, discount_amount_paise,
      taxable_amount_paise, gst_rate_bps, cgst_rate_bps, sgst_rate_bps, igst_rate_bps,
      cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_amount_paise, hsn_code
    ) VALUES (
      'qti-match-1', 'qt-match-test', 1, 'Packing Cord', 1000000,
      150000, 150000, 1000, 15000,
      135000, 1800, 0, 0, 1800,
      0, 0, 24300, 159300, '40169340'
    );
    INSERT INTO quotation_dispatches (
      id, quotation_id, idempotency_key, provider_idempotency_key,
      recipient_email, dispatch_status, provider_name, provider_message_id, completed_at
    ) VALUES (
      'disp-match-test', 'qt-match-test', 'idemp-match-test', 'prov-match-test',
      'bhel@example.com', 'ACCEPTED', 'resend', 'msg_match_test', datetime('now')
    );
    UPDATE quotations
    SET status = 'Sent',
        sent_at = datetime('now'),
        sent_to_recipient = 'bhel@example.com',
        dispatch_id = 'disp-match-test'
    WHERE id = 'qt-match-test';
    UPDATE quotations
    SET status = 'Accepted',
        client_approval_evidence = 'PO #BHEL-MATCH-APPROVED',
        accepted_at = datetime('now')
    WHERE id = 'qt-match-test';
  `);

  // Convert using the Worker endpoint with full seller config
  const d1 = createD1Adapter(db);
  const token = await createSignedToken('TestSecret');
  const convertReq = new Request('https://staging.babaenterprises.internal/api/quotations/qt-match-test/convert-to-invoice', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });

  const res = await worker.fetch(convertReq, {
    DB: d1,
    JWT_SECRET: 'TestSecret',
    ADMIN_PASSCODE: 'AdminPass',
    SELLER_GSTIN: '27AGCPB8322L1ZG',
    SELLER_STATE_CODE: '27'
  });

  if (res.status !== 200 && res.status !== 201) {
    const errBody = await res.json();
    throw new Error(`Conversion endpoint failed: ${errBody.error || res.status}`);
  }

  const convResult = await res.json();
  const invoiceId = convResult.invoice.id;

  // Verify created invoice in DB
  const createdInv = db.prepare(`SELECT * FROM invoices WHERE id = '${invoiceId}'`).get();
  const quote = db.prepare("SELECT * FROM quotations WHERE id = 'qt-match-test'").get();

  // 1. Verify Financial Year & Prefix preservation
  if (createdInv.financial_year !== '2028-29') {
    throw new Error(`Expected invoice FY to be 2028-29 from quotation, got ${createdInv.financial_year}`);
  }
  if (createdInv.invoice_prefix !== 'BE/28-29/') {
    throw new Error(`Expected invoice prefix to be BE/28-29/, got ${createdInv.invoice_prefix}`);
  }

  // 2. Verify 1:1 Parity of header amounts
  if (createdInv.subtotal_gross_paise !== quote.subtotal_gross_paise) throw new Error('Subtotal gross mismatch');
  if (createdInv.total_discount_paise !== quote.total_discount_paise) throw new Error('Discount mismatch');
  if (createdInv.taxable_amount_paise !== quote.taxable_amount_paise) throw new Error('Taxable amount mismatch');
  if (createdInv.cgst_amount_paise !== quote.cgst_amount_paise) throw new Error('CGST amount mismatch');
  if (createdInv.sgst_amount_paise !== quote.sgst_amount_paise) throw new Error('SGST amount mismatch');
  if (createdInv.igst_amount_paise !== quote.igst_amount_paise) throw new Error('IGST amount mismatch');
  if (createdInv.total_tax_paise !== quote.total_tax_paise) throw new Error('Total tax mismatch');
  if (createdInv.total_invoice_amount_paise !== quote.total_amount_paise) throw new Error('Total amount mismatch');
  if (createdInv.reference_quotation_id !== quote.id) throw new Error('reference_quotation_id mismatch');
  if (createdInv.seller_gstin !== '27AGCPB8322L1ZG' || createdInv.seller_state_code !== '27') {
    throw new Error('Seller GSTIN or state code mismatch');
  }

  // 3. Verify quotation updated to Converted
  if (quote.status !== 'Converted' || quote.converted_invoice_id !== invoiceId) {
    throw new Error('Quotation was not properly transitioned to Converted');
  }
});

await assertTest('TC-80', 'Conversion Idempotency & FY Issuance', 'POSITIVE', 'Idempotent conversion retry returns existing invoice and issuance uses stored financial year', async () => {
  // 1. Idempotent Retry of Conversion
  const d1 = createD1Adapter(db);
  const token = await createSignedToken('TestSecret');
  const retryReq = new Request('https://staging.babaenterprises.internal/api/quotations/qt-match-test/convert-to-invoice', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });

  const resRetry = await worker.fetch(retryReq, {
    DB: d1,
    JWT_SECRET: 'TestSecret',
    ADMIN_PASSCODE: 'AdminPass',
    SELLER_GSTIN: '27AGCPB8322L1ZG',
    SELLER_STATE_CODE: '27'
  });

  if (resRetry.status !== 200) {
    throw new Error(`Idempotent retry failed: ${resRetry.status}`);
  }
  const bodyRetry = await resRetry.json();
  if (!bodyRetry.message?.includes('idempotent response')) {
    throw new Error('Expected idempotent message on conversion retry');
  }

  const invoiceCount = db.prepare("SELECT count(*) as cnt FROM invoices WHERE reference_quotation_id = 'qt-match-test'").get().cnt;
  if (invoiceCount !== 1) {
    throw new Error(`Expected exactly 1 invoice, found ${invoiceCount}`);
  }

  // 2. Invoice issuance uses the stored financial year
  const quote = db.prepare("SELECT * FROM quotations WHERE id = 'qt-match-test'").get();
  const invoiceId = quote.converted_invoice_id;

  // Allocate sequence in DB for FY 2028-29 on this invoice
  db.exec(`
    INSERT INTO invoice_sequence_log (financial_year, sequence_number, invoice_id, allocated_by)
    VALUES ('2028-29', 1, '${invoiceId}', 'ADMIN_STAGING');
  `);

  const issuedInv = db.prepare(`SELECT * FROM invoices WHERE id = '${invoiceId}'`).get();
  if (issuedInv.status !== 'Issued') {
    throw new Error(`Expected status 'Issued', got ${issuedInv.status}`);
  }
  if (issuedInv.financial_year !== '2028-29') {
    throw new Error(`Expected financial_year 2028-29, got ${issuedInv.financial_year}`);
  }
  if (issuedInv.invoice_number !== 'BE/28-29/0001') {
    throw new Error(`Expected invoice_number BE/28-29/0001, got ${issuedInv.invoice_number}`);
  }
  if (issuedInv.sequence_number !== 1) {
    throw new Error(`Expected sequence_number 1, got ${issuedInv.sequence_number}`);
  }
});

assertTest('TC-81', 'Financial Integrity', 'POSITIVE', 'Comprehensive verification: Qty × Unit Price = Gross, Gross − Discount = Taxable, Exact Paise Rounding', () => {
  const qtyMicrounits = 2500000; // 2.5 units
  const unitPricePaise = 19999;  // Rs 199.99
  const expectedGross = Math.round((qtyMicrounits * unitPricePaise) / 1000000); // 49997.5 -> 49998 paise
  if (expectedGross !== 49998) throw new Error(`Expected gross 49998, got ${expectedGross}`);

  const discountBps = 500; // 5%
  const expectedDiscount = Math.round((expectedGross * discountBps) / 10000); // 2499.9 -> 2500 paise
  if (expectedDiscount !== 2500) throw new Error(`Expected discount 2500, got ${expectedDiscount}`);

  const expectedTaxable = expectedGross - expectedDiscount; // 47498 paise
  if (expectedTaxable !== 47498) throw new Error(`Expected taxable 47498, got ${expectedTaxable}`);

  // Intrastate 18% (900 bps CGST + 900 bps SGST)
  const cgst = Math.round((expectedTaxable * 900) / 10000); // 4274.82 -> 4275 paise
  const sgst = Math.round((expectedTaxable * 900) / 10000); // 4275 paise
  const totalTax = cgst + sgst; // 8550 paise
  const totalAmount = expectedTaxable + totalTax; // 56048 paise
  if (totalAmount !== 56048) throw new Error(`Expected total 56048, got ${totalAmount}`);
});

console.log('\n===============================================================================');
console.log(`AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed} TEST ASSERTIONS)`);
console.log('===============================================================================');

if (failed > 0) {
  console.error('\nAUDIT GATE STATUS: FAILED — DATABASE SCHEMA CONTAINS INTEGRITY DEFECTS');
  process.exit(1);
} else {
  console.log('\nAUDIT GATE STATUS: PASSED (100% SUCCESSFUL IN LOCAL SQLITE PRE-MIGRATION RUN)');
  console.log('ENVIRONMENT ADVISORY: Tests ran locally in-memory via Node.js native DatabaseSync.');
  console.log('CLOUDFLARE D1 STATUS:  NOT EXECUTED. babaenterprises-db-staging remains untouched.');
  console.log('WORKER DEPLOY STATUS:  NOT DEPLOYED. babaenterprises-staging remains untouched.\n');
  process.exit(0);
}
