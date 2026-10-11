import { describe, it, expect } from 'vitest';
import * as shared from '../packages/shared/src/index.js';
import { TenantScopedRepository, GlobalRepository, MongoConnectionHandle } from '../packages/shared/src/index.js';

describe('Repository & MongoDB Encapsulation (Fix 4 & Condition 9)', () => {
  it('should verify @onebridge/shared does not export raw Db, MongoClient, or Collection', () => {
    expect('Db' in shared).toBe(false);
    expect('MongoClient' in shared).toBe(false);
    expect('Collection' in shared).toBe(false);
  });

  it('should verify MongoConnectionHandle is exported as an opaque connection manager', () => {
    expect(shared.MongoConnectionHandle).toBeDefined();
    expect(typeof shared.connectMongo).toBe('function');
  });

  it('should reject unclassified collection in TenantScopedRepository at runtime', () => {
    const fakeDb = { collection: () => ({}) };
    expect(() => {
      new TenantScopedRepository(fakeDb as any, 'unregistered_collection_xyz');
    }).toThrow(/unregistered_collection_xyz/);
  });

  it('should reject global collection in TenantScopedRepository at runtime', () => {
    const fakeDb = { collection: () => ({}) };
    expect(() => {
      new TenantScopedRepository(fakeDb as any, 'persons');
    }).toThrow(/classified as "global", not "tenant-scoped"/);
  });

  it('should reject tenant-scoped collection in GlobalRepository at runtime', () => {
    const fakeDb = { collection: () => ({}) };
    expect(() => {
      new GlobalRepository(fakeDb as any, 'memberships');
    }).toThrow(/GlobalRepository can only be used for allowlisted global collections/);
  });

  it('should prove raw collection property is protected and inaccessible at compile-time', () => {
    const fakeDb = { collection: () => ({}) };
    const repo = new GlobalRepository(fakeDb as any, 'persons');

    // Compile-time check: accessing repo.collection must produce a type error because collection is protected
    // @ts-expect-error Property 'collection' is protected and only accessible within class 'GlobalRepository<T>' and its subclasses.
    const _directCollection = repo.collection;
    expect(_directCollection).toBeDefined();
  });
});
