import '../../../../tests/setup-mongo.ts';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectMongo, MongoConnectionHandle } from '@onebridge/shared';
import { MongoEmailCodeRepository, MongoKnownDeviceRepository } from '../../src/infrastructure/repositories/mongo-email-code.repository';
import { MongoPersonRepository } from '../../src/infrastructure/repositories/mongo-person.repository';
import { KeyService } from '../../src/application/key.service';
import { EmailCode, hashCode, sha256 } from '../../src/domain/email-code';

const TEST_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('D-AUTH-EMAIL stores', () => {
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

  it('stores email codes by ticket hash with a TTL index, and never the code or ticket', async () => {
    const repo = new MongoEmailCodeRepository(handle);
    await repo.ensureIndexes();
    const code: EmailCode = {
      id: 'ec_1',
      ticketHash: sha256('ticket-abc'),
      purpose: 'signup',
      email: 'meera@example.com',
      codeHash: hashCode('482913', 'secret'),
      attempts: 0,
      sentCount: 1,
      lastSentAt: new Date(),
      expiresAt: new Date(Date.now() + 600_000),
      pending: { name: 'Meera', passwordHash: 'scrypt$x', acceptedTermsVersion: '2026-10', acceptedPrivacyVersion: '2026-10' },
    };
    await repo.insert(code);
    const found = await repo.findByTicketHash(sha256('ticket-abc'));
    expect(found).toMatchObject({ id: 'ec_1', purpose: 'signup', attempts: 0 });
    await repo.update({ ...found!, attempts: 2 });
    expect((await repo.findByTicketHash(sha256('ticket-abc')))?.attempts).toBe(2);

    const raw = JSON.stringify(await handle._getInternalDb().collection('email_codes').findOne({ id: 'ec_1' }));
    expect(raw).not.toContain('482913');
    expect(raw).not.toContain('ticket-abc');
    const indexes = await handle._getInternalDb().collection('email_codes').indexes();
    expect(indexes.some((i) => i.key.expiresAt === 1 && i.expireAfterSeconds === 0)).toBe(true);
  });

  it('upserts known devices per person and device', async () => {
    const repo = new MongoKnownDeviceRepository(handle);
    await repo.ensureIndexes();
    const first = new Date('2026-10-01T00:00:00Z');
    await repo.upsert({ personId: 'p1', deviceIdHash: 'd1', label: 'Chrome', lastCodeAt: first, lastSeenAt: first });
    const later = new Date('2026-10-20T00:00:00Z');
    await repo.upsert({ personId: 'p1', deviceIdHash: 'd1', label: 'Chrome', lastCodeAt: first, lastSeenAt: later });
    expect((await repo.find('p1', 'd1'))?.lastSeenAt.toISOString()).toBe(later.toISOString());
    expect(await repo.find('p2', 'd1')).toBeUndefined();
    expect(await handle._getInternalDb().collection('known_devices').countDocuments()).toBe(1);
  });

  it('stores the new person fields, lowercases email and finds by Google id', async () => {
    const repo = new MongoPersonRepository(handle, new KeyService(TEST_KEY));
    await repo.ensureIndexes();
    await repo.create({
      userId: 'usr_g1',
      email: '  Meera.Iyer@Example.com ',
      name: 'Meera Iyer',
      authProviders: ['password', 'google'],
      mfa: { enabled: false },
      emailVerifiedAt: '2026-10-27T00:00:00Z',
      passwordHash: 'scrypt$15$8$1$a$b',
      googleSub: 'google-sub-1',
      language: 'hi',
    });
    const byGoogle = await repo.findByGoogleSub('google-sub-1');
    expect(byGoogle).toMatchObject({ userId: 'usr_g1', emailVerifiedAt: '2026-10-27T00:00:00Z', passwordHash: 'scrypt$15$8$1$a$b', language: 'hi' });
    expect(byGoogle?.authProviders).toEqual(['password', 'google']);
    const raw = await handle._getInternalDb().collection('persons').findOne({ userId: 'usr_g1' });
    expect(raw?.email).toBe('meera.iyer@example.com');
    expect(await repo.findByEmail('MEERA.IYER@example.com')).toBeDefined();
    // A second person may not take the same Google account.
    await expect(repo.create({ userId: 'usr_g2', authProviders: ['google'], mfa: { enabled: false }, googleSub: 'google-sub-1' })).rejects.toThrow();
  });
});
