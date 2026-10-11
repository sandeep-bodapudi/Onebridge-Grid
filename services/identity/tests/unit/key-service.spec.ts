import { describe, it, expect } from 'vitest';
import { KeyService } from '../../src/application/key.service';

describe('KeyService Encryption at Rest (Condition 11)', () => {
  const keyService = new KeyService('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');

  it('should encrypt sensitive string and produce iv:authTag:content format', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const encrypted = keyService.encrypt(secret);

    expect(encrypted).not.toBe(secret);
    const parts = encrypted.split(':');
    expect(parts.length).toBe(3);
    expect(parts[0].length).toBe(24); // 12 bytes IV in hex
    expect(parts[1].length).toBe(32); // 16 bytes auth tag in hex
    expect(parts[2].length).toBeGreaterThan(0);
  });

  it('should successfully decrypt ciphertext back to original plaintext', () => {
    const secret = 'MY_SUPER_SECRET_TOTP_KEY_BASE32';
    const encrypted = keyService.encrypt(secret);
    const decrypted = keyService.decrypt(encrypted);

    expect(decrypted).toBe(secret);
  });

  it('should fail decryption on corrupted ciphertext', () => {
    const encrypted = keyService.encrypt('test-secret');
    const corrupted = encrypted.slice(0, -4) + 'ffff';
    expect(() => keyService.decrypt(corrupted)).toThrow();
  });
});
