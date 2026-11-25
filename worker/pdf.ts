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

function formatQuotationDate(value: string | null | undefined): string {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function formatInvoiceDate(value: string | null | undefined): string {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return value;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    month < 1 || month > 12 || day < 1 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return value;

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${day} ${months[month - 1]} ${year}`;
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
    @page { size: A4 portrait; margin: 12mm 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #1e293b; background: #fff; line-height: 1.4; }
    .invoice-card { width: 100%; max-width: 800px; margin: 0 auto; border: 1.5px solid #0f172a; background: #fff; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
    .invoice-header, .invoice-footer { width: 100%; background: #fff; }
    .tricolor-rule { height: 9px; width: 100%; background: linear-gradient(to right, #FF9933 0 33.333%, #FFFFFF 33.333% 66.666%, #138808 66.666% 100%); border-top: 1px solid #94a3b8; border-bottom: 1px solid #94a3b8; }
    .seller-brand { display: flex; align-items: center; justify-content: flex-start; min-height: 88px; margin-bottom: 2px; }
    .seller-logo { display: block; width: 275px; height: 90px; object-fit: contain; object-position: left center; }
    .header-table { width: 100%; border-collapse: collapse; border-bottom: 1.5px solid #0f172a; }
    .header-table td { padding: 8px 12px; vertical-align: top; }
    .seller-col { width: 60%; border-right: 1.5px solid #0f172a; }
    .doc-col { width: 40%; background: #f8fafc; }
    h1 { font-size: 18px; color: #102F59; font-weight: 800; letter-spacing: 0.5px; }
    .tagline { font-size: 10px; font-weight: 600; color: #475569; margin-bottom: 4px; }
    .meta-line { font-size: 10.5px; margin-bottom: 2px; }
    .bold { font-weight: 700; color: #0f172a; }
    .doc-title { font-size: 15px; font-weight: 800; color: #102F59; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid #94a3b8; padding-bottom: 4px; }
    
    .buyer-table { width: 100%; border-collapse: collapse; border-bottom: 1.5px solid #0f172a; background: #fff; }
    .buyer-table td { padding: 8px 12px; vertical-align: top; width: 50%; }
    .buyer-table td:first-child { border-right: 1.5px solid #0f172a; }
    .buyer-address-line { line-height: 1.5; overflow-wrap: anywhere; white-space: normal; margin-bottom: 2px; }
    
    .items-table { width: 100%; border-collapse: collapse; border-bottom: 1.5px solid #0f172a; }
    .items-table th { background: #102F59; color: #fff; font-size: 9.5px; text-transform: uppercase; padding: 6px 4px; text-align: center; border-top: 1px solid #0f172a; border-bottom: 1.5px solid #0f172a; border-right: 1px solid #cbd5e1; }
    .items-table th:last-child { border-right: none; }
    .items-table td { padding: 6px 4px; border-right: 1px solid #64748b; border-bottom: 1px solid #64748b; font-size: 10px; vertical-align: top; }
    .items-table td:last-child { border-right: none; }
    .items-table tbody tr:last-child td { border-bottom: 1.5px solid #0f172a; }
    .items-table thead { display: table-header-group; }
    .items-table tr, .summary-table, .summary-table tr, .invoice-footer, .footer-table, .footer-table tr { break-inside: avoid; page-break-inside: avoid; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    
    .summary-table { width: 100%; border-collapse: collapse; }
    .summary-table td { padding: 6px 12px; vertical-align: top; }
    .words-col { width: 60%; border-right: 1.5px solid #0f172a; font-size: 10.5px; }
    .totals-col { width: 40%; }
    .total-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 10.5px; }
    .grand-total { border-top: 1.5px solid #0f172a; padding-top: 4px; margin-top: 4px; font-size: 12.5px; font-weight: 800; color: #102F59; }
    
    .footer-table { width: 100%; border-collapse: collapse; border-top: 1.5px solid #0f172a; background: #f8fafc; }
    .footer-table td { padding: 8px 12px; vertical-align: bottom; }
    .terms-col { width: 60%; border-right: 1.5px solid #0f172a; font-size: 9px; color: #475569; }
    .sign-col { width: 40%; text-align: center; font-size: 10px; }
    .sign-space { height: 45px; }
    .cancelled-watermark { position: absolute; top: 35%; left: 15%; font-size: 80px; color: rgba(220, 38, 38, 0.2); font-weight: 900; transform: rotate(-30deg); text-transform: uppercase; pointer-events: none; }
    
    @media print {
      html, body { width: 100%; margin: 0; padding: 0; background: #fff; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      /*
       * Keep the invoice in normal document flow for Chromium's print engine.
       * Fixed-position elements combined with large @page margins were causing
       * the header/footer to detach from the content and appear on wrong pages.
       * The header now starts page 1; the footer follows totals on the final page.
       */
      .invoice-card { display: block; width: 100%; max-width: none; margin: 0; border: 1.5px solid #0f172a; overflow: visible; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
      .invoice-header, .invoice-footer { position: static; display: block; width: 100%; }
      .buyer-table, .items-table, .summary-table, .footer-table { width: 100%; }
      .items-table { page-break-after: auto; }
      .items-table thead { display: table-header-group; }
      .items-table tbody { display: table-row-group; }
      .items-table tr { break-inside: avoid; page-break-inside: avoid; }
      .summary-table, .summary-table tr, .invoice-footer, .footer-table, .footer-table tr { break-inside: avoid; page-break-inside: avoid; }
      /*
       * Only invoices that fit on one A4 page receive the adaptive layout.
       * The item table stays compact while spare page height sits below it,
       * and the summary block restores an explicit top border above totals.
       */
      .invoice-card.single-page {
        min-height: 271mm;
        display: flex;
        flex-direction: column;
      }
      /* Keep line items compact; put any spare page height after the table. */
      .invoice-card.single-page .items-table {
        flex: 0 0 auto;
        height: auto;
      }
      .invoice-card.single-page .invoice-fill-space {
        flex: 1 1 auto;
        min-height: 12mm;
      }
      .invoice-card.single-page .summary-table {
        border-top: 1.5px solid #0f172a;
      }
      .cancelled-watermark { position: absolute; }
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
    <div class="invoice-header">
      <div class="tricolor-rule" aria-hidden="true"></div>
      <!-- Repeated print header -->
      <table class="header-table">
      <tr>
        <td class="seller-col">
          <div class="seller-brand">
            <img class="seller-logo" src="https://www.dropbox.com/scl/fi/vzc5ok19d7qautvhloaaz/baba_logo.png?rlkey=wr5ex4l8l0aoqkuybnzdnm9yx&raw=1" alt="BABA ENTERPRISES logo">
          </div>
          <div class="meta-line">${settings.address_line1}, ${settings.address_line2}</div>
          <div class="meta-line">${settings.city} – ${settings.pincode}, ${settings.state_name}, India</div>
          <div class="meta-line"><span class="bold">GSTIN:</span> ${settings.gstin} | <span class="bold">PAN:</span> ${settings.pan}</div>
          <div class="meta-line"><span class="bold">State:</span> ${settings.state_name} (Code: ${settings.state_code})</div>
          <div class="meta-line"><span class="bold">Phone:</span> ${settings.phone_primary} / ${settings.phone_secondary}</div>
          <div class="meta-line"><span class="bold">Email:</span> ${settings.email}</div>
          ${settings.website_url ? `<div class="meta-line"><span class="bold">Website:</span> ${settings.website_url}</div>` : ''}
        </td>
        <td class="doc-col">
          <div class="doc-title">${invoice.status === 'Draft' ? 'DRAFT TAX INVOICE' : 'TAX INVOICE'}</div>
          <div class="meta-line"><span class="bold">Invoice No:</span> ${invoice.invoice_number || 'DRAFT (Unissued)'}</div>
          <div class="meta-line"><span class="bold">Invoice Date:</span> ${formatInvoiceDate(invoice.invoice_date)}</div>
          <div class="meta-line"><span class="bold">Financial Year:</span> ${invoice.financial_year}</div>
          <div class="meta-line"><span class="bold">Place of Supply:</span> ${invoice.place_of_supply || (invoice.buyer_state_name + ' (' + invoice.buyer_state_code + ')')}</div>

          <div class="meta-line"><span class="bold">Gate Pass Number:</span> ${invoice.gate_pass_number || ''}</div>
          <div class="meta-line"><span class="bold">Gate Pass Date:</span> ${formatInvoiceDate(invoice.gate_pass_date)}</div>
          <div class="meta-line"><span class="bold">Purchase Order Number:</span> ${invoice.purchase_order_number || ''}</div>
          <div class="meta-line"><span class="bold">Purchase Order Date:</span> ${formatInvoiceDate(invoice.purchase_order_date)}</div>
          <div class="meta-line"><span class="bold">Payment Status:</span> ${invoice.payment_status}</div>
        </td>
      </tr>
      </table>
    </div>
    ${invoice.status === 'Cancelled' ? `<div class="cancelled-watermark">CANCELLED</div>` : ''}

    <!-- Buyer Details -->
    <table class="buyer-table">
      <tr>
        <td>
          <div class="bold" style="color: #102F59; margin-bottom: 4px;">BILL TO (BUYER DETAILS):</div>
          <div class="bold" style="font-size: 11.5px;">${invoice.buyer_name || 'Cash / Retail Buyer'}</div>
          ${invoice.buyer_trade_name && invoice.buyer_trade_name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-IN') !== (invoice.buyer_name || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-IN') ? `<div>${invoice.buyer_trade_name.trim()}</div>` : ''}
          <div class="buyer-address-line">${(invoice.buyer_address || 'Address not specified').split(/[,\n]+/).map(part => part.trim()).filter(Boolean).join('<br>')}</div>
          <div class="buyer-address-line">${[invoice.buyer_city, invoice.buyer_state_name, invoice.buyer_pincode].filter(Boolean).join(', ')}</div>
          <div><span class="bold">State:</span> ${invoice.buyer_state_name || 'N/A'} (Code: ${invoice.buyer_state_code || 'N/A'})</div>
          <div><span class="bold">GSTIN:</span> ${invoice.buyer_gstin || 'URP (Unregistered)'}</div>
          <div><span class="bold">AR Number:</span> ${invoice.ar_number || ''}</div>
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

    <!-- Flexible whitespace belongs after the item rows, never inside them. -->
    <div class="invoice-fill-space" aria-hidden="true"></div>

    <!-- Summary & Totals -->
    <table class="summary-table">
      <tr>
        <td class="words-col">
          <div style="margin-bottom: 8px;">
            <div class="bold" style="font-size: 9.5px; color: #64748b; text-transform: uppercase;">Amount Chargeable (in words):</div>
            <div class="bold" style="color: #102F59; font-size: 11px;">${numberToWords(invoice.total_invoice_amount_paise)}</div>
          </div>
          ${settings.bank_account_no ? `
            <div style="border-top: 1px dashed #64748b; padding-top: 6px; font-size: 9.5px;">
              <div class="bold">Bank Remittance Details:</div>
              <div>Bank: ${settings.bank_name || 'N/A'}, Branch: ${settings.bank_branch || 'N/A'}</div>
              <div>A/C No: ${settings.bank_account_no}, IFSC: ${settings.bank_ifsc || 'N/A'}</div>
            </div>
          ` : `
            <div style="border-top: 1px dashed #64748b; padding-top: 6px; font-size: 9px; color: #64748b;">
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

    <!-- Repeated print footer -->
    <div class="invoice-footer">
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
          <div class="bold" style="border-top: 1px solid #475569; display: inline-block; padding-top: 3px; min-width: 140px;">
            Authorized Signatory
          </div>
        </td>
      </tr>
      </table>
      <div style="padding: 7px 12px 8px; font-size: 9px; line-height: 1.4; color: #475569; background: #fff; break-inside: avoid; page-break-inside: avoid;">
        <div class="bold" style="color: #102F59; margin-bottom: 2px;">Declaration:</div>
        <div>We hereby certify that our GST registration is valid and in force on the date of supply of the goods specified in this tax invoice. We further declare that the particulars furnished in this invoice are true and correct, and the transaction covered herein shall be duly accounted for in the applicable GST returns. The tax payable on such supply has been paid or shall be paid in accordance with the applicable provisions of the Goods and Services Tax Acts, 2017, and the Rules made thereunder.</div>
      </div>
      <div class="tricolor-rule" aria-hidden="true"></div>
    </div>
  </div>
  <script>
    // Expand only genuinely single-page invoices to use the available A4 height.
    // Multi-page invoices keep compact rows and normal pagination.
    window.addEventListener('beforeprint', () => {
      const card = document.querySelector('.invoice-card');
      const rows = document.querySelectorAll('.items-table tbody tr');
      if (!card) return;
      card.classList.remove('single-page');
      const printablePageHeight = (271 / 25.4) * 96;
      if (card.scrollHeight <= printablePageHeight && rows.length > 0) {
        card.classList.add('single-page');
      }
    });
  </script>
</body>
</html>`;
}


/**
 * Creates a self-contained, valid A4 PDF using the PDF standard's built-in
 * Helvetica font. This runs in the Cloudflare Workers runtime without a
 * browser, native binaries, or third-party PDF dependencies.
 */
export async function generateQuotationPDF(
  settings: BusinessSettings,
  quotation: DBQuotation,
  items: DBQuotationItem[]
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const pageWidth = 595.28, pageHeight = 841.89;
  const marginX = 28.35, marginTop = 34.02, marginBottom = 34.02;
  const navy = rgb(0.063, 0.184, 0.349);
  const dark = rgb(0.12, 0.15, 0.19);
  const muted = rgb(0.38, 0.42, 0.47);
  const light = rgb(0.94, 0.95, 0.97);
  const white = rgb(1, 1, 1);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const clean = (v: unknown) => String(v ?? '').replace(/₹/g, 'INR ').replace(/[–—]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '?');
  const money = (paise: number) => 'INR ' + (Number(paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const wrap = (value: unknown, maxWidth: number, size: number, font = regular): string[] => {
    const words = clean(value).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const candidate = current ? current + ' ' + word : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) current = candidate;
      else {
        if (current) lines.push(current);
        if (font.widthOfTextAtSize(word, size) <= maxWidth) current = word;
        else {
          let part = '';
          for (const char of word) {
            if (font.widthOfTextAtSize(part + char, size) > maxWidth && part) { lines.push(part); part = char; }
            else part += char;
          }
          current = part;
        }
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [''];
  };
  const logoUrl = 'https://www.dropbox.com/scl/fi/vzc5ok19d7qautvhloaaz/baba_logo.png?rlkey=wr5ex4l8l0aoqkuybnzdnm9yx&raw=1';
  const logoResponse = await fetch(logoUrl);
  if (!logoResponse.ok) throw new Error('BABA Enterprises logo could not be loaded for quotation PDF generation.');
  const logoBytes = new Uint8Array(await logoResponse.arrayBuffer());
  const logo = await pdf.embedPng(logoBytes);
  const logoDims = logo.scale(Math.min(206.25 / logo.width, 67.5 / logo.height));

  let page!: ReturnType<typeof pdf.addPage>;
  let y = pageHeight - marginTop;
  const drawText = (value: unknown, x: number, top: number, size = 8, isBold = false, color = dark) => {
    page.drawText(clean(value), { x, y: pageHeight - top - size, size, font: isBold ? bold : regular, color });
  };
  const drawLine = (x1: number, top: number, x2: number, width = 0.6, color = muted) => {
    page.drawLine({ start: { x: x1, y: pageHeight - top }, end: { x: x2, y: pageHeight - top }, thickness: width, color });
  };
  const drawRule = (top: number) => {
    const width = pageWidth - marginX * 2, segment = width / 3;
    page.drawRectangle({ x: marginX, y: pageHeight - top - 3, width: segment, height: 3, color: rgb(1, 0.60, 0.20) });
    page.drawRectangle({ x: marginX + segment, y: pageHeight - top - 3, width: segment, height: 3, color: white, borderColor: rgb(0.82, 0.82, 0.82), borderWidth: 0.2 });
    page.drawRectangle({ x: marginX + segment * 2, y: pageHeight - top - 3, width: width - segment * 2, height: 3, color: rgb(0.075, 0.53, 0.20) });
  };
  const drawFrame = () => {
    page.drawRectangle({ x: marginX, y: marginBottom, width: pageWidth - marginX * 2, height: pageHeight - marginTop - marginBottom, borderColor: rgb(0.78, 0.80, 0.83), borderWidth: 0.45 });
    drawRule(marginTop);
    drawRule(pageHeight - marginBottom - 5);
  };
  const drawFooter = (number: number) => {
    drawText('This is a computer-generated quotation.', marginX + 5, pageHeight - marginBottom - 20, 6.5, false, muted);
    const label = 'Page ' + number;
    drawText(label, pageWidth - marginX - 45, pageHeight - marginBottom - 20, 6.5, false, muted);
  };
  const startPage = (continued = false) => {
    page = pdf.addPage([pageWidth, pageHeight]);
    drawFrame();
    const logoX = marginX + 5, logoTop = marginTop + 12;
    page.drawImage(logo, { x: logoX, y: pageHeight - logoTop - logoDims.height, width: logoDims.width, height: logoDims.height });
    const seller = [
      settings.address_line1,
      [settings.address_line2, settings.city, settings.pincode, settings.state_name].filter(Boolean).join(', '),
      'GSTIN: ' + (settings.gstin || ''),
      'Phone: ' + [settings.phone_primary, settings.phone_secondary].filter(Boolean).join(' / '),
      settings.email || '',
      settings.website_url ? 'Website: ' + settings.website_url : '',
    ].filter(Boolean);
    seller.forEach((v, n) => drawText(v, marginX + 5, marginTop + 84 + n * 9.5, 7.2, n === 2));
    page.drawRectangle({ x: 365, y: pageHeight - marginTop - 105, width: pageWidth - marginX - 365, height: 91, color: rgb(0.96, 0.97, 0.98) });
    drawText(continued ? 'QUOTATION (CONTINUED)' : 'QUOTATION', 378, marginTop + 31, 15, true, navy);
    drawText('Quotation No:', 378, marginTop + 55, 7.5, true);
    drawText(quotation.quotation_number || 'DRAFT', 445, marginTop + 55, 7.5);
    drawText('Date:', 378, marginTop + 69, 7.5, true);
    drawText(formatQuotationDate(quotation.quotation_date), 445, marginTop + 69, 7.5);
    drawText('Valid Until:', 378, marginTop + 83, 7.5, true);
    drawText(formatQuotationDate(quotation.valid_until), 445, marginTop + 83, 7.5);
    drawLine(marginX, marginTop + 142, pageWidth - marginX, 1, navy);
    let cursor = marginTop + 158;
    if (!continued) {
      page.drawRectangle({ x: marginX, y: pageHeight - cursor - 17, width: pageWidth - marginX * 2, height: 17, color: light });
      drawText('QUOTATION TO', marginX + 7, cursor + 3, 8, true, navy);
      drawText(quotation.buyer_name || '', marginX + 7, cursor + 23, 9.5, true);
      let addressTop = cursor + 37;
      const normalizeBuyerLabel = (value: string | null | undefined) =>
        (value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-IN');
      const companyDuplicatesBuyer = normalizeBuyerLabel(quotation.buyer_company) !== '' &&
        normalizeBuyerLabel(quotation.buyer_company) === normalizeBuyerLabel(quotation.buyer_name);
      if (quotation.buyer_company && !companyDuplicatesBuyer) {
        drawText(quotation.buyer_company, marginX + 7, addressTop, 7.5);
        addressTop += 11;
      }
      const addressParts = (quotation.buyer_address || 'Address not provided').split(/[,\n]+/).map(v => v.trim()).filter(Boolean);
      const addressLines = addressParts.flatMap(v => wrap(v, 260, 7.5)).slice(0, 4);
      const location = [quotation.buyer_city, quotation.buyer_state_name, quotation.buyer_pincode].filter(Boolean).join(', ');
      const locationLines = location ? wrap(location, 260, 7.5).slice(0, 2) : [];
      addressLines.forEach((v, n) => drawText(v, marginX + 7, addressTop + n * 10, 7.5));
      locationLines.forEach((v, n) => drawText(v, marginX + 7, addressTop + (addressLines.length + n) * 10, 7.5));
      const rightX = 325;
      drawText('GSTIN: ' + (quotation.buyer_gstin || 'Unregistered'), rightX, cursor + 23, 7.5);
      drawText('State: ' + [quotation.buyer_state_name, quotation.buyer_state_code].filter(Boolean).join(' (' ) + (quotation.buyer_state_code ? ')' : ''), rightX, cursor + 36, 7.5);
      drawText('Contact: ' + (quotation.buyer_contact_person || '-'), rightX, cursor + 49, 7.5);
      drawText('Phone: ' + (quotation.buyer_phone || '-'), rightX, cursor + 62, 7.5);
      drawText('Email: ' + (quotation.buyer_email || '-'), rightX, cursor + 75, 7.5);
      if (quotation.ar_number) drawText('AR Number: ' + quotation.ar_number, rightX, cursor + 88, 7.5);
      cursor += Math.max(111, 43 + (addressLines.length + locationLines.length) * 10);
      drawLine(marginX, cursor, pageWidth - marginX, 0.6);
      cursor += 14;
    }
    page.drawRectangle({ x: marginX, y: pageHeight - cursor - 21, width: pageWidth - marginX * 2, height: 21, color: navy });
    const headers = [['#', marginX + 7], ['Description', marginX + 28], ['HSN', 300], ['Qty', 350], ['Rate (INR)', 395], ['GST %', 462], ['Amount', 505]] as const;
    headers.forEach(([label, x]) => drawText(label, x, cursor + 6, 7.5, true, white));
    y = cursor + 27;
    return cursor;
  };
  let pageNo = 0;
  const newPage = (continued = false) => { pageNo += 1; startPage(continued); };
  newPage(false);
  items.forEach((item, index) => {
    const description = wrap(item.item_description, 240, 7.5);
    const rowHeight = Math.max(27, description.length * 10 + 13);
    if (y + rowHeight > pageHeight - marginBottom - 65) { drawFooter(pageNo); newPage(true); }
    if (index % 2 === 1) page.drawRectangle({ x: marginX, y: pageHeight - y - rowHeight, width: pageWidth - marginX * 2, height: rowHeight, color: rgb(0.975, 0.98, 0.985) });
    drawText(String(index + 1), marginX + 7, y + 7, 7.5);
    description.forEach((v, n) => drawText(v, marginX + 28, y + 7 + n * 10, 7.5, n === 0));
    drawText(item.hsn_code || '-', 300, y + 7, 7);
    drawText((Number(item.quantity_microunits) / 1000000).toLocaleString('en-IN', { maximumFractionDigits: 3 }) + ' ' + item.unit_of_measure, 350, y + 7, 7);
    drawText((Number(item.unit_price_paise) / 100).toFixed(2), 395, y + 7, 7);
    drawText(item.gst_rate_bps === null || item.gst_rate_bps === undefined ? '-' : (Number(item.gst_rate_bps) / 100).toFixed(2) + '%', 462, y + 7, 7);
    drawText((Number(item.total_amount_paise) / 100).toFixed(2), 505, y + 7, 7, true);
    drawLine(marginX, y + rowHeight, pageWidth - marginX, 0.35, rgb(0.78, 0.80, 0.83));
    y += rowHeight;
  });
  const hasRoundOff = Number(quotation.round_off_paise || 0) !== 0;
  const summaryLines = (Number(quotation.is_interstate) === 1 ? 6 : 7) + (hasRoundOff ? 1 : 0);
  const summaryHeight = 18 + summaryLines * 13 + 38 + 200;
  if (y + summaryHeight > pageHeight - marginBottom - 35) { drawFooter(pageNo); newPage(true); }
  y += 14;
  drawLine(marginX, y, pageWidth - marginX, 0.9, navy);
  y += 18;
  drawText('Amount Chargeable (in words):', marginX + 5, y, 7.5, true, navy);
  drawText(numberToWords(Number(quotation.total_amount_paise || 0)), marginX + 5, y + 13, 7.5);
  const totalX = 355;
  const totalLine = (label: string, value: string) => { drawText(label, totalX, y, 7.5); drawText(value, 475, y, 7.5, true); y += 13; };
  totalLine('Subtotal (before discount):', money(quotation.subtotal_gross_paise));
  totalLine('Discount:', money(quotation.total_discount_paise));
  totalLine('Taxable Amount:', money(quotation.taxable_amount_paise));
  const uniqueRateLabels = (rates: number[]) => {
    const labels = [...new Set(rates.filter(rate => Number.isFinite(rate) && rate > 0).map(rate => (rate / 100).toFixed(2)))].sort((a, b) => Number(a) - Number(b));
    return labels.length === 0 ? '' : labels.length === 1 ? labels[0] + '%' : 'Multiple rates';
  };
  if (Number(quotation.is_interstate) === 1) {
    const igstRateLabel = uniqueRateLabels(items.map(item => Number(item.igst_rate_bps || 0)));
    totalLine('IGST' + (igstRateLabel ? ' (' + igstRateLabel + '):' : ':'), money(quotation.igst_amount_paise));
  } else {
    const cgstRateLabel = uniqueRateLabels(items.map(item => Number(item.cgst_rate_bps || 0)));
    const sgstRateLabel = uniqueRateLabels(items.map(item => Number(item.sgst_rate_bps || 0)));
    totalLine('CGST' + (cgstRateLabel ? ' (' + cgstRateLabel + '):' : ':'), money(quotation.cgst_amount_paise));
    totalLine('SGST' + (sgstRateLabel ? ' (' + sgstRateLabel + '):' : ':'), money(quotation.sgst_amount_paise));
  }
  totalLine('Total Tax:', money(quotation.total_tax_paise));
  if (hasRoundOff) totalLine('Round Off:', money(quotation.round_off_paise));
  page.drawRectangle({ x: 345, y: pageHeight - y - 25, width: pageWidth - marginX - 345, height: 25, color: rgb(0.88, 0.90, 0.93) });
  drawText('GRAND TOTAL', 355, y + 7, 9, true, navy);
  drawText(money(quotation.total_amount_paise), 475, y + 7, 9, true, navy);
  y += 38;
  drawLine(marginX, y, pageWidth - marginX, 0.6);
  y += 15;
  drawText('TERMS & CONDITIONS', marginX + 5, y, 8, true, navy);
  y += 14;
  drawText('Payment Terms: ' + (quotation.payment_terms || settings.default_payment_terms || 'As mutually agreed'), marginX + 5, y, 7.5);
  y += 12;
  drawText('Delivery Terms: ' + (quotation.delivery_terms || 'As mutually agreed'), marginX + 5, y, 7.5);
  y += 12;
  const notes = wrap(quotation.notes || '', 500, 7.5).slice(0, 3);
  notes.forEach((v, n) => drawText((n === 0 ? 'Notes: ' : '       ') + v, marginX + 5, y + n * 10, 7.5));
  y += notes.length * 10 + 14;
  drawText('Customer Acceptance', marginX + 5, Math.min(y + 6, pageHeight - marginBottom - 42), 7.5, true, navy);
  page.drawLine({ start: { x: marginX + 5, y: pageHeight - Math.min(y + 42, pageHeight - marginBottom - 10) }, end: { x: marginX + 150, y: pageHeight - Math.min(y + 42, pageHeight - marginBottom - 10) }, thickness: 0.6 });
  drawText('For ' + (settings.legal_name || 'BABA ENTERPRISES'), 390, Math.min(y + 10, pageHeight - marginBottom - 38), 8.5, true, navy);
  page.drawLine({ start: { x: 390, y: pageHeight - Math.min(y + 42, pageHeight - marginBottom - 10) }, end: { x: pageWidth - marginX - 5, y: pageHeight - Math.min(y + 42, pageHeight - marginBottom - 10) }, thickness: 0.6 });
  drawText('Authorized Signatory', 410, Math.min(y + 54, pageHeight - marginBottom - 4), 7.5);
  const declaration = 'We hereby confirm that the prices and particulars mentioned in this quotation are true and correct to the best of our knowledge. This quotation is subject to the stated terms and conditions. Applicable taxes shall be charged in accordance with prevailing GST regulations. This quotation is not a tax invoice and cannot be used to claim Input Tax Credit (ITC).';
  const declarationLines = wrap(declaration, pageWidth - marginX * 2 - 12, 7.5);
  drawText('DECLARATION', marginX + 5, y + 70, 8, true, navy);
  declarationLines.forEach((line, index) => drawText(line, marginX + 5, y + 83 + index * 9, 7.5));
  drawFooter(pageNo);
  return await pdf.save();
}


/** Creates an editable Word-compatible HTML document (.doc) matching the quotation PDF content and branding. */
export async function generateQuotationWordDocument(
  settings: BusinessSettings,
  quotation: DBQuotation,
  items: DBQuotationItem[]
): Promise<Uint8Array> {
  const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char] || char);
  const money = (paise: number) => 'INR ' + (Number(paise || 0) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  const date = (value: string | null | undefined) => {
    if (!value) return '';
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    return match ? match[3] + '/' + match[2] + '/' + match[1] : value;
  };
  const uniqueRateLabel = (rates: number[]) => {
    const labels = [...new Set(rates.filter(rate => Number.isFinite(rate) && rate > 0)
      .map(rate => (rate / 100).toFixed(2)))].sort((a, b) => Number(a) - Number(b));
    return labels.length === 0 ? '' : labels.length === 1 ? labels[0] + '%' : 'Multiple rates';
  };
  const normalize = (value: string | null | undefined) =>
    (value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-IN');
  const logoUrl = 'https://www.dropbox.com/scl/fi/vzc5ok19d7qautvhloaaz/baba_logo.png?rlkey=wr5ex4l8l0aoqkuybnzdnm9yx&raw=1';
  const logoResponse = await fetch(logoUrl);
  if (!logoResponse.ok) throw new Error('BABA Enterprises logo could not be loaded for quotation Word document generation.');
  const logoBytes = new Uint8Array(await logoResponse.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < logoBytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...logoBytes.subarray(offset, Math.min(offset + 0x8000, logoBytes.length)));
  }
  const logoData = 'data:image/png;base64,' + btoa(binary);
  const sellerLines = [
    settings.address_line1,
    [settings.address_line2, settings.city, settings.pincode, settings.state_name].filter(Boolean).join(', '),
    settings.gstin ? 'GSTIN: ' + settings.gstin : '',
    [settings.phone_primary, settings.phone_secondary].filter(Boolean).length
      ? 'Phone: ' + [settings.phone_primary, settings.phone_secondary].filter(Boolean).join(' / ') : '',
    settings.email || '',
    settings.website_url ? 'Website: ' + settings.website_url : '',
  ].filter(Boolean);
  const buyerAddress = (quotation.buyer_address || 'Address not provided')
    .split(/[,\n]+/).map(value => value.trim()).filter(Boolean);
  const buyerLocation = [quotation.buyer_city, quotation.buyer_state_name, quotation.buyer_pincode]
    .filter(Boolean).join(', ');
  const buyerCompany = quotation.buyer_company && normalize(quotation.buyer_company) !== normalize(quotation.buyer_name)
    ? quotation.buyer_company : '';
  const itemRows = items.map((item, index) =>
    '<tr><td class="center">' + (index + 1) + '</td><td><strong>' + esc(item.item_description) +
    '</strong></td><td class="center">' + esc(item.hsn_code || '-') + '</td><td class="right">' +
    esc((Number(item.quantity_microunits) / 1000000).toLocaleString('en-IN', { maximumFractionDigits: 3 })) + ' ' +
    esc(item.unit_of_measure) + '</td><td class="right">' + (Number(item.unit_price_paise) / 100).toFixed(2) +
    '</td><td class="center">' + (item.gst_rate_bps === null ? '-' : (Number(item.gst_rate_bps) / 100).toFixed(2) + '%') +
    '</td><td class="right"><strong>' + (Number(item.total_amount_paise) / 100).toFixed(2) + '</strong></td></tr>'
  ).join('');
  const summaryRows = [
    '<tr><td>Subtotal (before discount):</td><td class="amount">' + money(quotation.subtotal_gross_paise) + '</td></tr>',
    '<tr><td>Discount:</td><td class="amount">' + money(quotation.total_discount_paise) + '</td></tr>',
    '<tr><td>Taxable Amount:</td><td class="amount">' + money(quotation.taxable_amount_paise) + '</td></tr>',
  ];
  if (Number(quotation.is_interstate) === 1) {
    const rate = uniqueRateLabel(items.map(item => Number(item.igst_rate_bps || 0)));
    summaryRows.push('<tr><td>IGST' + (rate ? ' (' + esc(rate) + ')' : '') + ':</td><td class="amount">' + money(quotation.igst_amount_paise) + '</td></tr>');
  } else {
    const cgstRate = uniqueRateLabel(items.map(item => Number(item.cgst_rate_bps || 0)));
    const sgstRate = uniqueRateLabel(items.map(item => Number(item.sgst_rate_bps || 0)));
    summaryRows.push('<tr><td>CGST' + (cgstRate ? ' (' + esc(cgstRate) + ')' : '') + ':</td><td class="amount">' + money(quotation.cgst_amount_paise) + '</td></tr>');
    summaryRows.push('<tr><td>SGST' + (sgstRate ? ' (' + esc(sgstRate) + ')' : '') + ':</td><td class="amount">' + money(quotation.sgst_amount_paise) + '</td></tr>');
  }
  summaryRows.push('<tr><td>Total Tax:</td><td class="amount">' + money(quotation.total_tax_paise) + '</td></tr>');
  if (Number(quotation.round_off_paise || 0) !== 0) {
    summaryRows.push('<tr><td>Round Off:</td><td class="amount">' + money(quotation.round_off_paise) + '</td></tr>');
  }
  const stateLabel = [quotation.buyer_state_name, quotation.buyer_state_code]
    .filter(Boolean).join(' (') + (quotation.buyer_state_code ? ')' : '');
  const declaration = 'We hereby confirm that the prices and particulars mentioned in this quotation are true and correct to the best of our knowledge. This quotation is subject to the stated terms and conditions. Applicable taxes shall be charged in accordance with prevailing GST regulations. This quotation is not a tax invoice and cannot be used to claim Input Tax Credit (ITC).';
  const html = '<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
  '<head><meta charset="utf-8"><title>Quotation ' + esc(quotation.quotation_number || '') + '</title>' +
  '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]>' +
  '<style>@page{size:A4;margin:14mm 12mm}body{font-family:Arial,sans-serif;color:#1f2933;font-size:9pt}.sheet{border:1px solid #c7cbd1;padding:10px 12px 14px}' +
  '.tricolor{height:4px;background:linear-gradient(to right,#f89933 33.33%,#fff 33.33%,#fff 66.66%,#13883d 66.66%);border:1px solid #ddd}' +
  '.header{width:100%;border-collapse:collapse;margin:7px 0 12px}.header td{vertical-align:top}.logo{width:205px;max-height:68px;object-fit:contain}' +
  '.seller{font-size:8pt;line-height:1.35}.titlebox{background:#f4f6f8;padding:10px;width:37%}.title{font-size:18pt;font-weight:bold;color:#102f59;margin-bottom:8px}' +
  '.meta td{padding:2px 0;font-size:8pt}.rule{border-top:1px solid #102f59;margin:9px 0 12px}.section{background:#eef1f5;color:#102f59;font-weight:bold;padding:6px 8px}' +
  '.buyer{width:100%;border-collapse:collapse;margin-bottom:12px}.buyer td{vertical-align:top;padding:4px 8px;font-size:8pt}.buyer .name{font-size:10pt;font-weight:bold}' +
  '.items{width:100%;border-collapse:collapse;table-layout:fixed;font-size:7.5pt}.items th{background:#102f59;color:white;padding:7px 4px;text-align:left}.items td{padding:7px 4px;border-bottom:1px solid #c7cbd1;vertical-align:top}.items tr:nth-child(even) td{background:#f8f9fb}' +
  '.center{text-align:center}.right{text-align:right}.summary-wrap{width:100%;margin-top:14px;border-top:1px solid #102f59;padding-top:12px}.words{width:53%;vertical-align:top;font-size:8pt;color:#102f59;font-weight:bold}' +
  '.summary{width:100%;border-collapse:collapse;font-size:8pt}.summary td{padding:3px 5px}.summary .amount{text-align:right;font-weight:bold}.grand td{background:#e0e6ed;color:#102f59;font-size:10pt;font-weight:bold;padding:7px 5px}' +
  '.terms{border-top:1px solid #c7cbd1;margin-top:12px;padding-top:10px;font-size:8pt}.signatures{width:100%;margin-top:28px;font-size:8pt}.signatures td{width:50%;vertical-align:top}.signature-line{border-top:1px solid #555;margin-top:28px;padding-top:5px;text-align:center}.declaration{margin-top:24px;font-size:7.5pt;line-height:1.3}.footer{margin-top:24px;font-size:7pt;color:#68717c}</style></head><body>' +
  '<div class="sheet"><div class="tricolor"></div><table class="header"><tr><td style="width:62%"><img class="logo" src="' + logoData + '"/><div class="seller">' +
  sellerLines.map(line => '<div>' + esc(line) + '</div>').join('') + '</div></td><td class="titlebox"><div class="title">QUOTATION</div><table class="meta">' +
  '<tr><td><b>Quotation No:</b></td><td>' + esc(quotation.quotation_number || 'DRAFT') + '</td></tr><tr><td><b>Date:</b></td><td>' + esc(date(quotation.quotation_date)) +
  '</td></tr><tr><td><b>Valid Until:</b></td><td>' + esc(date(quotation.valid_until)) + '</td></tr></table></td></tr></table><div class="rule"></div>' +
  '<div class="section">QUOTATION TO</div><table class="buyer"><tr><td style="width:55%"><div class="name">' + esc(quotation.buyer_name) + '</div>' +
  (buyerCompany ? '<div>' + esc(buyerCompany) + '</div>' : '') + buyerAddress.map(line => '<div>' + esc(line) + '</div>').join('') +
  (buyerLocation ? '<div>' + esc(buyerLocation) + '</div>' : '') + '</td><td><div>GSTIN: ' + esc(quotation.buyer_gstin || 'Unregistered') +
  '</div><div>State: ' + esc(stateLabel) + '</div><div>Contact: ' + esc(quotation.buyer_contact_person || '-') + '</div><div>Phone: ' +
  esc(quotation.buyer_phone || '-') + '</div><div>Email: ' + esc(quotation.buyer_email || '-') + '</div>' +
  (quotation.ar_number ? '<div>AR Number: ' + esc(quotation.ar_number) + '</div>' : '') + '</td></tr></table>' +
  '<table class="items"><thead><tr><th style="width:4%">#</th><th style="width:37%">Description</th><th style="width:10%">HSN</th><th style="width:12%">Qty</th>' +
  '<th style="width:12%">Rate (INR)</th><th style="width:9%">GST %</th><th style="width:16%">Amount</th></tr></thead><tbody>' + itemRows + '</tbody></table>' +
  '<table class="summary-wrap"><tr><td class="words"><div>Amount Chargeable (in words):</div><div style="margin-top:8px;color:#1f2933;font-weight:normal">' +
  esc(numberToWords(Number(quotation.total_amount_paise || 0))) + '</div></td><td><table class="summary">' + summaryRows.join('') +
  '<tr class="grand"><td>GRAND TOTAL</td><td class="amount">' + money(quotation.total_amount_paise) + '</td></tr></table></td></tr></table>' +
  '<div class="terms"><b style="color:#102f59">TERMS &amp; CONDITIONS</b><div style="margin-top:7px">Payment Terms: ' +
  esc(quotation.payment_terms || settings.default_payment_terms || 'As mutually agreed') + '</div><div>Delivery Terms: ' +
  esc(quotation.delivery_terms || 'As mutually agreed') + '</div>' + (quotation.notes ? '<div>Notes: ' + esc(quotation.notes) + '</div>' : '') +
  '</div><table class="signatures"><tr><td><b style="color:#102f59">Customer Acceptance</b><div class="signature-line">&nbsp;</div></td><td><b style="color:#102f59">For ' +
  esc(settings.legal_name || 'BABA ENTERPRISES') + '</b><div class="signature-line">Authorized Signatory</div></td></tr></table>' +
  '<div class="declaration"><b style="color:#102f59">DECLARATION</b><div style="margin-top:6px">' + esc(declaration) +
  '</div></div><div class="footer">This is a computer-generated quotation.</div><div class="tricolor" style="margin-top:8px"></div></div></body></html>';
  return new TextEncoder().encode(html);
}
