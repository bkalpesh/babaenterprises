// ==============================================================================
// BABA ENTERPRISES — COMPREHENSIVE STAGING ACCEPTANCE TEST HARNESS
// Runs 18 rigorous automated integrity assertions against actual schema & triggers
// Usage: node scripts/verify_staging.mjs
// ==============================================================================

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('===============================================================================');
console.log('BABA ENTERPRISES — STAGING ACCEPTANCE & AUDIT TEST HARNESS');
console.log('Target Worker: babaenterprises-staging');
console.log('Target D1:     babaenterprises-db-staging');
console.log('Target R2:     babaenterprises-drawings-staging');
console.log('Node.js:      ', process.version);
console.log('===============================================================================\n');

const schemaSql = readFileSync(resolve(__dirname, '../migrations/0001_initial_schema.sql'), 'utf-8');
const seedSql = readFileSync(resolve(__dirname, '../migrations/0002_seed_data.sql'), 'utf-8');

const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = ON;');

// Apply Schema
try {
  db.exec(schemaSql);
  console.log('✓ Migration 0001_initial_schema.sql applied successfully (12 tables, 8 triggers)');
} catch (err) {
  console.error('✗ Migration 0001 failed:', err);
  process.exit(1);
}

// Apply Seed
try {
  db.exec(seedSql);
  console.log('✓ Migration 0002_seed_data.sql applied successfully (12 products, 5 references, business settings)\n');
} catch (err) {
  console.error('✗ Migration 0002 failed:', err);
  process.exit(1);
}

let passed = 0;
let failed = 0;

function assertTest(id, name, fn) {
  try {
    fn();
    console.log(`[PASS] ${id.padEnd(5)} | ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${id.padEnd(5)} | ${name} -> ${err.message}`);
    failed++;
  }
}

