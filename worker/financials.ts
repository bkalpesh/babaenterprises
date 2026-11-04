// ==============================================================================
// BABA ENTERPRISES — FINANCIAL CALCULATION ENGINE
// Integer arithmetic commercial half-up rounding policy:
// floor((numerator + denominator / 2) / denominator)
// Zero float precision drift. Zero integer division truncation.
// ==============================================================================

/**
 * Standard integer commercial half-up division: round(numerator / denominator)
 */
export function divideHalfUp(numerator: number, denominator: number): number {
  if (denominator === 0) throw new Error('Division by zero');
  if (numerator < 0) {
    return -Math.floor((-numerator + Math.floor(denominator / 2)) / denominator);
  }
  return Math.floor((numerator + Math.floor(denominator / 2)) / denominator);
}

export interface LineItemInput {
  productId?: string | null;
  itemDescription: string;
  hsnCode: string;
  quantityMicrounits: number; // 1 unit = 1,000,000 microunits
  unitOfMeasure?: string;
  unitPricePaise: number;
  discountBps?: number; // 100 bps = 1.00%
  gstRateBps: number; // 0, 500, 1200, 1800, 2800 (MUST NOT be null when issuing)
}

export interface ComputedLineItem {
  productId: string | null;
  itemDescription: string;
  hsnCode: string;
  quantityMicrounits: number;
  unitOfMeasure: string;
  unitPricePaise: number;
  grossAmountPaise: number;
  discountBps: number;
  discountAmountPaise: number;
  taxableAmountPaise: number;
  gstRateBps: number;
  cgstRateBps: number;
  sgstRateBps: number;
  igstRateBps: number;
  cgstAmountPaise: number;
  sgstAmountPaise: number;
  igstAmountPaise: number;
  totalAmountPaise: number;
}

export interface ComputedInvoiceTotals {
  subtotalGrossPaise: number;
  totalDiscountPaise: number;
  taxableAmountPaise: number;
  cgstAmountPaise: number;
  sgstAmountPaise: number;
  igstAmountPaise: number;
  totalTaxPaise: number;
  applyRoundOff: boolean;
  roundOffPaise: number;
  totalInvoiceAmountPaise: number;
}

/**
 * Computes individual line item finances under verified integer rules
 */
export function computeLineItem(
  item: LineItemInput,
  isInterstate: boolean
): ComputedLineItem {
  if (item.quantityMicrounits <= 0) {
    throw new Error('Quantity must be greater than zero');
  }
  if (item.unitPricePaise < 0) {
    throw new Error('Unit price cannot be negative');
  }
  if (![0, 500, 1200, 1800, 2800].includes(item.gstRateBps)) {
    throw new Error(`Invalid or unverified GST rate bps: ${item.gstRateBps}`);
  }

  // 1. Gross amount: (quantity_microunits * unit_price_paise) / 1,000,000
  const grossAmountPaise = divideHalfUp(
    item.quantityMicrounits * item.unitPricePaise,
    1_000_000
  );

  // 2. Discount amount: (gross_amount_paise * discount_bps) / 10,000
  const discountBps = item.discountBps ?? 0;
  if (discountBps < 0 || discountBps > 10000) {
    throw new Error('Discount basis points must be between 0 and 10000');
  }
  const discountAmountPaise = divideHalfUp(
    grossAmountPaise * discountBps,
    10_000
  );

  // 3. Taxable amount
  const taxableAmountPaise = Math.max(0, grossAmountPaise - discountAmountPaise);

  // 4. Tax rates and amounts
  let cgstRateBps = 0;
  let sgstRateBps = 0;
  let igstRateBps = 0;
  let cgstAmountPaise = 0;
  let sgstAmountPaise = 0;
  let igstAmountPaise = 0;

  if (isInterstate) {
    igstRateBps = item.gstRateBps;
    igstAmountPaise = divideHalfUp(taxableAmountPaise * igstRateBps, 10_000);
  } else {
    // Intrastate divides GST evenly between CGST and SGST
    cgstRateBps = Math.floor(item.gstRateBps / 2);
    sgstRateBps = Math.floor(item.gstRateBps / 2);
    cgstAmountPaise = divideHalfUp(taxableAmountPaise * cgstRateBps, 10_000);
    sgstAmountPaise = divideHalfUp(taxableAmountPaise * sgstRateBps, 10_000);
  }

  // 5. Total line item amount
  const totalAmountPaise =
    taxableAmountPaise + cgstAmountPaise + sgstAmountPaise + igstAmountPaise;

  return {
    productId: item.productId || null,
    itemDescription: item.itemDescription.trim(),
    hsnCode: item.hsnCode.trim(),
    quantityMicrounits: item.quantityMicrounits,
    unitOfMeasure: item.unitOfMeasure || 'NOS',
    unitPricePaise: item.unitPricePaise,
    grossAmountPaise,
    discountBps,
    discountAmountPaise,
    taxableAmountPaise,
    gstRateBps: item.gstRateBps,
    cgstRateBps,
    sgstRateBps,
    igstRateBps,
    cgstAmountPaise,
    sgstAmountPaise,
    igstAmountPaise,
    totalAmountPaise,
  };
}

/**
 * Computes header totals by summing line items and applying commercial round-off
 */
export function computeTotals(
  items: ComputedLineItem[],
  applyRoundOff: boolean = true
): ComputedInvoiceTotals {
  let subtotalGrossPaise = 0;
  let totalDiscountPaise = 0;
  let taxableAmountPaise = 0;
  let cgstAmountPaise = 0;
  let sgstAmountPaise = 0;
  let igstAmountPaise = 0;

  for (const item of items) {
    subtotalGrossPaise += item.grossAmountPaise;
    totalDiscountPaise += item.discountAmountPaise;
    taxableAmountPaise += item.taxableAmountPaise;
    cgstAmountPaise += item.cgstAmountPaise;
    sgstAmountPaise += item.sgstAmountPaise;
    igstAmountPaise += item.igstAmountPaise;
  }

  const totalTaxPaise = cgstAmountPaise + sgstAmountPaise + igstAmountPaise;
  const unroundedTotal = taxableAmountPaise + totalTaxPaise;

  let roundOffPaise = 0;
  if (applyRoundOff) {
    const remainder = unroundedTotal % 100;
    if (remainder !== 0) {
      if (remainder < 50) {
        roundOffPaise = -remainder;
      } else {
        roundOffPaise = 100 - remainder;
      }
    }
  }

  const totalInvoiceAmountPaise = unroundedTotal + roundOffPaise;

  return {
    subtotalGrossPaise,
    totalDiscountPaise,
    taxableAmountPaise,
    cgstAmountPaise,
    sgstAmountPaise,
    igstAmountPaise,
    totalTaxPaise,
    applyRoundOff,
    roundOffPaise,
    totalInvoiceAmountPaise,
  };
}

/**
 * Formats paise integer to Indian Rupee display (e.g. 125050 -> "₹1,250.50")
 */
export function formatPaiseToINR(paise: number): string {
  const isNegative = paise < 0;
  const absPaise = Math.abs(paise);
  const rupees = Math.floor(absPaise / 100);
  const remainingPaise = absPaise % 100;
  const paiseStr = remainingPaise.toString().padStart(2, '0');

  // Indian number grouping
  let rupeeStr = rupees.toString();
  if (rupeeStr.length > 3) {
    const lastThree = rupeeStr.substring(rupeeStr.length - 3);
    const otherDigits = rupeeStr.substring(0, rupeeStr.length - 3);
    rupeeStr = otherDigits.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
  }

  return `${isNegative ? '-' : ''}₹${rupeeStr}.${paiseStr}`;
}
