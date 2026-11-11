// ==============================================================================
// BABA ENTERPRISES — STATUTORY GSTIN & TAX COMPUTATION UTILS
// Mod-36 Luhn checksum, state code matching, and PAN extraction
// ==============================================================================

const GSTIN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function validateGSTINChecksum(gstin: string): boolean {
  if (typeof gstin !== 'string' || gstin.length !== 15) return false;
  const cleanGstin = gstin.trim().toUpperCase();

  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!gstinRegex.test(cleanGstin)) return false;

  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const cp = GSTIN_CHARS.indexOf(cleanGstin[i]);
    if (cp === -1) return false;
    const factor = i % 2 === 0 ? 1 : 2;
    const prod = cp * factor;
    const rem = Math.floor(prod / 36) + (prod % 36);
    sum += rem;
  }

  const checkCp = (36 - (sum % 36)) % 36;
  return cleanGstin[14] === GSTIN_CHARS[checkCp];
}

export function validateGSTINStateMatch(gstin: string, stateCode: string): boolean {
  if (!gstin || !stateCode) return false;
  return gstin.trim().toUpperCase().substring(0, 2) === stateCode.trim();
}

export function extractStateCode(gstin: string): string | null {
  if (!gstin || gstin.trim().length < 2) return null;
  const code = gstin.trim().substring(0, 2);
  return /^[0-9]{2}$/.test(code) ? code : null;
}

export function extractPAN(gstin: string): string | null {
  if (!gstin || gstin.trim().length < 12) return null;
  const pan = gstin.trim().substring(2, 12).toUpperCase();
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan) ? pan : null;
}
