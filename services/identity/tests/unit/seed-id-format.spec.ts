import { describe, it, expect } from 'vitest';
import { SEED_DATA } from '../../src/infrastructure/seed.data';

describe('Seed ULID Format Validation (Condition 1)', () => {
  const CROCKFORD_BASE32_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/;
  const FORBIDDEN_CHARS = ['I', 'L', 'O', 'U'];

  const allSeedIds: Array<{ label: string; id: string }> = [
    { label: 'tenant.acme.id', id: SEED_DATA.tenants.acme.id },
    { label: 'tenant.beta.id', id: SEED_DATA.tenants.beta.id },
    { label: 'person.acmeOwner.id', id: SEED_DATA.persons.acmeOwner.id },
    { label: 'person.acmeAdmin.id', id: SEED_DATA.persons.acmeAdmin.id },
    { label: 'person.acmeEmployee.id', id: SEED_DATA.persons.acmeEmployee.id },
    { label: 'person.betaOwner.id', id: SEED_DATA.persons.betaOwner.id },
    { label: 'person.betaAdmin.id', id: SEED_DATA.persons.betaAdmin.id },
    { label: 'person.betaEmployee.id', id: SEED_DATA.persons.betaEmployee.id },
    { label: 'membership.acmeOwner.id', id: SEED_DATA.memberships.acmeOwner.id },
    { label: 'membership.acmeAdmin.id', id: SEED_DATA.memberships.acmeAdmin.id },
    { label: 'membership.acmeEmployee.id', id: SEED_DATA.memberships.acmeEmployee.id },
    { label: 'membership.betaOwner.id', id: SEED_DATA.memberships.betaOwner.id },
    { label: 'membership.betaAdmin.id', id: SEED_DATA.memberships.betaAdmin.id },
    { label: 'membership.betaEmployee.id', id: SEED_DATA.memberships.betaEmployee.id },
  ];

  it('should ensure all seeded IDs are exactly 26 characters long', () => {
    for (const { label, id } of allSeedIds) {
      expect(id.length, `ID ${label} must be 26 characters`).toBe(26);
    }
  });

  it('should ensure all seeded IDs match Crockford Base32 pattern without I, L, O, U', () => {
    for (const { label, id } of allSeedIds) {
      expect(
        CROCKFORD_BASE32_REGEX.test(id),
        `ID ${label} (${id}) must match Crockford Base32 26-char regex`
      ).toBe(true);

      for (const char of FORBIDDEN_CHARS) {
        expect(
          id.includes(char),
          `ID ${label} (${id}) must not contain forbidden character "${char}"`
        ).toBe(false);
      }
    }
  });

  it('should ensure all seeded IDs are unique', () => {
    const idSet = new Set(allSeedIds.map((item) => item.id));
    expect(idSet.size).toBe(allSeedIds.length);
  });
});
