import { describe, it, expect, beforeEach } from 'vitest';
import { MfaService } from '../../src/application/mfa.service';

describe('MFA Service (AC-8)', () => {
  let mfaService: MfaService;

  beforeEach(() => {
    mfaService = new MfaService();
  });

  describe('AC-8: TOTP setup and verification', () => {
    it('should generate a valid secret and OTP Auth URI for authenticator setup', () => {
      const setup = mfaService.generateSetup('+919876543210');
      expect(setup.secret).toBeDefined();
      expect(setup.secret.length).toBeGreaterThanOrEqual(16);
      expect(setup.qrUri).toContain('otpauth://totp/OneBridge:');
    });

    it('should verify a valid current TOTP code', () => {
      const setup = mfaService.generateSetup('+919876543210');
      const validCode = mfaService.generateCurrentCode(setup.secret);
      expect(validCode).toHaveLength(6);

      const isValid = mfaService.verifyTotp(setup.secret, validCode);
      expect(isValid).toBe(true);
    });

    it('should reject invalid TOTP code', () => {
      const setup = mfaService.generateSetup('+919876543210');
      const isValid = mfaService.verifyTotp(setup.secret, '000000');
      expect(isValid).toBe(false);
    });
  });

  describe('AC-8: Mandatory MFA enforcement by role and plan', () => {
    it('should NOT require MFA for regular User on Starter plan', () => {
      const required = mfaService.isMfaMandatory({ role: 'Member', plan: 'Starter' });
      expect(required).toBe(false);
    });

    it('should NOT require MFA for Owner on Starter plan', () => {
      const required = mfaService.isMfaMandatory({ role: 'Owner', plan: 'Starter' });
      expect(required).toBe(false);
    });

    it('should require mandatory MFA for Owner on Business plan', () => {
      const required = mfaService.isMfaMandatory({ role: 'Owner', plan: 'Business' });
      expect(required).toBe(true);
    });

    it('should require mandatory MFA for Admin on Business plan', () => {
      const required = mfaService.isMfaMandatory({ role: 'Admin', plan: 'Business' });
      expect(required).toBe(true);
    });

    it('should require mandatory MFA for Owner on Enterprise plan', () => {
      const required = mfaService.isMfaMandatory({ role: 'Owner', plan: 'Enterprise' });
      expect(required).toBe(true);
    });
  });
});
