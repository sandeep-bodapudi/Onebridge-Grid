/**
 * Validates Indian Goods and Services Tax Identification Number (GSTIN) format.
 * Format: 15 alphanumeric characters
 * 1-2: State code (numeric 01-38 or 97, 99)
 * 3-12: PAN of the entity (5 letters, 4 digits, 1 letter)
 * 13: Entity code (1-9 or A-Z)
 * 14: Default character 'Z'
 * 15: Check digit (alphanumeric)
 */
export function validateGstin(gstin: string): { isValid: boolean; reason?: string } {
  if (typeof gstin !== 'string') {
    return { isValid: false, reason: 'GSTIN must be a string' };
  }
  const clean = gstin.trim().toUpperCase();
  if (clean.length !== 15) {
    return { isValid: false, reason: 'GSTIN must be exactly 15 characters long' };
  }
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!gstinRegex.test(clean)) {
    return { isValid: false, reason: 'Invalid GSTIN format. Expected format: 2 digits + 10-char PAN + 1 entity char + "Z" + 1 check digit (e.g. 29ABCDE1234F1Z5)' };
  }
  return { isValid: true };
}
