// ==============================================================================
// BABA ENTERPRISES — GST TAX INVOICE & QUOTATION HTML / PRINT GENERATOR
// Renders clean, high-precision A4 printable tax documents
// ==============================================================================

import type { BusinessSettings, DBInvoice, DBInvoiceItem, DBQuotation, DBQuotationItem } from './types.ts';
import { formatPaiseToINR } from './financials.ts';

function numberToWords(paise: number): string {
  const rupees = Math.floor(Math.abs(paise) / 100);
  if (rupees === 0) return 'Zero Rupees Only';

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(n: number): string {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
  }

  function convertThreeDigits(n: number): string {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    let res = '';
    if (hundred > 0) res += ones[hundred] + ' Hundred';
    if (rest > 0) res += (res ? ' and ' : '') + convertTwoDigits(rest);
    return res;
  }

  let num = rupees;
  let words = '';

  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  if (crore > 0) words += convertThreeDigits(crore) + ' Crore ';

  const lakh = Math.floor(num / 100000);
  num %= 100000;
  if (lakh > 0) words += convertThreeDigits(lakh) + ' Lakh ';

  const thousand = Math.floor(num / 1000);
  num %= 1000;
  if (thousand > 0) words += convertThreeDigits(thousand) + ' Thousand ';

  if (num > 0) words += convertThreeDigits(num);

  const remainingPaise = Math.abs(paise) % 100;
  let paiseWords = '';
  if (remainingPaise > 0) {
    paiseWords = ' and ' + convertTwoDigits(remainingPaise) + ' Paise';
  }

  return 'INR ' + words.trim() + paiseWords + ' Only';
}

