import '../../../../tests/setup-mongo.ts';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ConsoleEmailSender, connectMongo, MongoConnectionHandle } from '@onebridge/shared';
import { createApp } from '../../src/app';

const TEST_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const ORIGIN = 'http://localhost:3000';

describe('D-AUTH-EMAIL methods switch', () => {
  let mongod: MongoMemoryServer;
  let handle: MongoConnectionHandle;
  let app: INestApplication;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    handle = await connectMongo(mongod.getUri());
    app = await createApp({
      envConfig: {
        nodeEnv: 'development',
        port: 4001,
        appUrl: ORIGIN,
        mongoUri: mongod.getUri(),
        allowRemoteSeed: true,
        jwtSecret: 'a'.repeat(32),
        internalServiceKey: 'b'.repeat(32),
        encryptionKey: TEST_KEY,
        cookieSecure: false,
        cookiePath: '/auth',
        enableFakeOtp: true,
        enableFakeOauth: true,
        authMethods: ['google'],
      },
      connectionHandle: handle,
      emailSender: new ConsoleEmailSender('test'),
    });
    await app.init();
  }, 120000);

  afterAll(async () => {
    await app?.close();
    await handle?.close();
    await mongod?.stop();
  });

  it('turns the email endpoints off when email is not a method, and hides the client ID when unset', async () => {
    expect((await request(app.getHttpServer()).get('/auth/methods')).body).toEqual({ methods: ['google'] });
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', ORIGIN)
      .send({ email: 'a@example.com', password: 'whatever passphrase' })
      .expect(403);
    expect(res.body.code).toBe('method_disabled');
  });

  it('refuses code-only sign-in (phone or email codes) while phone is off', async () => {
    for (const body of [{ phone: '+919700000001' }, { email: 'invitee@example.com' }]) {
      const res = await request(app.getHttpServer()).post('/auth/otp').set('Origin', ORIGIN).send(body).expect(403);
      expect(res.body.code).toBe('method_disabled');
    }
    await request(app.getHttpServer()).post('/auth/verify').set('Origin', ORIGIN).send({ email: 'invitee@example.com', code: '123456' }).expect(403);
  });
});
