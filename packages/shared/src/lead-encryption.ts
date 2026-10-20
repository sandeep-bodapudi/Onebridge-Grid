import crypto from 'node:crypto';

export interface LeadPersonalData {
  name: string;
  phone: string;
  email?: string;
  company?: string;
  note?: string;
}

export interface EncryptedLeadPayload {
  kid: string;
  iv: string; // Base64 96-bit (12 bytes)
  authTag: string; // Base64 128-bit (16 bytes)
  ciphertext: string; // Base64
}

/**
 * Normalizes phone number to E.164.
 * Per ADR-0002 point 4: defaults to country code +91 for 10-digit Indian numbers.
 */
export function normalizePhoneToE164(phone: string): string {
  if (!phone || typeof phone !== 'string') {
    throw new Error('Phone number is required');
  }

  // Remove spaces, dashes, parentheses, dots
  let cleaned = phone.replace(/[\s\-().]/g, '');

  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  if (cleaned.startsWith('+')) {
    const digits = cleaned.substring(1);
    if (!/^\d{7,15}$/.test(digits)) {
      throw new Error(`Invalid international phone number: ${phone}`);
    }
    return `+${digits}`;
  }

  // If 10 digits, default to Indian (+91)
  if (/^\d{10}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }

  // If 12 digits starting with 91, add +
  if (/^91\d{10}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  throw new Error(`Unable to normalize phone number to E.164: ${phone}`);
}

/**
 * Computes blind index for duplicate detection.
 * Per ADR-0002 point 3: HMAC-SHA256(indexKey, tenantId + "|" + E.164 phone).
 */
export function computePhoneBlindIndex(options: {
  indexKey: string | Buffer;
  tenantId: string;
  phone: string;
}): string {
  const normalized = normalizePhoneToE164(options.phone);
  const data = `${options.tenantId}|${normalized}`;
  return crypto.createHmac('sha256', options.indexKey).update(data, 'utf8').digest('hex');
}

/**
 * Encrypts lead personal data with AES-256-GCM.
 * Per ADR-0002 point 1:
 * - JSON serialized { name, phone, email, company, note }
 * - Random 96-bit IV per record
 * - AAD = `${tenantId}|${leadId}`
 */
export function encryptLeadPayload(options: {
  payload: LeadPersonalData;
  key: Buffer;
  kid: string;
  tenantId: string;
  leadId: string;
}): EncryptedLeadPayload {
  const iv = crypto.randomBytes(12); // 96-bit IV
  const aad = `${options.tenantId}|${options.leadId}`;

  const cipher = crypto.createCipheriv('aes-256-gcm', options.key, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));

  const jsonString = JSON.stringify(options.payload);
  const encrypted = Buffer.concat([cipher.update(jsonString, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag(); // 128-bit tag

  return {
    kid: options.kid,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: encrypted.toString('base64'),
  };
}

/**
 * Decrypts lead personal data with AES-256-GCM and verifies AAD.
 */
export function decryptLeadPayload(options: {
  encrypted: EncryptedLeadPayload;
  key: Buffer;
  tenantId: string;
  leadId: string;
}): LeadPersonalData {
  const iv = Buffer.from(options.encrypted.iv, 'base64');
  const authTag = Buffer.from(options.encrypted.authTag, 'base64');
  const ciphertext = Buffer.from(options.encrypted.ciphertext, 'base64');
  const aad = `${options.tenantId}|${options.leadId}`;

  const decipher = crypto.createDecipheriv('aes-256-gcm', options.key, iv);
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8')) as LeadPersonalData;
}
