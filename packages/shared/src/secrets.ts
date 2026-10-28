/**
 * D-VPS-DEPLOY B1: a secret from the environment. Outside production a missing value falls back
 * to the development default so local runs need no setup. In production the value must be set,
 * at least 32 characters, and not the development default, or the service refuses to start.
 * Messages name the variable only, never its value.
 */
export function resolveSecret(name: string, value: string | undefined, devDefault: string, nodeEnv: string | undefined): string {
  const v = (value || '').trim();
  if (nodeEnv === 'production') {
    if (!v) throw new Error(`${name} is required in production`);
    if (v.length < 32) throw new Error(`${name} must be at least 32 characters in production`);
    if (v === devDefault) throw new Error(`${name} must not be the development default in production`);
    return v;
  }
  return v || devDefault;
}

/** The development master key the key vault used when none was given. Never valid in production. */
export const DEV_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

/**
 * ENCRYPTION_KEY: 64 hex characters (256 bits). It derives every key that encrypts leads, invite
 * contacts and messages, so production refuses a missing, malformed or development value.
 */
export function resolveEncryptionKey(value: string | undefined, nodeEnv: string | undefined): string {
  const v = resolveSecret('ENCRYPTION_KEY', value, DEV_ENCRYPTION_KEY, nodeEnv);
  if (nodeEnv === 'production' && !/^[0-9a-fA-F]{64}$/.test(v)) {
    throw new Error('ENCRYPTION_KEY must be exactly 64 hexadecimal characters in production');
  }
  return v;
}

export const DEV_INTERNAL_SERVICE_KEY = 'test-internal-service-key-at-least-32-chars-12345';

/** INTERNAL_SERVICE_KEY guards every service's /internal endpoints. */
export function resolveInternalServiceKey(value: string | undefined, nodeEnv: string | undefined): string {
  return resolveSecret('INTERNAL_SERVICE_KEY', value, DEV_INTERNAL_SERVICE_KEY, nodeEnv);
}
