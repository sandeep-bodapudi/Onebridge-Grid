import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectMongo, MongoConnectionHandle } from '@onebridge/shared';
import { KeyService } from '../../src/application/key.service';
import { MongoPersonRepository } from '../../src/infrastructure/repositories/mongo-person.repository';
import { MongoSessionRepository } from '../../src/infrastructure/repositories/mongo-session.repository';
import { MongoOtpRepository } from '../../src/infrastructure/repositories/mongo-otp.repository';
import { MongoMembershipRepository } from '../../src/infrastructure/repositories/mongo-membership.repository';

const TEST_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('Real MongoDB Indexes & Constraints (Fix 1: AC-A9)', () => {
  let mongod: MongoMemoryServer;
  let connectionHandle: MongoConnectionHandle;
  const keyService = new KeyService(TEST_KEY);

  let personRepo: MongoPersonRepository;
  let sessionRepo: MongoSessionRepository;
  let otpRepo: MongoOtpRepository;
  let membershipRepo: MongoMembershipRepository;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    connectionHandle = await connectMongo(mongod.getUri());

    personRepo = new MongoPersonRepository(connectionHandle, keyService);
    sessionRepo = new MongoSessionRepository(connectionHandle);
    otpRepo = new MongoOtpRepository(connectionHandle);
    membershipRepo = new MongoMembershipRepository(connectionHandle);

    await personRepo.ensureIndexes();
    await sessionRepo.ensureIndexes();
    await otpRepo.ensureIndexes();
    await membershipRepo.ensureIndexes();
  }, 120000);

  afterAll(async () => {
    if (connectionHandle) {
      await connectionHandle.close();
    }
    if (mongod) {
      await mongod.stop();
    }
  });

  beforeEach(async () => {
    const db = connectionHandle._getInternalDb();
    await db.collection('persons').deleteMany({});
    await db.collection('sessions').deleteMany({});
    await db.collection('otps').deleteMany({});
    await db.collection('memberships').deleteMany({});
  });

  it('enforces unique constraints on person phone and email', async () => {
    await personRepo.create({
      userId: 'p1',
      phone: '+919999911111',
      email: 'unique@example.com',
      authProviders: ['phone'],
      mfa: { enabled: false },
      roles: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Attempt duplicate phone
    await expect(
      personRepo.create({
        userId: 'p2',
        phone: '+919999911111',
        email: 'other@example.com',
        authProviders: ['phone'],
        mfa: { enabled: false },
        roles: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    ).rejects.toThrow();

    // Attempt duplicate email
    await expect(
      personRepo.create({
        userId: 'p3',
        phone: '+919999922222',
        email: 'unique@example.com',
        authProviders: ['email'],
        mfa: { enabled: false },
        roles: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    ).rejects.toThrow();
  });

  it('enforces unique compound index on membership (tenantId, personId)', async () => {
    await membershipRepo.save({
      id: 'm1',
      personId: 'p1',
      orgId: 'org_test',
      role: 'Member',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const db = connectionHandle._getInternalDb();
    // Directly attempting duplicate insert with same tenantId and personId violates unique compound index
    await expect(
      db.collection('memberships').insertOne({
        id: 'm2',
        tenantId: 'org_test',
        personId: 'p1',
        role: 'Admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    ).rejects.toThrow();
  });

  it('verifies TTL indexes on sessions and otps collections', async () => {
    const db = connectionHandle._getInternalDb();

    const sessionIndexes = await db.collection('sessions').indexes();
    const sessionTtl = sessionIndexes.find(
      (idx) => idx.expireAfterSeconds !== undefined && idx.key?.expiresAt !== undefined
    );
    expect(sessionTtl).toBeDefined();

    const otpIndexes = await db.collection('otp_challenges').indexes();
    const otpTtl = otpIndexes.find(
      (idx) => idx.expireAfterSeconds !== undefined && idx.key?.expiresAt !== undefined
    );
    expect(otpTtl).toBeDefined();
  });
});
