/**
 * Sensitive Data Redaction Utility
 *
 * Implements AC-5 for Feature F04: Audit Log:
 * "Passwords, tokens and OTPs never appear in before/after."
 *
 * Recursively inspects data structures and replaces sensitive credentials,
 * secrets, tokens, and hashes with "[REDACTED]".
 */

const SENSITIVE_KEY_PATTERNS = [
  /pass(word|code)?/i,
  /token/i,
  /otp/i,
  /secret/i,
  /hash/i,
  /pin/i,
  /credential/i,
  /authorization/i,
  /cookie/i,
  /bearer/i,
  /(api|private|secret|signing|service)[_-]?key/i,
];

export const REDACTED_VALUE = '[REDACTED]';

export function isSensitiveKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Recursively redacts sensitive keys from objects and arrays.
 * Primitives, null, and undefined are returned unchanged.
 */
export function redactSensitiveFields<T = unknown>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveFields(item)) as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      result[key] = REDACTED_VALUE;
    } else if (value !== null && typeof value === 'object') {
      result[key] = redactSensitiveFields(value);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}
