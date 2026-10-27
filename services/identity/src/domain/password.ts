import crypto from 'node:crypto';

/**
 * D-AUTH-EMAIL D5: scrypt from node:crypto. Stored as
 * `scrypt$<log2 N>$<r>$<p>$<salt b64>$<hash b64>`, so parameters can be raised later
 * and old hashes still verify.
 */
const LOG_N = 15;
const R = 8;
const P = 1;
const KEYLEN = 64;

function scrypt(password: string, salt: Buffer, logN: number, r: number, p: number): Promise<Buffer> {
  const N = 2 ** logN;
  return new Promise((resolve, reject) => {
    // maxmem must exceed 128 * N * r bytes (32 MiB at the defaults).
    crypto.scrypt(password.normalize('NFKC'), salt, KEYLEN, { N, r, p, maxmem: 256 * N * r }, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, LOG_N, R, P);
  return `scrypt$${LOG_N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [logN, r, p] = parts.slice(1, 4).map((x) => parseInt(x, 10));
  if (![logN, r, p].every((n) => Number.isInteger(n) && n > 0) || logN > 20 || r > 32 || p > 16) return false;
  const salt = Buffer.from(parts[4], 'base64');
  const expected = Buffer.from(parts[5], 'base64');
  if (expected.length !== KEYLEN) return false;
  const actual = await scrypt(password, salt, logN, r, p);
  return crypto.timingSafeEqual(actual, expected);
}

/** Verified when the email is unknown, so a failed sign-in takes the same time either way. */
let dummyHash: Promise<string> | undefined;
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword(crypto.randomBytes(16).toString('hex'));
  await verifyPassword(password, await dummyHash);
  return false;
}

export type PasswordProblem = 'too_short' | 'too_long' | 'same_as_email' | 'same_as_name';

/**
 * 10 to 128 characters, not the email (or its name part) and not the person's name.
 * The founder chose not to ship a common-password list (D-AUTH-EMAIL, 2026-10-27).
 */
export function checkPasswordPolicy(password: string, who: { email?: string; name?: string } = {}): PasswordProblem | null {
  const length = [...password].length;
  if (length < 10) return 'too_short';
  if (length > 128) return 'too_long';
  const lower = password.trim().toLowerCase();
  const email = who.email?.trim().toLowerCase();
  if (email && (lower === email || lower === email.split('@')[0])) return 'same_as_email';
  const name = who.name?.trim().toLowerCase().replace(/\s+/g, '');
  if (name && lower.replace(/\s+/g, '') === name) return 'same_as_name';
  return null;
}

export const PASSWORD_PROBLEM_TEXT: Record<PasswordProblem, string> = {
  too_short: 'Use at least 10 characters.',
  too_long: 'Use at most 128 characters.',
  same_as_email: "Don't use your email address as your password.",
  same_as_name: "Don't use your name as your password.",
};
