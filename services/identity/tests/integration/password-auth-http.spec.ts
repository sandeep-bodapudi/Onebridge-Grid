import '../../../../tests/setup-mongo.ts';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ConsoleEmailSender, connectMongo, MongoConnectionHandle } from '@onebridge/shared';
import { createApp } from '../../src/app';
import { IdentityEnvConfig } from '../../src/config/env';

const TEST_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const ORIGIN = 'http://localhost:3000';

function codeIn(mail: ConsoleEmailSender, to: string): string {
  const m = (mail.lastTo(to)?.text ?? '').match(/\b(\d{6})\b/);
  if (!m) throw new Error('no code');
  return m[1];
}

function cookie(res: request.Response, name: string): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return raw?.find((c) => c.startsWith(`${name}=`));
}

describe('D-AUTH-EMAIL HTTP endpoints (A5)', () => {
  let mongod: MongoMemoryServer;
  let handle: MongoConnectionHandle;
  let app: INestApplication;
  const mail = new ConsoleEmailSender('test');
  const config: IdentityEnvConfig = {
    nodeEnv: 'development',
    port: 4001,
    appUrl: ORIGIN,
    mongoUri: '',
    allowRemoteSeed: true,
    jwtSecret: 'a'.repeat(32),
    internalServiceKey: 'b'.repeat(32),
    encryptionKey: TEST_KEY,
    cookieSecure: false,
    cookiePath: '/auth',
    enableFakeOtp: false,
    enableFakeOauth: true,
    authMethods: ['google', 'email', 'phone'],
    googleClientId: 'client-123.apps.googleusercontent.com',
  };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    config.mongoUri = mongod.getUri();
    handle = await connectMongo(mongod.getUri());
    app = await createApp({ envConfig: config, connectionHandle: handle, emailSender: mail });
    await app.init();
  }, 120000);

  afterAll(async () => {
    await app?.close();
    await handle?.close();
    await mongod?.stop();
  });

  const post = (path: string) => request(app.getHttpServer()).post(path).set('Origin', ORIGIN);

  it('reports the enabled methods and the Google client ID', async () => {
    const res = await request(app.getHttpServer()).get('/auth/methods').expect(200);
    expect(res.body).toEqual({ methods: ['google', 'email', 'phone'], googleClientId: 'client-123.apps.googleusercontent.com' });
  });

  it('signs up, verifies, then signs in again on the same browser without a code', async () => {
    const start = await post('/auth/signup')
      .send({ name: 'Ravi Kumar', email: 'ravi@example.com', password: 'a long enough passphrase', acceptedTermsVersion: '2026-10', acceptedPrivacyVersion: '2026-10' })
      .expect(202);
    expect(start.body).toMatchObject({ status: 'code_sent', maskedEmail: 'r•••@example.com' });

    const verified = await post('/auth/signup/verify').send({ ticket: start.body.ticket, code: codeIn(mail, 'ravi@example.com') }).expect(200);
    expect(verified.body.status).toBe('authenticated');
    expect(verified.body.accessToken).toBeTruthy();
    expect(cookie(verified, 'refreshToken')).toContain('HttpOnly');
    const device = cookie(verified, 'ob_device');
    expect(device).toContain('HttpOnly');
    expect(device).toContain('Path=/auth');

    const deviceCookie = device!.split(';')[0];
    const again = await post('/auth/login').set('Cookie', deviceCookie).send({ email: 'ravi@example.com', password: 'a long enough passphrase' }).expect(200);
    expect(again.body.status).toBe('authenticated');

    const otherBrowser = await post('/auth/login').send({ email: 'ravi@example.com', password: 'a long enough passphrase' }).expect(200);
    expect(otherBrowser.body).toMatchObject({ status: 'code_required', maskedEmail: 'r•••@example.com' });
    expect(otherBrowser.body.accessToken).toBeUndefined();
  });

  it('answers problems with codes the client can act on', async () => {
    const weak = await post('/auth/signup').send({ name: 'X', email: 'x@example.com', password: 'short', acceptedTermsVersion: '1', acceptedPrivacyVersion: '1' }).expect(400);
    expect(weak.body).toMatchObject({ status: 400, code: 'weak_password' });
    expect(weak.headers['content-type']).toContain('application/problem+json');

    const wrong = await post('/auth/login').send({ email: 'ravi@example.com', password: 'not the password' }).expect(401);
    expect(wrong.body.code).toBe('invalid_credentials');

    const expired = await post('/auth/login/verify').send({ ticket: 'nope', code: '123456' }).expect(400);
    expect(expired.body.code).toBe('code_expired');
  });

  it('changes the password with a bearer token and refuses without one', async () => {
    const signin = await post('/auth/login').send({ email: 'ravi@example.com', password: 'a long enough passphrase' }).expect(200);
    const done = await post('/auth/login/verify').send({ ticket: signin.body.ticket, code: codeIn(mail, 'ravi@example.com') }).expect(200);
    await post('/auth/password/change').send({ currentPassword: 'a long enough passphrase', newPassword: 'another long passphrase' }).expect(401);
    await post('/auth/password/change')
      .set('Authorization', `Bearer ${done.body.accessToken}`)
      .send({ currentPassword: 'a long enough passphrase', newPassword: 'another long passphrase' })
      .expect(204);
  });

  it('refuses cross-site posts (CSRF origin check still applies)', async () => {
    await request(app.getHttpServer()).post('/auth/login').set('Origin', 'https://evil.example').send({ email: 'ravi@example.com', password: 'x' }).expect(403);
  });
});
