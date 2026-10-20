import { describe, it, expect } from 'vitest';
import {
  normalizePhoneToE164,
  computePhoneBlindIndex,
  encryptLeadPayload,
  decryptLeadPayload,
  LeadPersonalData,
} from '../src/lead-encryption.js';

describe('ADR-0002: Lead encryption and blind index', () => {
  const indexKey = 'test-index-secret-key-32-bytes-long!';
  const tenantId = '01JD2X0000TENANT0000000001';
  const otherTenantId = '01JD2X0000TENANT0000000002';
  const leadId = '01JD2X0000LEAD000000000001';
  const aesKey = Buffer.alloc(32, 'k'); // 256-bit key

  const sampleLead: LeadPersonalData = {
    name: 'Rahul Sharma',
    phone: '+919876543210',
    email: 'rahul.sharma@example.com',
    company: 'Sharma Trading Co.',
    note: 'Interested in bulk orders',
  };

  describe('Phone normalization (E.164)', () => {
    it('normalizes 10-digit Indian numbers with +91 prefix', () => {
      expect(normalizePhoneToE164('9876543210')).toBe('+919876543210');
      expect(normalizePhoneToE164('09876543210')).toBe('+919876543210');
      expect(normalizePhoneToE164('+91 98765-43210')).toBe('+919876543210');
    });

    it('preserves existing E.164 international numbers with stripping of formatting characters', () => {
      expect(normalizePhoneToE164('+1 (555) 123-4567')).toBe('+15551234567');
      expect(normalizePhoneToE164('+44 20 7946 0958')).toBe('+442079460958');
    });

    it('throws error for invalid phone numbers', () => {
      expect(() => normalizePhoneToE164('123')).toThrow();
      expect(() => normalizePhoneToE164('')).toThrow();
      expect(() => normalizePhoneToE164('abc')).toThrow();
    });
  });

  describe('Blind index for duplicate detection (ADR-0002 Point 3)', () => {
    it('produces deterministic HMAC-SHA256 hash for identical tenant and normalized phone', () => {
      const hash1 = computePhoneBlindIndex({ indexKey, tenantId, phone: '+919876543210' });
      const hash2 = computePhoneBlindIndex({ indexKey, tenantId, phone: '9876543210' });
      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('string');
      expect(hash1.length).toBe(64); // 32 bytes hex
    });

    it('produces completely different blind indexes for the same phone in different tenants', () => {
      const hashTenant1 = computePhoneBlindIndex({ indexKey, tenantId, phone: '+919876543210' });
      const hashTenant2 = computePhoneBlindIndex({ indexKey, tenantId: otherTenantId, phone: '+919876543210' });
      expect(hashTenant1).not.toBe(hashTenant2);
    });

    it('produces completely different blind indexes with different index keys', () => {
      const hashKey1 = computePhoneBlindIndex({ indexKey: 'key-1', tenantId, phone: '+919876543210' });
      const hashKey2 = computePhoneBlindIndex({ indexKey: 'key-2', tenantId, phone: '+919876543210' });
      expect(hashKey1).not.toBe(hashKey2);
    });
  });

  describe('AES-256-GCM Encryption & AAD (ADR-0002 Point 1)', () => {
    it('encrypts personal payload with 96-bit random IV and AAD = tenantId|leadId', () => {
      const encrypted = encryptLeadPayload({
        payload: sampleLead,
        key: aesKey,
        kid: 'tenant-1-v1',
        tenantId,
        leadId,
      });

      expect(encrypted.kid).toBe('tenant-1-v1');
      expect(encrypted.iv).toBeDefined();
      expect(Buffer.from(encrypted.iv, 'base64').length).toBe(12); // 96 bits
      expect(encrypted.authTag).toBeDefined();
      expect(Buffer.from(encrypted.authTag, 'base64').length).toBe(16); // 128 bits
      expect(encrypted.ciphertext).toBeDefined();

      // Does not contain plaintext
      expect(encrypted.ciphertext).not.toContain(sampleLead.name);
      expect(encrypted.ciphertext).not.toContain(sampleLead.phone);
      expect(encrypted.ciphertext).not.toContain(sampleLead.email!);

      // Decrypts accurately
      const decrypted = decryptLeadPayload({
        encrypted,
        key: aesKey,
        tenantId,
        leadId,
      });

      expect(decrypted).toEqual(sampleLead);
    });

    it('rejects decryption when AAD tenantId is mismatched (record moved across tenants)', () => {
      const encrypted = encryptLeadPayload({
        payload: sampleLead,
        key: aesKey,
        kid: 'tenant-1-v1',
        tenantId,
        leadId,
      });

      expect(() => {
        decryptLeadPayload({
          encrypted,
          key: aesKey,
          tenantId: otherTenantId, // Different tenant!
          leadId,
        });
      }).toThrow();
    });

    it('rejects decryption when AAD leadId is mismatched (ciphertext copied to another record)', () => {
      const encrypted = encryptLeadPayload({
        payload: sampleLead,
        key: aesKey,
        kid: 'tenant-1-v1',
        tenantId,
        leadId,
      });

      expect(() => {
        decryptLeadPayload({
          encrypted,
          key: aesKey,
          tenantId,
          leadId: '01JD2X0000LEAD000000000002', // Different lead!
        });
      }).toThrow();
    });

    it('rejects decryption when ciphertext or authTag is tampered', () => {
      const encrypted = encryptLeadPayload({
        payload: sampleLead,
        key: aesKey,
        kid: 'tenant-1-v1',
        tenantId,
        leadId,
      });

      const tamperedTag = {
        ...encrypted,
        authTag: Buffer.from('tampered12345678').toString('base64'),
      };

      expect(() => {
        decryptLeadPayload({
          encrypted: tamperedTag,
          key: aesKey,
          tenantId,
          leadId,
        });
      }).toThrow();
    });
  });
});
