import '../../../../tests/setup-mongo.ts';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectMongo, MongoConnectionHandle, FakeOtpSender, FakeEventBus } from '@onebridge/shared';
import { MongoPersonRepository } from '../../src/infrastructure/repositories/mongo-person.repository';
import { KeyService } from '../../src/application/key.service';
import { AuthService } from '../../src/application/auth.service';
import { InMemoryPersonRepository } from '../../src/infrastructure/repositories/in-memory-person.repository';
import { InMemorySessionRepository } from '../../src/infrastructure/repositories/in-memory-session.repository';
import { InMemoryOtpRepository } from '../../src/infrastructure/repositories/in-memory-otp.repository';

const TEST_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('Phone-only sign-ups', () => {
  let mongod: MongoMemoryServer;
  let handle: MongoConnectionHandle;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    handle = await connectMongo(mongod.getUri());
  }, 120000);

  afterAll(async () => {
    if (handle) await handle.close();
    if (mongod) await mongod.stop();
  });

  it('stores people without an email, so a second phone-only person does not collide on email: null', async () => {
    const repo = new MongoPersonRepository(handle, new KeyService(TEST_KEY));
    await repo.ensureIndexes();
    await repo.create({ userId: 'person-a', phone: '+919811111111', authProviders: ['otp'], mfa: { enabled: false }, roles: [] });
    await expect(
      repo.create({ userId: 'person-b', phone: '+919822222222', authProviders: ['otp'], mfa: { enabled: false }, roles: [] })
    ).resolves.toBeDefined();
    const raw = await handle._getInternalDb().collection('persons').findOne({ userId: 'person-b' });
    expect(raw).not.toHaveProperty('email');
  });

  it('treats "98220 12345", "09822012345" and "+919822012345" as the same person', async () => {
    const personRepo = new InMemoryPersonRepository();
    const auth = new AuthService({
      personRepo,
      sessionRepo: new InMemorySessionRepository(),
      otpRepo: new InMemoryOtpRepository(),
      otpSender: new FakeOtpSender(),
      eventBus: new FakeEventBus(),
      jwtSecret: 'test-secret-key-32-chars-long-12345',
    });

    for (const typed of ['98220 12345', '09822012345', '+919822012345']) {
      await auth.requestOtp(typed, '127.0.0.1');
      await auth.verifyOtp(typed, '123456', 'test', '127.0.0.1');
    }

    const person = await personRepo.findByPhone('+919822012345');
    expect(person).toBeDefined();
    expect(await personRepo.findByPhone('98220 12345')).toBeUndefined();
  });
});
