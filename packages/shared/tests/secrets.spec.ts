import { describe, it, expect } from 'vitest';
import { DEV_ENCRYPTION_KEY, DEV_INTERNAL_SERVICE_KEY, resolveEncryptionKey, resolveInternalServiceKey, resolveSecret } from '../src/index';

describe('D-VPS-DEPLOY production secrets', () => {
  it('falls back to the development default outside production', () => {
    expect(resolveSecret('X', undefined, 'dev-default', 'development')).toBe('dev-default');
    expect(resolveEncryptionKey(undefined, 'test')).toBe(DEV_ENCRYPTION_KEY);
    expect(resolveInternalServiceKey('', undefined)).toBe(DEV_INTERNAL_SERVICE_KEY);
  });

  it('refuses missing, short or development values in production, naming the variable only', () => {
    expect(() => resolveSecret('REVALIDATION_SIGNING_SECRET', undefined, 'd', 'production')).toThrow('REVALIDATION_SIGNING_SECRET is required in production');
    expect(() => resolveSecret('X', 'short-secret', 'd', 'production')).toThrow(/at least 32 characters/);
    expect(() => resolveInternalServiceKey(DEV_INTERNAL_SERVICE_KEY, 'production')).toThrow(/development default/);
    expect(() => resolveEncryptionKey(DEV_ENCRYPTION_KEY, 'production')).toThrow(/development default/);
    expect(() => resolveEncryptionKey('z'.repeat(64), 'production')).toThrow(/64 hexadecimal/);
    const err = (() => {
      try {
        resolveSecret('X', 'a-secret-value', 'd', 'production');
      } catch (e) {
        return String(e);
      }
    })();
    expect(err).toContain('X must be at least 32');
    expect(err).not.toContain('a-secret-value');
  });

  it('accepts proper production values', () => {
    const key = 'ab'.repeat(32);
    expect(resolveEncryptionKey(key, 'production')).toBe(key);
    expect(resolveInternalServiceKey('k'.repeat(48), 'production')).toBe('k'.repeat(48));
  });
});
