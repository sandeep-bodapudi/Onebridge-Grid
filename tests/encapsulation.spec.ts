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
    expect(MongoConnectionHandle).toBeDefined();
    expect(typeof shared.connectMongo).toBe('function');
  });

  it('should reject unclassified collection in TenantScopedRepository at runtime', () => {
    const fakeDb = { collection: () => ({}) } as unknown as MongoConnectionHandle;
    expect(() => {
      new TenantScopedRepository(fakeDb, 'unregistered_collection_xyz');
    }).toThrow(/unregistered_collection_xyz/);
  });

  it('should reject global collection in TenantScopedRepository at runtime', () => {
    const fakeDb = { collection: () => ({}) } as unknown as MongoConnectionHandle;
    expect(() => {
      new TenantScopedRepository(fakeDb, 'persons');
    }).toThrow(/classified as "global", not "tenant-scoped"/);
  });

  it('should reject tenant-scoped collection in GlobalRepository at runtime', () => {
    const fakeDb = { collection: () => ({}) } as unknown as MongoConnectionHandle;
    expect(() => {
      new GlobalRepository(fakeDb, 'memberships');
    }).toThrow(/GlobalRepository can only be used for allowlisted global collections/);
  });

  it('should prove raw collection property is protected and inaccessible at compile-time', () => {
    const fakeDb = { collection: () => ({}) } as unknown as MongoConnectionHandle;
    const repo = new GlobalRepository(fakeDb, 'persons');

    // Compile-time check: accessing repo.collection must produce a type error because collection is protected
    // @ts-expect-error Property 'collection' is protected and only accessible within class 'GlobalRepository<T>' and its subclasses.
    const _directCollection = repo.collection;
    expect(_directCollection).toBeDefined();
  });
});
