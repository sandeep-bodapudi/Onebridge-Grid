import { describe, it, expect } from 'vitest';
import { checkPasswordPolicy, hashPassword, verifyAgainstDummy, verifyPassword } from '../../src/domain/password';

describe('D-AUTH-EMAIL passwords (scrypt)', () => {
  it('hashes with scrypt parameters in the string and verifies the right password only', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash).toMatch(/^scrypt\$15\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
    expect(await verifyPassword('correct horse batterY', hash)).toBe(false);
  });

  it('salts every hash', async () => {
    expect(await hashPassword('same password here')).not.toBe(await hashPassword('same password here'));
  });

  it('rejects tampered, truncated or foreign hash strings', async () => {
    const hash = await hashPassword('correct horse battery');
    const parts = hash.split('$');
    const flipped = Buffer.from(parts[5], 'base64');
    flipped[0] ^= 1;
    expect(await verifyPassword('correct horse battery', [...parts.slice(0, 5), flipped.toString('base64')].join('$'))).toBe(false);
    expect(await verifyPassword('correct horse battery', parts.slice(0, 5).join('$'))).toBe(false);
    expect(await verifyPassword('correct horse battery', 'bcrypt$whatever')).toBe(false);
    expect(await verifyPassword('correct horse battery', 'scrypt$40$8$1$AA==$AA==')).toBe(false);
  });

  it('treats Unicode forms of the same password as equal', async () => {
    const hash = await hashPassword('café-password-1');
    expect(await verifyPassword('café-password-1', hash)).toBe(true);
  });

  it('verifies against a dummy hash for unknown emails and always fails', async () => {
    expect(await verifyAgainstDummy('anything at all')).toBe(false);
  });

  it('applies the password policy', () => {
    expect(checkPasswordPolicy('short1')).toBe('too_short');
    expect(checkPasswordPolicy('x'.repeat(129))).toBe('too_long');
    expect(checkPasswordPolicy('meera.iyer@example.com', { email: 'Meera.Iyer@example.com' })).toBe('same_as_email');
    expect(checkPasswordPolicy('meera.iyer', { email: 'meera.iyer@example.com' })).toBe('same_as_email');
    expect(checkPasswordPolicy('Meera Iyer Rao', { name: 'meera iyer rao' })).toBe('same_as_name');
    expect(checkPasswordPolicy('a long enough passphrase', { email: 'meera@example.com', name: 'Meera' })).toBeNull();
    // Ten characters counted as characters, not bytes.
    expect(checkPasswordPolicy('पासवर्डपासवर्ड')).toBeNull();
  });
});