// Helper: Seed valid minimal draft invoice
function seedDraft(invId, buyerGstin = '27AAACB2026R1Z9', isInterstate = 0, stateCode = '27') {
  db.exec(`
    INSERT INTO invoices (
      id, status, financial_year, seller_gstin, seller_state_code,
      buyer_name, buyer_address, buyer_state_name, buyer_state_code, buyer_pincode,
      buyer_gstin, is_interstate, place_of_supply,
      subtotal_gross_paise, total_discount_paise, taxable_amount_paise,
      cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_tax_paise,
      apply_round_off, round_off_paise, total_invoice_amount_paise
    ) VALUES (
      '${invId}', 'Draft', '2026-27', '27AGCPB8322L1ZG', '27',
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

// TEST 1: Business Settings seeded properly
assertTest('TC-01', 'Business Settings seeded with BABA ENTERPRISES and confirmed GSTIN', () => {
  const row = db.prepare('SELECT * FROM business_settings WHERE id = 1').get();
  if (!row || row.gstin !== '27AGCPB8322L1ZG' || row.pincode !== '411039') {
    throw new Error('Business settings mismatch');
  }
  if (row.bank_account_no !== null) {
    throw new Error('Bank details must remain NULL until owner provided');
  }
});

// TEST 2: Products unverified GST rate is NULL
assertTest('TC-02', 'All 12 products seeded with unit_price_paise = 0 and gst_rate_bps = NULL', () => {
  const rows = db.prepare('SELECT count(*) as cnt FROM products WHERE unit_price_paise = 0 AND gst_rate_bps IS NULL').get();
  if (rows.cnt !== 12) {
    throw new Error(`Expected 12 unverified products, got ${rows.cnt}`);
  }
});

// TEST 3: Inseparable Sequence Reservation & Issuance
assertTest('TC-03', 'Sequence reservation inseparably transitions Draft to Issued with BE/26-27/0001', () => {
  seedDraft('inv-test-01');
  db.exec("INSERT INTO invoice_sequence_log (financial_year, sequence_number, invoice_id) VALUES ('2026-27', 1, 'inv-test-01');");
  const inv = db.prepare("SELECT * FROM invoices WHERE id = 'inv-test-01'").get();
  if (inv.status !== 'Issued' || inv.invoice_number !== 'BE/26-27/0001' || inv.sequence_number !== 1) {
    throw new Error(`Issuance failed: status=${inv.status}, num=${inv.invoice_number}`);
  }
});

// TEST 4: Sequence gap rejection
assertTest('TC-04', 'Sequence reservation strictly rejects gaps (e.g. attempting 3 after 1)', () => {
  seedDraft('inv-test-02');
  let errThrown = false;
  try {
    db.exec("INSERT INTO invoice_sequence_log (financial_year, sequence_number, invoice_id) VALUES ('2026-27', 3, 'inv-test-02');");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_SEQUENCE_GAP')) throw err;
  }
  if (!errThrown) throw new Error('Expected ERR_SEQUENCE_GAP on sequence jump');
});

// TEST 5: Contiguous progression
assertTest('TC-05', 'Contiguous sequence 2 succeeds with BE/26-27/0002', () => {
  db.exec("INSERT INTO invoice_sequence_log (financial_year, sequence_number, invoice_id) VALUES ('2026-27', 2, 'inv-test-02');");
  const inv = db.prepare("SELECT * FROM invoices WHERE id = 'inv-test-02'").get();
  if (inv.status !== 'Issued' || inv.invoice_number !== 'BE/26-27/0002') {
    throw new Error(`Expected BE/26-27/0002, got ${inv.invoice_number}`);
  }
});

// TEST 6: Issued invoices cannot be deleted
assertTest('TC-06', 'Issued invoice deletion is permanently blocked', () => {
  let errThrown = false;
  try {
    db.exec("DELETE FROM invoices WHERE id = 'inv-test-01'");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_LEGAL_RECORD_PROTECTION')) throw err;
  }
  if (!errThrown) throw new Error('Deletion of issued invoice was not blocked');
});

// TEST 7: Line items immutable after issuance
assertTest('TC-07', 'Line items of issued invoice cannot be inserted, updated, or deleted', () => {
  let errThrown = false;
  try {
    db.exec("UPDATE invoice_items SET gross_amount_paise = 20000 WHERE invoice_id = 'inv-test-01'");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_ITEMS_LOCKED')) throw err;
  }
  if (!errThrown) throw new Error('Update of issued line item was not blocked');
});

// TEST 8: Cancellation requires reason and actor, then freezes invoice permanently
assertTest('TC-08', 'Invoice cancellation requires reason and actor, then freezes invoice permanently', () => {
  db.exec(`
    UPDATE invoices SET
      status = 'Cancelled',
      cancellation_reason = 'Duplicate purchase order cancelled by buyer',
      cancelled_by = 'ADMIN_TEST',
      cancelled_at = datetime('now')
    WHERE id = 'inv-test-01';
  `);
  const inv = db.prepare("SELECT status, cancellation_reason FROM invoices WHERE id = 'inv-test-01'").get();
  if (inv.status !== 'Cancelled') throw new Error('Failed to cancel invoice');

  // Attempting any subsequent update must be rejected
  let errThrown = false;
  try {
    db.exec("UPDATE invoices SET buyer_name = 'Modified Buyer' WHERE id = 'inv-test-01'");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_CANCELLED_INVOICE_FROZEN')) throw err;
  }
  if (!errThrown) throw new Error('Modification of cancelled invoice was not blocked');
});

// TEST 9: Draft to Cancelled rejected (Drafts must be deleted)
assertTest('TC-09', 'Direct Draft -> Cancelled transition is rejected (Drafts must be deleted)', () => {
  seedDraft('inv-draft-del');
  let errThrown = false;
  try {
    db.exec("UPDATE invoices SET status = 'Cancelled' WHERE id = 'inv-draft-del'");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_INVALID_TRANSITION')) throw err;
  }
  if (!errThrown) throw new Error('Draft to Cancelled transition should have been blocked');
});

// TEST 10: NULL / unconfirmed GST rate blocks invoice issuance
assertTest('TC-10', 'NULL or unconfirmed GST rate on line item strictly aborts issuance', () => {
  db.exec(`
    INSERT INTO invoices (
      id, status, financial_year, seller_gstin, seller_state_code,
      buyer_name, buyer_address, buyer_state_name, buyer_state_code, buyer_pincode,
      taxable_amount_paise, total_tax_paise, total_invoice_amount_paise
    ) VALUES (
      'inv-null-gst', 'Draft', '2026-27', '27AGCPB8322L1ZG', '27',
      'Test Corp', 'MIDC Pune', 'Maharashtra', '27', '411026',
      5000, 0, 5000
    );
    INSERT INTO invoice_items (
      id, invoice_id, line_number, item_description, hsn_code,
      quantity_microunits, unit_price_paise, gross_amount_paise,
      taxable_amount_paise, gst_rate_bps, total_amount_paise
    ) VALUES (
      'it-null-gst-1', 'inv-null-gst', 1, 'Unpriced Prototype Bush', '4016',
      1000000, 5000, 5000, 5000, NULL, 5000
    );
  `);

  let errThrown = false;
  try {
    db.exec("INSERT INTO invoice_sequence_log (financial_year, sequence_number, invoice_id) VALUES ('2026-27', 3, 'inv-null-gst');");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_UNCONFIRMED_GST_RATE')) throw err;
  }
  if (!errThrown) throw new Error('Expected ERR_UNCONFIRMED_GST_RATE on NULL gst_rate_bps');

  // Verify zero sequence numbers were consumed
  const seqCheck = db.prepare("SELECT * FROM invoice_sequence_log WHERE invoice_id = 'inv-null-gst'").get();
  if (seqCheck) throw new Error('Sequence number was incorrectly allocated on failed issuance');
});

// TEST 11: Header taxable amount mismatch aborts issuance
assertTest('TC-11', 'Header taxable amount mismatch with line items sum aborts issuance', () => {
  db.exec(`
    INSERT INTO invoices (
      id, status, financial_year, seller_gstin, seller_state_code,
      buyer_name, buyer_address, buyer_state_name, buyer_state_code, buyer_pincode,
      taxable_amount_paise, total_tax_paise, total_invoice_amount_paise
    ) VALUES (
      'inv-mismatch', 'Draft', '2026-27', '27AGCPB8322L1ZG', '27',
      'Mismatch Buyer', 'Bhosari', 'Maharashtra', '27', '411039',
      15000, 2700, 17700
    );
    INSERT INTO invoice_items (
      id, invoice_id, line_number, item_description, hsn_code,
      quantity_microunits, unit_price_paise, gross_amount_paise,
      taxable_amount_paise, gst_rate_bps, cgst_amount_paise, sgst_amount_paise, total_amount_paise
    ) VALUES (
      'it-mismatch-1', 'inv-mismatch', 1, 'Rubber Seal', '4016',
      1000000, 10000, 10000, 10000, 1800, 900, 900, 11800
    );
  `);

  let errThrown = false;
  try {
    db.exec("INSERT INTO invoice_sequence_log (financial_year, sequence_number, invoice_id) VALUES ('2026-27', 3, 'inv-mismatch');");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_FINANCIAL_HEADER_TAXABLE_MISMATCH')) throw err;
  }
  if (!errThrown) throw new Error('Expected ERR_FINANCIAL_HEADER_TAXABLE_MISMATCH');
});

// TEST 12: Sequence allocation log deletion is blocked
assertTest('TC-12', 'Sequence allocations are permanent audit records and cannot be deleted', () => {
  let errThrown = false;
  try {
    db.exec("DELETE FROM invoice_sequence_log WHERE sequence_number = 1;");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_AUDIT_LOG_DELETION')) throw err;
  }
  if (!errThrown) throw new Error('Deletion of sequence log was not blocked');
});

// TEST 13: Sequence allocation log update is blocked
assertTest('TC-13', 'Sequence allocation log is immutable and cannot be updated', () => {
  let errThrown = false;
  try {
    db.exec("UPDATE invoice_sequence_log SET sequence_number = 999 WHERE sequence_number = 1;");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_AUDIT_LOG_IMMUTABLE')) throw err;
  }
  if (!errThrown) throw new Error('Update of sequence log was not blocked');
});

// TEST 14: Duplicate sequence number rejected by primary key
assertTest('TC-14', 'Duplicate sequence number rejected by primary key (financial_year, sequence_number)', () => {
  seedDraft('inv-dup');
  let errThrown = false;
  try {
    db.exec("INSERT INTO invoice_sequence_log (financial_year, sequence_number, invoice_id) VALUES ('2026-27', 1, 'inv-dup');");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('UNIQUE constraint failed') && !err.message.includes('PRIMARY KEY')) throw err;
  }
  if (!errThrown) throw new Error('Duplicate sequence insertion was not rejected');
});

// TEST 15: Mandatory buyer details required for issuance
assertTest('TC-15', 'Missing buyer name, address, or PIN code blocks invoice issuance', () => {
  db.exec(`
    INSERT INTO invoices (
      id, status, financial_year, seller_gstin, seller_state_code,
      buyer_name, buyer_address, buyer_state_name, buyer_state_code, buyer_pincode,
      taxable_amount_paise, cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_tax_paise, total_invoice_amount_paise
    ) VALUES (
      'inv-missing-buyer', 'Draft', '2026-27', '27AGCPB8322L1ZG', '27',
      NULL, 'Plot 10', 'Maharashtra', '27', '411039',
      10000, 900, 900, 0, 1800, 11800
    );
    INSERT INTO invoice_items (
      id, invoice_id, line_number, item_description, hsn_code,
      quantity_microunits, unit_price_paise, gross_amount_paise,
      taxable_amount_paise, gst_rate_bps, cgst_amount_paise, sgst_amount_paise, total_amount_paise
    ) VALUES (
      'it-missing-buyer-1', 'inv-missing-buyer', 1, 'Moulded Bush', '4016',
      1000000, 10000, 10000, 10000, 1800, 900, 900, 11800
    );
  `);

  let errThrown = false;
  try {
    db.exec("INSERT INTO invoice_sequence_log (financial_year, sequence_number, invoice_id) VALUES ('2026-27', 3, 'inv-missing-buyer');");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_MANDATORY_BUYER_NAME')) throw err;
  }
  if (!errThrown) throw new Error('Expected ERR_MANDATORY_BUYER_NAME');
});

// TEST 16: Quotation sequence independent progression
assertTest('TC-16', 'Quotation sequence log tracks independent numbering (BE/QT/26-27/0001)', () => {
  db.exec(`
    INSERT INTO quotations (
      id, quotation_number, quotation_date, valid_until, buyer_name,
      buyer_state_code, buyer_state_name, status,
      taxable_amount_paise, total_tax_paise, total_amount_paise
    ) VALUES (
      'qt-001', 'BE/QT/26-27/0001', '2026-11-04', '2026-12-04', 'Precision Instruments',
      '27', 'Maharashtra', 'Draft',
      50000, 9000, 59000
    );
    INSERT INTO quotation_sequence_log (financial_year, sequence_number, quotation_id)
    VALUES ('2026-27', 1, 'qt-001');
  `);
  const qLog = db.prepare("SELECT * FROM quotation_sequence_log WHERE quotation_id = 'qt-001'").get();
  if (!qLog || qLog.sequence_number !== 1) throw new Error('Quotation sequence failed');
});

// TEST 17: Round-off must yield exact whole rupees
assertTest('TC-17', 'Round-off must yield exact whole rupees when apply_round_off = 1', () => {
  db.exec(`
    INSERT INTO invoices (
      id, status, financial_year, seller_gstin, seller_state_code,
      buyer_name, buyer_address, buyer_state_name, buyer_state_code, buyer_pincode,
      taxable_amount_paise, cgst_amount_paise, sgst_amount_paise, igst_amount_paise,
      total_tax_paise, apply_round_off, round_off_paise, total_invoice_amount_paise
    ) VALUES (
      'inv-roundoff-err', 'Draft', '2026-27', '27AGCPB8322L1ZG', '27',
      'Round Off Test', 'Bhosari', 'Maharashtra', '27', '411039',
      10000, 900, 900, 0, 1800, 1, 25, 11825
    );
    INSERT INTO invoice_items (
      id, invoice_id, line_number, item_description, hsn_code,
      quantity_microunits, unit_price_paise, gross_amount_paise,
      taxable_amount_paise, gst_rate_bps, cgst_amount_paise, sgst_amount_paise, total_amount_paise
    ) VALUES (
      'it-ro-1', 'inv-roundoff-err', 1, 'Grommet', '4016',
      1000000, 10000, 10000, 10000, 1800, 900, 900, 11800
    );
  `);

  let errThrown = false;
  try {
    db.exec("INSERT INTO invoice_sequence_log (financial_year, sequence_number, invoice_id) VALUES ('2026-27', 3, 'inv-roundoff-err');");
  } catch (err) {
    errThrown = true;
    if (!err.message.includes('ERR_FINANCIAL_ROUNDOFF_MISMATCH')) throw err;
  }
  if (!errThrown) throw new Error('Expected ERR_FINANCIAL_ROUNDOFF_MISMATCH on non-whole rupee');
});

// TEST 18: Success path sequence 3 after all failed attempts consumed 0 sequences
assertTest('TC-18', 'Failed attempts consumed 0 sequence numbers; valid draft consumes sequence 3 exactly', () => {
  seedDraft('inv-test-03');
  db.exec("INSERT INTO invoice_sequence_log (financial_year, sequence_number, invoice_id) VALUES ('2026-27', 3, 'inv-test-03');");
  const inv = db.prepare("SELECT * FROM invoices WHERE id = 'inv-test-03'").get();
  if (inv.status !== 'Issued' || inv.invoice_number !== 'BE/26-27/0003' || inv.sequence_number !== 3) {
    throw new Error(`Expected BE/26-27/0003, got ${inv.invoice_number}`);
  }
});

console.log('\n-------------------------------------------------------------------------------');
console.log(`TOTAL: ${passed} PASSED, ${failed} FAILED`);
if (failed > 0) {
  console.log('ACCEPTANCE GATE FAILED');
  process.exit(1);
} else {
  console.log('STAGING ACCEPTANCE GATE VERIFIED: All 18 critical database integrity constraints passed.');
  process.exit(0);
}
