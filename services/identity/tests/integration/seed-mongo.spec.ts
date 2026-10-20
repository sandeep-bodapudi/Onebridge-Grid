import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectMongo, MongoConnectionHandle } from '@onebridge/shared';
import { seedDevDatabase } from '../../src/infrastructure/seed';

const TEST_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('Real MongoDB Seed Idempotency & Production Refusal (Fix 1: AC-A9)', () => {
  let mongod: MongoMemoryServer;
  let connectionHandle: MongoConnectionHandle;

  const originalEnv = { ...process.env };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    process.env.ENCRYPTION_KEY = TEST_KEY;
    process.env.JWT_SECRET = 'a'.repeat(32);
    process.env.INTERNAL_SERVICE_KEY = 'b'.repeat(32);
    connectionHandle = await connectMongo(mongod.getUri());
  }, 120000);

  afterAll(async () => {
    if (connectionHandle) {
      await connectionHandle.close();
    }
    if (mongod) {
      await mongod.stop();
    }
    process.env = originalEnv;
  });

  beforeEach(async () => {
    const db = connectionHandle._getInternalDb();
    await db.collection('organizations').deleteMany({});
    await db.collection('persons').deleteMany({});
    await db.collection('memberships').deleteMany({});
  });

  it('seeds database successfully on first run and is strictly idempotent on repeated run', async () => {
    // 1. Initial seed run
    const result1 = await seedDevDatabase(connectionHandle);
    expect(result1.seeded).toBe(true);

    const db = connectionHandle._getInternalDb();
    const orgCount1 = await db.collection('organizations').countDocuments();
    const personCount1 = await db.collection('persons').countDocuments();
    const membershipCount1 = await db.collection('memberships').countDocuments();

    // Organizations belong to the organization service (seedDevOrganizations);
    // identity's seed must not write that collection.
    expect(orgCount1).toBe(0);
    expect(personCount1).toBeGreaterThan(0);
    expect(membershipCount1).toBeGreaterThan(0);

    // 2. Second seed run must be a no-op
    const result2 = await seedDevDatabase(connectionHandle);
    expect(result2.seeded).toBe(false);
    expect(result2.message).toContain('already seeded');

    // Counts remain identical
    const orgCount2 = await db.collection('organizations').countDocuments();
    const personCount2 = await db.collection('persons').countDocuments();
    const membershipCount2 = await db.collection('memberships').countDocuments();

    expect(orgCount2).toBe(orgCount1);
    expect(personCount2).toBe(personCount1);
    expect(membershipCount2).toBe(membershipCount1);
  });

  it('refuses to seed database under NODE_ENV=production', async () => {
    const originalEnv = { ...process.env };
    try {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'j'.repeat(32);
      process.env.INTERNAL_SERVICE_KEY = 'k'.repeat(32);
      process.env.ENCRYPTION_KEY = 'e'.repeat(64);
      process.env.ENABLE_FAKE_OTP = 'false';
      process.env.ENABLE_FAKE_OAUTH = 'false';
      await expect(seedDevDatabase(connectionHandle)).rejects.toThrow(
        /Database seeding is strictly forbidden in production/
      );
    } finally {
      process.env = originalEnv;
    }
  });
});
