import { describe, it, expect } from 'vitest';
import {
  generateBase32BusinessId,
  validateBusinessId,
  validateSlug,
  slugifyCompanyName,
  generateBase32StudentId,
  validateStudentId,
  formatBranchId,
  formatDepartmentId,
  formatSeatId,
  validateDerivedId,
  parseDerivedId,
} from '../src/business-id.js';

describe('Business ID & Slug Utilities', () => {
  it('generates a valid Business ID matching OB-<6 char base32>', () => {
    const id = generateBase32BusinessId();
    expect(id).toMatch(/^OB-[0-9A-HJKMNP-TV-Z]{6}$/);
    expect(validateBusinessId(id)).toBe(true);
  });

  it('generates unique Business IDs across multiple calls', () => {
    const set = new Set<string>();
    for (let i = 0; i < 50; i++) {
      set.add(generateBase32BusinessId());
    }
    expect(set.size).toBe(50);
  });

  it('rejects invalid Business ID formats', () => {
    expect(validateBusinessId('OB-123')).toBe(false); // too short
    expect(validateBusinessId('OB-1234567')).toBe(false); // too long
    expect(validateBusinessId('XX-7KQ2MX')).toBe(false); // wrong prefix
    expect(validateBusinessId('OB-7KQ2MI')).toBe(false); // contains invalid char 'I'
    expect(validateBusinessId('OB-7KQ2MO')).toBe(false); // contains invalid char 'O'
    expect(validateBusinessId('')).toBe(false);
  });

  it('validates slugs correctly', () => {
    expect(validateSlug('acme-corp').isValid).toBe(true);
    expect(validateSlug('tech123').isValid).toBe(true);
    expect(validateSlug('ab').isValid).toBe(false); // too short
    expect(validateSlug('a'.repeat(64)).isValid).toBe(false); // too long
    expect(validateSlug('-leading').isValid).toBe(false);
    expect(validateSlug('trailing-').isValid).toBe(false);
    expect(validateSlug('double--hyphen').isValid).toBe(false);
    expect(validateSlug('UPPERCASE').isValid).toBe(true); // normalized to lowercase
    expect(validateSlug('admin').isValid).toBe(false); // reserved
    expect(validateSlug('auth').isValid).toBe(false); // reserved
  });

  it('slugifies company names properly', () => {
    expect(slugifyCompanyName('Acme Enterprises Pvt. Ltd.')).toBe('acme-enterprises-pvt-ltd');
    expect(slugifyCompanyName('  OneBridge Grid  ')).toBe('onebridge-grid');
    expect(slugifyCompanyName('!!!Special & Characters???')).toBe('special-characters');
  });

  describe('Student ID (AC-5, F27 ready)', () => {
    it('generates and validates student ID format OB-S<6 char base32>', () => {
      const studentId = generateBase32StudentId();
      expect(studentId).toMatch(/^OB-S[0-9A-HJKMNP-TV-Z]{6}$/);
      expect(validateStudentId(studentId)).toBe(true);
      // Student ID is not a regular company business ID
      expect(validateBusinessId(studentId)).toBe(false);
    });

    it('rejects invalid student ID formats', () => {
      expect(validateStudentId('OB-7KQ2MX')).toBe(false); // missing 'S'
      expect(validateStudentId('OB-S123')).toBe(false); // too short
      expect(validateStudentId('OB-S7KQ2MI')).toBe(false); // contains invalid char 'I'
      expect(validateStudentId('OB-S7KQ2MO')).toBe(false); // contains invalid char 'O'
      expect(validateStudentId('')).toBe(false);
    });
  });

  describe('Derived IDs (AC-4, PRD Section 8.2)', () => {
    const businessId = 'OB-7KQ2MX';

    it('formats branch IDs with -B<nn> (two-digit zero padded)', () => {
      expect(formatBranchId(businessId, 3)).toBe('OB-7KQ2MX-B03');
      expect(formatBranchId(businessId, 1)).toBe('OB-7KQ2MX-B01');
      expect(formatBranchId(businessId, 99)).toBe('OB-7KQ2MX-B99');
      expect(formatBranchId(businessId, 100)).toBe('OB-7KQ2MX-B100');
    });

    it('formats department IDs with -D<nn> (two-digit zero padded)', () => {
      expect(formatDepartmentId(businessId, 7)).toBe('OB-7KQ2MX-D07');
      expect(formatDepartmentId(businessId, 1)).toBe('OB-7KQ2MX-D01');
      expect(formatDepartmentId(businessId, 15)).toBe('OB-7KQ2MX-D15');
    });

    it('formats seat IDs with -E<nnnn> (four-digit zero padded)', () => {
      expect(formatSeatId(businessId, 142)).toBe('OB-7KQ2MX-E0142');
      expect(formatSeatId(businessId, 1)).toBe('OB-7KQ2MX-E0001');
      expect(formatSeatId(businessId, 9999)).toBe('OB-7KQ2MX-E9999');
      expect(formatSeatId(businessId, 10000)).toBe('OB-7KQ2MX-E10000');
    });

    it('validates derived IDs by type and general pattern', () => {
      expect(validateDerivedId('OB-7KQ2MX-B03', 'branch')).toBe(true);
      expect(validateDerivedId('OB-7KQ2MX-D07', 'department')).toBe(true);
      expect(validateDerivedId('OB-7KQ2MX-E0142', 'seat')).toBe(true);

      // Type mismatch
      expect(validateDerivedId('OB-7KQ2MX-B03', 'department')).toBe(false);
      expect(validateDerivedId('OB-7KQ2MX-D07', 'seat')).toBe(false);
      expect(validateDerivedId('OB-7KQ2MX-E0142', 'branch')).toBe(false);

      // Any valid derived ID
      expect(validateDerivedId('OB-7KQ2MX-B03')).toBe(true);
      expect(validateDerivedId('OB-7KQ2MX-D07')).toBe(true);
      expect(validateDerivedId('OB-7KQ2MX-E0142')).toBe(true);

      // Invalid base Business ID or suffix
      expect(validateDerivedId('XX-7KQ2MX-B03')).toBe(false);
      expect(validateDerivedId('OB-7KQ2MX-X01')).toBe(false);
      expect(validateDerivedId('OB-7KQ2MX')).toBe(false);
    });

    it('parses derived ID into businessId, entityType, and sequence number', () => {
      expect(parseDerivedId('OB-7KQ2MX-B03')).toEqual({
        businessId: 'OB-7KQ2MX',
        type: 'branch',
        seq: 3,
      });

      expect(parseDerivedId('OB-7KQ2MX-D07')).toEqual({
        businessId: 'OB-7KQ2MX',
        type: 'department',
        seq: 7,
      });

      expect(parseDerivedId('OB-7KQ2MX-E0142')).toEqual({
        businessId: 'OB-7KQ2MX',
        type: 'seat',
        seq: 142,
      });

      expect(parseDerivedId('invalid')).toBeNull();
    });
  });
});
