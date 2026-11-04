// ==============================================================================
// BABA ENTERPRISES — STATUTORY GSTIN CHECKSUM & FORMAT VALIDATOR
// Mod-36 Luhn-variant algorithm per GST Council specifications
// ==============================================================================

const GSTIN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Validates the 15-character Indian GSTIN format and checksum.
 * Format: 2 digits (State code) + 10 chars (PAN) + 1 digit (Entity code) + 'Z' + 1 checksum char.
 */
export function validateGSTINChecksum(gstin: string): boolean {
  if (typeof gstin !== 'string' || gstin.length !== 15) return false;
  const cleanGstin = gstin.trim().toUpperCase();

  // Pattern check: 2 digits + 5 letters + 4 digits + 1 letter + 1 char + Z + 1 char
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

/**
 * Validates that the first 2 characters of the GSTIN match the given state code
 */
export function validateGSTINStateMatch(gstin: string, stateCode: string): boolean {
  if (!gstin || !stateCode) return false;
  return gstin.trim().toUpperCase().substring(0, 2) === stateCode.trim();
}