export function generateInvoiceHTML(
  settings: BusinessSettings,
  invoice: DBInvoice,
  items: DBInvoiceItem[]
): string {
  const isInterstate = invoice.is_interstate === 1;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Tax Invoice - ${invoice.invoice_number || 'DRAFT'}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #1e293b; background: #fff; line-height: 1.4; }
    .invoice-card { width: 100%; max-width: 800px; margin: 0 auto; border: 1.5px solid #0f172a; }
    .header-table { width: 100%; border-bottom: 1.5px solid #0f172a; }
    .header-table td { padding: 8px 12px; vertical-align: top; }
    .seller-col { width: 60%; border-right: 1.5px solid #0f172a; }
    .doc-col { width: 40%; background: #f8fafc; }
    h1 { font-size: 18px; color: #102F59; font-weight: 800; letter-spacing: 0.5px; }
    .tagline { font-size: 10px; font-weight: 600; color: #475569; margin-bottom: 4px; }
    .meta-line { font-size: 10.5px; margin-bottom: 2px; }
    .bold { font-weight: 700; color: #0f172a; }
    .doc-title { font-size: 15px; font-weight: 800; color: #102F59; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
    
    .buyer-table { width: 100%; border-bottom: 1.5px solid #0f172a; background: #fff; }
    .buyer-table td { padding: 8px 12px; vertical-align: top; width: 50%; }
    .buyer-table td:first-child { border-right: 1.5px solid #0f172a; }
    .buyer-address-line { line-height: 1.5; overflow-wrap: anywhere; white-space: normal; margin-bottom: 2px; }
    
    .items-table { width: 100%; border-collapse: collapse; border-bottom: 1.5px solid #0f172a; }
    .items-table th { background: #102F59; color: #fff; font-size: 9.5px; text-transform: uppercase; padding: 6px 4px; text-align: center; border-right: 1px solid #cbd5e1; }
    .items-table th:last-child { border-right: none; }
    .items-table td { padding: 6px 4px; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #e2e8f0; font-size: 10px; }
    .items-table td:last-child { border-right: none; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    
    .summary-table { width: 100%; border-collapse: collapse; }
    .summary-table td { padding: 6px 12px; vertical-align: top; }
    .words-col { width: 60%; border-right: 1.5px solid #0f172a; font-size: 10.5px; }
    .totals-col { width: 40%; }
    .total-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 10.5px; }
    .grand-total { border-top: 1.5px solid #0f172a; padding-top: 4px; margin-top: 4px; font-size: 12.5px; font-weight: 800; color: #102F59; }
    
    .footer-table { width: 100%; border-top: 1.5px solid #0f172a; background: #f8fafc; }
    .footer-table td { padding: 8px 12px; vertical-align: bottom; }
    .terms-col { width: 60%; border-right: 1.5px solid #0f172a; font-size: 9px; color: #475569; }
    .sign-col { width: 40%; text-align: center; font-size: 10px; }
    .sign-space { height: 45px; }
    .cancelled-watermark { position: absolute; top: 35%; left: 15%; font-size: 80px; color: rgba(220, 38, 38, 0.2); font-weight: 900; transform: rotate(-30deg); text-transform: uppercase; pointer-events: none; }
    
    @media print {
      body { background: #fff; }
      .no-print { display: none !important; }
      .invoice-card { border: 1.5px solid #000; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="max-width: 800px; margin: 12px auto; display: flex; justify-content: space-between; align-items: center; background: #e2e8f0; padding: 10px 16px; border-radius: 8px;">
    <strong>BABA ENTERPRISES — GST Tax Invoice View</strong>
    <div>
      <button onclick="window.print()" style="padding: 6px 16px; background: #102F59; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Print / Save as PDF</button>
      <button onclick="window.close()" style="padding: 6px 16px; background: #64748b; color: #fff; border: none; border-radius: 4px; cursor: pointer; margin-left: 8px;">Close</button>
    </div>
  </div>

  <div class="invoice-card" style="position: relative;">
    ${invoice.status === 'Cancelled' ? `<div class="cancelled-watermark">CANCELLED</div>` : ''}
    
    <!-- Header -->
    <table class="header-table">
      <tr>
        <td class="seller-col">
          <h1>${settings.legal_name}</h1>
          <div class="tagline">Industrial Rubber & Plastic Components Specialist</div>
          <div class="meta-line">${settings.address_line1}, ${settings.address_line2}</div>
          <div class="meta-line">${settings.city} – ${settings.pincode}, ${settings.state_name}, India</div>
          <div class="meta-line"><span class="bold">GSTIN:</span> ${settings.gstin} | <span class="bold">PAN:</span> ${settings.pan}</div>
          <div class="meta-line"><span class="bold">State:</span> ${settings.state_name} (Code: ${settings.state_code})</div>
          <div class="meta-line"><span class="bold">Phone:</span> ${settings.phone_primary} / ${settings.phone_secondary}</div>
          <div class="meta-line"><span class="bold">Email:</span> ${settings.email}</div>
        </td>
        <td class="doc-col">
          <div class="doc-title">${invoice.status === 'Draft' ? 'DRAFT TAX INVOICE' : 'TAX INVOICE'}</div>
          <div class="meta-line"><span class="bold">Invoice No:</span> ${invoice.invoice_number || 'DRAFT (Unissued)'}</div>
          <div class="meta-line"><span class="bold">Invoice Date:</span> ${invoice.invoice_date || new Date().toISOString().slice(0, 10)}</div>
          <div class="meta-line"><span class="bold">Financial Year:</span> ${invoice.financial_year}</div>
          <div class="meta-line"><span class="bold">Place of Supply:</span> ${invoice.place_of_supply || (invoice.buyer_state_name + ' (' + invoice.buyer_state_code + ')')}</div>
          <div class="meta-line"><span class="bold">Reverse Charge:</span> No</div>
          <div class="meta-line"><span class="bold">Payment Status:</span> ${invoice.payment_status}</div>
        </td>
      </tr>
    </table>

    <!-- Buyer Details -->
    <table class="buyer-table">
      <tr>
        <td>
          <div class="bold" style="color: #102F59; margin-bottom: 4px;">BILL TO (BUYER DETAILS):</div>
          <div class="bold" style="font-size: 11.5px;">${invoice.buyer_name || 'Cash / Retail Buyer'}</div>
          ${invoice.buyer_trade_name ? `<div>${invoice.buyer_trade_name}</div>` : ''}
          <div class="buyer-address-line">${(invoice.buyer_address || 'Address not specified').split(/[,\n]+/).map(part => part.trim()).filter(Boolean).join('<br>')}</div>
          <div class="buyer-address-line">${[invoice.buyer_city, invoice.buyer_state_name, invoice.buyer_pincode].filter(Boolean).join(', ')}</div>
          <div><span class="bold">State:</span> ${invoice.buyer_state_name || 'N/A'} (Code: ${invoice.buyer_state_code || 'N/A'})</div>
          <div><span class="bold">GSTIN:</span> ${invoice.buyer_gstin || 'URP (Unregistered)'}</div>
        </td>
        <td>
          <div class="bold" style="color: #102F59; margin-bottom: 4px;">SHIP TO (DISPATCH DESTINATION):</div>
          <div class="bold" style="font-size: 11.5px;">${invoice.buyer_name || 'Same as Bill To'}</div>
          <div class="buyer-address-line">${(invoice.buyer_address || 'Same as Billing Address').split(/[,\n]+/).map(part => part.trim()).filter(Boolean).join('<br>')}</div>
          <div class="buyer-address-line">${[invoice.buyer_city, invoice.buyer_state_name, invoice.buyer_pincode].filter(Boolean).join(', ')}</div>
          <div><span class="bold">Place of Supply:</span> ${invoice.place_of_supply || invoice.buyer_state_name || 'Maharashtra (27)'}</div>
        </td>
      </tr>
    </table>

    <!-- Items Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 25px;">#</th>
          <th>Description of Goods</th>
          <th style="width: 45px;">HSN</th>
          <th style="width: 50px;">Qty</th>
          <th style="width: 55px;">Rate (₹)</th>
          <th style="width: 60px;">Taxable (₹)</th>
          ${!isInterstate ? `
            <th style="width: 50px;">CGST</th>
            <th style="width: 50px;">SGST</th>
          ` : `
            <th style="width: 60px;">IGST</th>
          `}
          <th style="width: 70px;">Total (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((it, idx) => `
          <tr>
            <td class="text-center">${idx + 1}</td>
            <td class="text-left">
              <div class="bold">${it.item_description}</div>
            </td>
            <td class="text-center">${it.hsn_code}</td>
            <td class="text-center">${(it.quantity_microunits / 1000000).toLocaleString('en-IN', { maximumFractionDigits: 3 })} ${it.unit_of_measure}</td>
            <td class="text-right">${(it.unit_price_paise / 100).toFixed(2)}</td>
            <td class="text-right">${(it.taxable_amount_paise / 100).toFixed(2)}</td>
            ${!isInterstate ? `
              <td class="text-right">
                <div>${(it.cgst_amount_paise / 100).toFixed(2)}</div>
                <div style="font-size: 8px; color: #64748b;">@${(it.cgst_rate_bps / 100)}%</div>
              </td>
              <td class="text-right">
                <div>${(it.sgst_amount_paise / 100).toFixed(2)}</div>
                <div style="font-size: 8px; color: #64748b;">@${(it.sgst_rate_bps / 100)}%</div>
              </td>
            ` : `
              <td class="text-right">
                <div>${(it.igst_amount_paise / 100).toFixed(2)}</div>
                <div style="font-size: 8px; color: #64748b;">@${(it.igst_rate_bps / 100)}%</div>
              </td>
            `}
            <td class="text-right bold">${(it.total_amount_paise / 100).toFixed(2)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- Summary & Totals -->
    <table class="summary-table">
      <tr>
        <td class="words-col">
          <div style="margin-bottom: 8px;">
            <div class="bold" style="font-size: 9.5px; color: #64748b; text-transform: uppercase;">Amount Chargeable (in words):</div>
            <div class="bold" style="color: #102F59; font-size: 11px;">${numberToWords(invoice.total_invoice_amount_paise)}</div>
          </div>
          ${settings.bank_account_no ? `
            <div style="border-top: 1px dashed #cbd5e1; padding-top: 6px; font-size: 9.5px;">
              <div class="bold">Bank Remittance Details:</div>
              <div>Bank: ${settings.bank_name || 'N/A'}, Branch: ${settings.bank_branch || 'N/A'}</div>
              <div>A/C No: ${settings.bank_account_no}, IFSC: ${settings.bank_ifsc || 'N/A'}</div>
            </div>
          ` : `
            <div style="border-top: 1px dashed #cbd5e1; padding-top: 6px; font-size: 9px; color: #64748b;">
              Bank settlement details available on direct corporate confirmation.
            </div>
          `}
        </td>
        <td class="totals-col">
          <div class="total-row">
            <span>Taxable Amount:</span>
            <span class="bold">${formatPaiseToINR(invoice.taxable_amount_paise)}</span>
          </div>
          ${!isInterstate ? `
            <div class="total-row">
              <span>CGST Total:</span>
              <span>${formatPaiseToINR(invoice.cgst_amount_paise)}</span>
            </div>
            <div class="total-row">
              <span>SGST Total:</span>
              <span>${formatPaiseToINR(invoice.sgst_amount_paise)}</span>
            </div>
          ` : `
            <div class="total-row">
              <span>IGST Total:</span>
              <span>${formatPaiseToINR(invoice.igst_amount_paise)}</span>
            </div>
          `}
          <div class="total-row">
            <span>Total Tax:</span>
            <span>${formatPaiseToINR(invoice.total_tax_paise)}</span>
          </div>
          ${invoice.round_off_paise !== 0 ? `
            <div class="total-row">
              <span>Round Off:</span>
              <span>${invoice.round_off_paise > 0 ? '+' : ''}${(invoice.round_off_paise / 100).toFixed(2)}</span>
            </div>
          ` : ''}
          <div class="total-row grand-total">
            <span>Total Amount:</span>
            <span>${formatPaiseToINR(invoice.total_invoice_amount_paise)}</span>
          </div>
        </td>
      </tr>
    </table>

    <!-- Footer & Terms -->
    <table class="footer-table">
      <tr>
        <td class="terms-col">
          <div class="bold" style="color: #102F59; margin-bottom: 2px;">Terms & Conditions:</div>
          <div>1. Goods once sold will not be accepted back or exchanged without prior authorization.</div>
          ${settings.default_payment_terms ? `<div>2. Payment terms: ${settings.default_payment_terms}.</div>` : ''}
          ${settings.default_invoice_notes ? `<div>3. ${settings.default_invoice_notes}</div>` : ''}
          <div style="margin-top: 4px; font-style: italic;">This is a computer generated tax invoice.</div>
        </td>
        <td class="sign-col">
          <div class="bold" style="color: #102F59;">For ${settings.legal_name}</div>
          <div class="sign-space"></div>
          <div class="bold" style="border-top: 1px solid #94a3b8; display: inline-block; padding-top: 3px; min-width: 140px;">
            Authorized Signatory
          </div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}


/**
 * Creates a self-contained, valid A4 PDF using the PDF standard's built-in
 * Helvetica font. This runs in the Cloudflare Workers runtime without a
 * browser, native binaries, or third-party PDF dependencies.
 */
export function generateQuotationPDF(
  settings: BusinessSettings,
  quotation: DBQuotation,
  items: DBQuotationItem[]
): Uint8Array {
  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const LEFT = 42;
  const RIGHT = PAGE_W - 42;
  const encoder = new TextEncoder();

  const clean = (value: unknown): string => String(value ?? '')
    .replace(/₹/g, 'INR ')
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '?');

  const esc = (value: unknown): string => clean(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

  const money = (paise: number): string =>
    'INR ' + (Number(paise || 0) / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true,
    });

  const wrap = (value: unknown, maxChars: number): string[] => {
    const words = clean(value).split(/\s+/).filter(Boolean);
    const result: string[] = [];
    let line = '';
    for (const word of words) {
      if (word.length > maxChars) {
        if (line) result.push(line);
        line = '';
        for (let i = 0; i < word.length; i += maxChars) result.push(word.slice(i, i + maxChars));
      } else if (!line) line = word;
      else if ((line + ' ' + word).length <= maxChars) line += ' ' + word;
      else { result.push(line); line = word; }
    }
    if (line) result.push(line);
    return result.length ? result : [''];
  };

  const pages: string[] = [];
  let commands = '';
  let y = 0;
  let pageNumber = 0;

  const text = (value: unknown, x: number, top: number, size = 9, bold = false) => {
    commands += `BT /${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${(PAGE_H - top).toFixed(2)} Tm (${esc(value)}) Tj ET\n`;
  };
  const line = (x1: number, top1: number, x2: number, top2: number, width = 0.6) => {
    commands += `${width} w ${x1.toFixed(2)} ${(PAGE_H - top1).toFixed(2)} m ${x2.toFixed(2)} ${(PAGE_H - top2).toFixed(2)} l S\n`;
  };
  const rect = (x: number, top: number, width: number, height: number, gray = 0.94) => {
    commands += `${gray} g ${x.toFixed(2)} ${(PAGE_H - top - height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f 0 g\n`;
  };

  const startPage = (continued = false) => {
    if (commands) pages.push(commands);
    commands = '';
    pageNumber += 1;
    y = 42;
    text(settings.legal_name || 'BABA ENTERPRISES', LEFT, y + 14, 17, true);
    text('Industrial Rubber & Plastic Components Specialist', LEFT, y + 29, 8);
    text(settings.address_line1, LEFT, y + 44, 8);
    text([settings.address_line2, settings.city, settings.pincode, settings.state_name].filter(Boolean).join(', '), LEFT, y + 56, 8);
    text('GSTIN: ' + (settings.gstin || ''), LEFT, y + 69, 8, true);
    text('Phone: ' + [settings.phone_primary, settings.phone_secondary].filter(Boolean).join(' / '), LEFT, y + 81, 8);
    text(settings.email || '', LEFT, y + 93, 8);
    text(continued ? 'QUOTATION (CONTINUED)' : 'QUOTATION', 390, y + 17, 15, true);
    text('Quotation No: ' + (quotation.quotation_number || 'DRAFT'), 390, y + 36, 8, true);
    text('Date: ' + (quotation.quotation_date || ''), 390, y + 49, 8);
    text('Valid Until: ' + (quotation.valid_until || ''), 390, y + 62, 8);
    line(LEFT, y + 104, RIGHT, y + 104, 1.2);
    y += 120;
    if (!continued) {
      text('BILL TO', LEFT, y, 8, true);
      text(quotation.buyer_name || '', LEFT, y + 15, 10, true);
      if (quotation.buyer_company) text(quotation.buyer_company, LEFT, y + 28, 8);
      if (quotation.buyer_contact_person) text('Contact: ' + quotation.buyer_contact_person, LEFT, y + 41, 8);
      const addressParts = (quotation.buyer_address || 'Address not provided')
        .split(/[,\n]+/).map((part) => part.trim()).filter(Boolean);
      const addressLines = addressParts.reduce((all: string[], part: string) => all.concat(wrap(part, 58)), [] as string[]);
      const addressTop = y + (quotation.buyer_contact_person ? 54 : (quotation.buyer_company ? 41 : 28));
      addressLines.forEach((v, i) => text(v, LEFT, addressTop + i * 11, 8));
      const detailTop = y + 15;
      text('GSTIN: ' + (quotation.buyer_gstin || 'Unregistered'), 310, detailTop, 8);
      text('State: ' + [quotation.buyer_state_name, quotation.buyer_state_code].filter(Boolean).join(' (' ) + (quotation.buyer_state_code ? ')' : ''), 310, detailTop + 13, 8);
      text('City: ' + (quotation.buyer_city || '-'), 310, detailTop + 26, 8);
      text('PIN Code: ' + (quotation.buyer_pincode || '-'), 310, detailTop + 39, 8);
      text('Phone: ' + (quotation.buyer_phone || '-'), 310, detailTop + 52, 8);
      text('Email: ' + (quotation.buyer_email || '-'), 310, detailTop + 65, 8);
      y += Math.max(94, (addressTop - y) + addressLines.length * 11 + 12);
    }
    rect(LEFT, y, RIGHT - LEFT, 20, 0.90);
    text('#', LEFT + 5, y + 13, 8, true);
    text('Description', LEFT + 27, y + 13, 8, true);
    text('HSN', 285, y + 13, 8, true);
    text('Qty', 337, y + 13, 8, true);
    text('Rate', 385, y + 13, 8, true);
    text('GST', 440, y + 13, 8, true);
    text('Amount', 490, y + 13, 8, true);
    y += 20;
  };

  startPage(false);
  items.forEach((item, index) => {
    const description = wrap(item.item_description, 38);
    const rowHeight = Math.max(25, description.length * 10 + 12);
    if (y + rowHeight > 735) startPage(true);
    text(String(index + 1), LEFT + 5, y + 15, 8);
    description.forEach((v, i) => text(v, LEFT + 27, y + 13 + i * 10, 8));
    text(item.hsn_code || '-', 285, y + 15, 7);
    text((Number(item.quantity_microunits) / 1000000).toLocaleString('en-IN', { maximumFractionDigits: 3 }) + ' ' + item.unit_of_measure, 337, y + 15, 7);
    text((Number(item.unit_price_paise) / 100).toFixed(2), 385, y + 15, 7);
    text(item.gst_rate_bps === null ? '-' : (Number(item.gst_rate_bps) / 100).toFixed(2) + '%', 440, y + 15, 7);
    text((Number(item.total_amount_paise) / 100).toFixed(2), 490, y + 15, 7);
    line(LEFT, y + rowHeight, RIGHT, y + rowHeight, 0.35);
    y += rowHeight;
  });

  if (y > 680) startPage(true);
  y += 16;
  line(LEFT, y, RIGHT, y, 0.9);
  y += 18;
  text('Subtotal (before discount): ' + money(quotation.subtotal_gross_paise), 335, y, 8);
  y += 14;
  text('Discount: ' + money(quotation.total_discount_paise), 335, y, 8);
  y += 14;
  text('Taxable Amount: ' + money(quotation.taxable_amount_paise), 335, y, 8);
  y += 14;
  if (Number(quotation.is_interstate) === 1) {
    text('IGST: ' + money(quotation.igst_amount_paise), 335, y, 8);
    y += 14;
  } else {
    text('CGST: ' + money(quotation.cgst_amount_paise), 335, y, 8);
    y += 14;
    text('SGST: ' + money(quotation.sgst_amount_paise), 335, y, 8);
    y += 14;
  }
  text('Total Tax: ' + money(quotation.total_tax_paise), 335, y, 8);
  y += 16;
  rect(320, y - 11, RIGHT - 320, 25, 0.90);
  text('GRAND TOTAL: ' + money(quotation.total_amount_paise), 330, y + 5, 11, true);
  y += 28;

  text('Payment Terms: ' + (quotation.payment_terms || settings.default_payment_terms || 'As mutually agreed'), LEFT, y, 8);
  y += 13;
  text('Delivery Terms: ' + (quotation.delivery_terms || 'As mutually agreed'), LEFT, y, 8);
  y += 13;
  const notes = wrap(quotation.notes || '', 95);
  notes.slice(0, 3).forEach((v, i) => text('Notes: ' + v, LEFT, y + i * 11, 8));
  y += Math.min(notes.length, 3) * 11 + 12;
  text('For ' + (settings.legal_name || 'BABA ENTERPRISES'), 390, Math.min(y + 8, 780), 9, true);
  text('Authorized Signatory', 390, Math.min(y + 48, 820), 8);
  text('This is a computer-generated quotation.', LEFT, 810, 7);
  text('Page ' + pageNumber, RIGHT - 40, 810, 7);
  pages.push(commands);

  const objects: string[] = [];
  const addObject = (body: string) => { objects.push(body); return objects.length; };
  const catalogId = addObject('');
  const pagesId = addObject('');
  const fontRegularId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const fontBoldId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const pageIds: number[] = [];
  pages.forEach((stream) => {
    const streamBytes = encoder.encode(stream);
    const contentId = addObject(`<< /Length ${streamBytes.length} >>\nstream\n${stream}endstream`);
    const pageId = addObject('');
    pageIds.push(pageId);
    objects[pageId - 1] = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`;
  });
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map(id => id + ' 0 R').join(' ')}] /Count ${pageIds.length} >>`;

  let pdf = '%PDF-1.4\n% BABA ENTERPRISES\n';
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(encoder.encode(pdf).length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = encoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset => { pdf += String(offset).padStart(10, '0') + ' 00000 n \n'; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return encoder.encode(pdf);
}
