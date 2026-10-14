import { describe, it, expect } from 'vitest';
import { redactSensitiveFields, isSensitiveKey, REDACTED_VALUE } from '../src/redaction.js';

describe('Audit Log Redaction Utility (redaction.ts)', () => {
  describe('isSensitiveKey', () => {
    it('identifies sensitive keys accurately', () => {
      expect(isSensitiveKey('password')).toBe(true);
      expect(isSensitiveKey('newPassword')).toBe(true);
      expect(isSensitiveKey('passcode')).toBe(true);
      expect(isSensitiveKey('token')).toBe(true);
      expect(isSensitiveKey('accessToken')).toBe(true);
      expect(isSensitiveKey('refreshToken')).toBe(true);
      expect(isSensitiveKey('idToken')).toBe(true);
      expect(isSensitiveKey('otp')).toBe(true);
      expect(isSensitiveKey('otpCode')).toBe(true);
      expect(isSensitiveKey('secret')).toBe(true);
      expect(isSensitiveKey('clientSecret')).toBe(true);
      expect(isSensitiveKey('hash')).toBe(true);
      expect(isSensitiveKey('passwordHash')).toBe(true);
      expect(isSensitiveKey('pin')).toBe(true);
      expect(isSensitiveKey('credential')).toBe(true);
      expect(isSensitiveKey('authorization')).toBe(true);
      expect(isSensitiveKey('cookie')).toBe(true);
      expect(isSensitiveKey('apiKey')).toBe(true);
      expect(isSensitiveKey('privateKey')).toBe(true);
      expect(isSensitiveKey('serviceKey')).toBe(true);
    });

    it('does not flag benign business keys as sensitive', () => {
      expect(isSensitiveKey('id')).toBe(false);
      expect(isSensitiveKey('tenantId')).toBe(false);
      expect(isSensitiveKey('personId')).toBe(false);
      expect(isSensitiveKey('title')).toBe(false);
      expect(isSensitiveKey('name')).toBe(false);
      expect(isSensitiveKey('branchId')).toBe(false);
      expect(isSensitiveKey('departmentId')).toBe(false);
      expect(isSensitiveKey('email')).toBe(false);
      expect(isSensitiveKey('phone')).toBe(false);
      expect(isSensitiveKey('key')).toBe(false); // Storage key or dictionary key
    });
  });

  describe('redactSensitiveFields', () => {
    it('redacts sensitive fields in shallow objects', () => {
      const input = {
        title: 'VP Engineering',
        password: 'PlainTextPassword123!',
        token: 'eyJh...token',
        otp: '984512',
      };

      const redacted = redactSensitiveFields(input);
      expect(redacted.title).toBe('VP Engineering');
      expect(redacted.password).toBe(REDACTED_VALUE);
      expect(redacted.token).toBe(REDACTED_VALUE);
      expect(redacted.otp).toBe(REDACTED_VALUE);
    });

    it('recursively redacts nested object trees and arrays', () => {
      const input = {
        action: 'auth.mfa_enabled',
        actor: 'user_123',
        details: {
          clientSecret: 'secret_live_999',
          session: {
            refreshToken: 'rt_xyz',
            validUntil: '2026-12-31T00:00:00Z',
          },
          tokens: ['tok_1', 'tok_2'],
          nestedList: [
            { id: '1', otpCode: '111222' },
            { id: '2', normalField: 'safe' },
          ],
        },
      };

      const redacted = redactSensitiveFields(input);
      expect(redacted.details.clientSecret).toBe(REDACTED_VALUE);
      expect(redacted.details.session.refreshToken).toBe(REDACTED_VALUE);
      expect(redacted.details.session.validUntil).toBe('2026-12-31T00:00:00Z');
      expect(redacted.details.nestedList[0].otpCode).toBe(REDACTED_VALUE);
      expect(redacted.details.nestedList[0].id).toBe('1');
      expect(redacted.details.nestedList[1].normalField).toBe('safe');
    });

    it('handles primitives, null, and undefined without error', () => {
      expect(redactSensitiveFields(null)).toBeNull();
      expect(redactSensitiveFields(undefined)).toBeUndefined();
      expect(redactSensitiveFields('string')).toBe('string');
      expect(redactSensitiveFields(42)).toBe(42);
      expect(redactSensitiveFields(true)).toBe(true);
    });
  });
});
