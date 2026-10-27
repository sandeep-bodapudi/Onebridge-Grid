import crypto from 'node:crypto';

/** D-AUTH-EMAIL: what an emailed 6-digit code is for. */
export type EmailCodePurpose = 'signup' | 'login' | 'reset' | 'link';

/** A sign-up waiting for its code: no account exists until the code is entered (A3 step 4). */
export interface PendingSignup {
  name: string;
  passwordHash: string;
  acceptedTermsVersion: string;
  acceptedPrivacyVersion: string;
  language?: 'en' | 'hi';
}

export interface EmailCode {
  id: string;
  /** sha256 of the ticket the client holds; the ticket itself is never stored. */
  ticketHash: string;
  purpose: EmailCodePurpose;
  email: string;
  personId?: string;
  /** HMAC-SHA256 of the code with a server secret. */
  codeHash: string;
  attempts: number;
  sentCount: number;
  lastSentAt: Date;
  expiresAt: Date;
  consumedAt?: Date;
  pending?: PendingSignup;
  /** login: the device the code confirms; link: the Google account waiting to be linked. */
  deviceIdHash?: string;
  deviceLabel?: string;
  googleSub?: string;
  googleName?: string;
}

export interface IEmailCodeRepository {
  insert(code: EmailCode): Promise<void>;
  findByTicketHash(ticketHash: string): Promise<EmailCode | undefined>;
  update(code: EmailCode): Promise<void>;
  /** Atomically marks an unconsumed code used; false if another request got there first. */
  markConsumed(id: string, at: Date): Promise<boolean>;
}

export interface KnownDevice {
  personId: string;
  deviceIdHash: string;
  label: string;
  lastCodeAt: Date;
  lastSeenAt: Date;
}

export interface IKnownDeviceRepository {
  find(personId: string, deviceIdHash: string): Promise<KnownDevice | undefined>;
  upsert(device: KnownDevice): Promise<void>;
}

export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_CODE_ATTEMPTS = 5;
export const RESEND_AFTER_MS = 60 * 1000;

export function newTicket(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function newCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function hashCode(code: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(code).digest('hex');
}

export function codeMatches(code: string, codeHash: string, secret: string): boolean {
  const actual = Buffer.from(hashCode(code, secret), 'hex');
  const expected = Buffer.from(codeHash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
