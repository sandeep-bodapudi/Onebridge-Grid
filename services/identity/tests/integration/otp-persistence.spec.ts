import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectMongo, MongoConnectionHandle } from '@onebridge/shared';
import { MongoOtpRepository } from '../../src/infrastructure/repositories/mongo-otp.repository';
import { OtpChallenge } from '../../src/domain/otp-challenge';

describe('OTP Counter Persistence Across Repository Instances (Fix 1: Real Mongo)', () => {
  let mongod: MongoMemoryServer;
  let connectionHandle: MongoConnectionHandle;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    connectionHandle = await connectMongo(mongod.getUri());
  }, 120000);

  afterAll(async () => {
    if (connectionHandle) {
      await connectionHandle.close();
    }
    if (mongod) {
      await mongod.stop();
    }
  });

  it('persists challenge state and attempt counters across separate MongoOtpRepository instances', async () => {
    // 1. Instance 1 writes OTP challenge
    const repoInstance1 = new MongoOtpRepository(connectionHandle);
    await repoInstance1.ensureIndexes();

    const challenge: OtpChallenge = {
      id: 'otp_persisted_01',
      phone: '+919876500001',
      codeHash: 'sample_hashed_code',
      salt: 'sample_salt',
      attempts: 2,
      maxAttempts: 3,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 300000),
      verified: false,
    };
    await repoInstance1.save(challenge);

    // 2. Instance 2 reads OTP challenge from database
    const repoInstance2 = new MongoOtpRepository(connectionHandle);
    const retrieved = await repoInstance2.findLatestByPhone('+919876500001');

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe('otp_persisted_01');
    expect(retrieved?.attempts).toBe(2);
    expect(retrieved?.verified).toBe(false);

    // 3. Instance 2 increments attempt counter and saves
    if (retrieved) {
      retrieved.attempts = 3;
      await repoInstance2.save(retrieved);
    }

    // 4. Instance 3 verifies incremented counter is persisted
    const repoInstance3 = new MongoOtpRepository(connectionHandle);
    const updated = await repoInstance3.findLatestByPhone('+919876500001');

    expect(updated).toBeDefined();
    expect(updated?.attempts).toBe(3);
  });
});
