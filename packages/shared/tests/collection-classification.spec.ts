import { describe, it, expect } from 'vitest';
import {
  KNOWN_COLLECTIONS,
  ALLOWLISTED_GLOBAL_COLLECTIONS,
  getCollectionClassification,
  TenantScopedRepository,
  GlobalRepository,
} from '../src';
import { Db } from 'mongodb';

describe('Collection Classification Registry & Base Class Guard', () => {
  it('should strictly allowlist only approved global collections', () => {
    const expectedGlobals = [
      'persons',
      'sessions',
      'otp_challenges',
      'issued_id_registries',
      'rate_limits',
      // N01 (D-N01): member profiles belong to the person, not a company, so they have no tenant.
      'member_profiles',
      'work_history',
      // Profiles read models of public company names and seat titles (ADR-0003).
      'profile_org_refs',
      'profile_seat_refs',
      // N04 (D-N04): follow edges connect people and companies across tenants; IDs only.
      'follows',
      'social_company_refs',
      // N03 (D-N03): the directory spans companies and members, built from public profile text only.
      'search_documents',
    ];

    expect(ALLOWLISTED_GLOBAL_COLLECTIONS.sort()).toEqual(expectedGlobals.sort());
    expect(Object.keys(KNOWN_COLLECTIONS).length).toBeGreaterThan(0);
  });

  it('should identify tenant-scoped collections correctly', () => {
    expect(getCollectionClassification('organizations')).toBe('tenant-scoped');
    expect(getCollectionClassification('memberships')).toBe('tenant-scoped');
    expect(getCollectionClassification('cards')).toBe('tenant-scoped');
    expect(getCollectionClassification('leads')).toBe('tenant-scoped');
  });

  it('should fail with an error on unclassified collections', () => {
    expect(() => getCollectionClassification('random_untracked_collection')).toThrowError(
      /Unclassified collection: "random_untracked_collection"/
    );
  });

  it('should prevent TenantScopedRepository from wrapping a global collection', () => {
    const fakeDb = { collection: () => ({}) } as unknown as Db;
    expect(() => new TenantScopedRepository(fakeDb, 'persons')).toThrowError(
      /Collection "persons" is classified as "global", not "tenant-scoped"/
    );
  });

  it('should prevent GlobalRepository from wrapping a tenant-scoped collection', () => {
    const fakeDb = { collection: () => ({}) } as unknown as Db;
    expect(() => new GlobalRepository(fakeDb, 'cards')).toThrowError(
      /Collection "cards" is classified as "tenant-scoped". GlobalRepository can only be used for allowlisted global collections/
    );
  });
});
