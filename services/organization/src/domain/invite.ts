import crypto from 'node:crypto';
import { normalizePhoneToE164 } from '@onebridge/shared';

/**
 * F14: employee invite and seat claim.
 * The token is random, single-use, stored only as a SHA-256 hash and
 * expires after 7 days (F14 AC-1). The invitee's contact is stored
 * encrypted (so the invite can be resent) plus a masked copy for display.
 */

export type InviteChannel = 'sms' | 'whatsapp' | 'email';
export type InviteStatus = 'pending' | 'claimed' | 'revoked' | 'expired';

export const INVITE_CHANNELS: InviteChannel[] = ['sms', 'whatsapp', 'email'];
export const INVITE_TTL_DAYS = 7;

export interface EncryptedValue {
  kid: string;
  iv: string;
  authTag: string;
  ciphertext: string;
}

export interface InviteProps {
  id: string;
  tenantId: string;
  seatId: string;
  tokenHash: string;
  channel: InviteChannel;
  contactEncrypted: EncryptedValue;
  contactMasked: string;
  /** HMAC of the normalised contact, to match the claimer without decrypting. */
  contactIndex: string;
  status: InviteStatus;
  expiresAt: string;
  createdAt: string;
  createdBy: string;
  sentCount: number;
  lastSentAt: string;
  claimedAt?: string;
  claimedBy?: string;
  revokedAt?: string;
}

export interface NoticeAcceptanceProps {
  id: string;
  tenantId: string;
  personId: string;
  seatId: string;
  inviteId: string;
  version: string;
  acceptedAt: string;
}

export class InvalidInviteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidInviteError';
  }
}

export function generateInviteToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, tokenHash: hashInviteToken(token) };
}

export function hashInviteToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Normalises a phone (E.164) or email (lowercase) for the chosen channel. */
export function normaliseContact(channel: InviteChannel, contact: unknown): string {
  if (typeof contact !== 'string' || !contact.trim()) {
    throw new InvalidInviteError(channel === 'email' ? 'Enter an email address.' : 'Enter a mobile number.');
  }
  if (channel === 'email') {
    const email = contact.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      throw new InvalidInviteError('Enter a valid email address.');
    }
    return email;
  }
  try {
    return normalizePhoneToE164(contact);
  } catch {
    throw new InvalidInviteError('Enter a valid mobile number.');
  }
}

/** "+91 •••••• 3210" or "pr•••@example.com" (no full contact leaves the service). */
export function maskContact(channel: InviteChannel, normalised: string): string {
  if (channel === 'email') {
    const [user, domain] = normalised.split('@');
    return `${user.slice(0, 2)}${'•'.repeat(Math.max(1, Math.min(user.length - 2, 4)))}@${domain}`;
  }
  const digits = normalised.replace(/^\+/, '');
  const country = normalised.startsWith('+91') ? '+91 ' : '+';
  return `${country}•••••• ${digits.slice(-4)}`;
}

export function contactIndex(indexKey: Buffer | string, tenantId: string, normalised: string): string {
  return crypto.createHmac('sha256', indexKey).update(`invite|${tenantId}|${normalised}`, 'utf8').digest('hex');
}

export function encryptContact(key: Buffer, kid: string, tenantId: string, inviteId: string, value: string): EncryptedValue {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(`${tenantId}|${inviteId}`, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return { kid, iv: iv.toString('base64'), authTag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') };
}

export function decryptContact(key: Buffer, tenantId: string, inviteId: string, value: EncryptedValue): string {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(value.iv, 'base64'));
  decipher.setAAD(Buffer.from(`${tenantId}|${inviteId}`, 'utf8'));
  decipher.setAuthTag(Buffer.from(value.authTag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(value.ciphertext, 'base64')), decipher.final()]).toString('utf8');
}

/** The status a stored invite has right now (pending invites past expiry read as expired). */
export function effectiveStatus(invite: Pick<InviteProps, 'status' | 'expiresAt'>, now: Date): InviteStatus {
  if (invite.status === 'pending' && new Date(invite.expiresAt).getTime() <= now.getTime()) return 'expired';
  return invite.status;
}

/**
 * F14 AC-2: the seat-claim privacy notice, in plain language. The version is
 * recorded with every acceptance; change the version whenever the text changes.
 */
export const SEAT_NOTICE = {
  version: 'seat-notice-2026-10',
  en: {
    title: 'Before you claim this card',
    points: [
      'This card belongs to {company}. You look after it while you hold this role.',
      'Leads, saved contacts and the card’s history belong to {company}. They stay with the company when you leave.',
      'When you leave, you keep only your own public card details: your name, photo, designation and the contact details you chose to show.',
      '{company} can see who viewed and saved your card, and the details visitors share with you.',
    ],
    accept: 'I understand and accept',
    decline: 'Decline',
  },
  hi: {
    title: 'यह कार्ड लेने से पहले',
    points: [
      'यह कार्ड {company} का है। इस पद पर रहते हुए आप इसकी देखभाल करते हैं।',
      'लीड, सेव किए गए संपर्क और कार्ड का इतिहास {company} के हैं। आपके जाने पर ये कंपनी के पास रहते हैं।',
      'जाने पर आप केवल अपने सार्वजनिक कार्ड की जानकारी रखते हैं: नाम, फ़ोटो, पद और वे संपर्क विवरण जो आपने दिखाने के लिए चुने।',
      '{company} देख सकती है कि किसने आपका कार्ड देखा और सेव किया, और विज़िटर आपके साथ कौन-सी जानकारी साझा करते हैं।',
    ],
    accept: 'मैं समझता/समझती हूँ और स्वीकार करता/करती हूँ',
    decline: 'अस्वीकार करें',
  },
} as const;
