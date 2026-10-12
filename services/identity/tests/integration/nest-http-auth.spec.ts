import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectMongo, MongoConnectionHandle } from '@onebridge/shared';
import { createApp } from '../../src/app';
import { IdentityEnvConfig } from '../../src/config/env';
import { AuthService } from '../../src/application/auth.service';

const TEST_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('Real NestJS HTTP-Level Auth & Security Tests (Fix 1 & 2: AC-A8)', () => {
  let mongod: MongoMemoryServer;
  let connectionHandle: MongoConnectionHandle;
  let app: INestApplication;
  let authService: AuthService;

  const testConfig: IdentityEnvConfig = {
    nodeEnv: 'development',
    port: 4001,
    appUrl: 'http://localhost:3000',
    mongoUri: '',
    allowRemoteSeed: true,
    jwtSecret: 'a'.repeat(32),
    internalServiceKey: 'b'.repeat(32),
    encryptionKey: TEST_KEY,
    cookieSecure: false,
    cookiePath: '/auth',
    enableFakeOtp: true,
    enableFakeOauth: true,
  };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    testConfig.mongoUri = mongod.getUri();
    connectionHandle = await connectMongo(mongod.getUri());

    app = await createApp({
      envConfig: testConfig,
      connectionHandle,
    });
    await app.init();
    authService = app.get(AuthService);
  }, 120000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (connectionHandle) {
      await connectionHandle.close();
    }
    if (mongod) {
      await mongod.stop();
    }
  });

  describe('Correlation ID Generation & RFC 7807 Problem Details', () => {
    it('generates X-Correlation-ID header on response when missing from request', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/otp')
        .send({ phone: '+919876543212' });

      expect(res.headers['x-correlation-id']).toBeDefined();
      expect(res.headers['x-correlation-id']).toMatch(/^corr-/);
    });

    it('preserves client-supplied X-Correlation-ID header', async () => {
      const clientCorrelationId = 'client-trace-id-12345';
      const res = await request(app.getHttpServer())
        .post('/auth/otp')
        .set('x-correlation-id', clientCorrelationId)
        .send({ phone: '+919876543212' });

      expect(res.headers['x-correlation-id']).toBe(clientCorrelationId);
    });

    it('returns RFC 7807 application/problem+json with correlationId on client error', async () => {
      const clientCorrelationId = 'error-correlation-999';
      const res = await request(app.getHttpServer())
        .get('/auth/sessions')
        .set('x-correlation-id', clientCorrelationId);

      expect(res.status).toBe(401);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body.title).toBe('Unauthorized');
      expect(res.body.status).toBe(401);
      expect(res.body.correlationId).toBe(clientCorrelationId);
    });
  });

  describe('Idempotency & Single-Send Test', () => {
    it('enforces idempotency on POST /auth/otp with a single-send guarantee', async () => {
      const idempotencyKey = 'idem-otp-single-send-01';
      const requestOtpSpy = vi.spyOn(authService, 'requestOtp');

      // 1. First send: executes request and caches response
      const firstRes = await request(app.getHttpServer())
        .post('/auth/otp')
        .set('idempotency-key', idempotencyKey)
        .send({ phone: '+919876500099' });

      expect(firstRes.status).toBe(200);
      expect(firstRes.body.message).toBeDefined();
      expect(requestOtpSpy).toHaveBeenCalledTimes(1);

      // 2. Replay with identical key and payload: returns cached response without second execution
      const replayRes = await request(app.getHttpServer())
        .post('/auth/otp')
        .set('idempotency-key', idempotencyKey)
        .send({ phone: '+919876500099' });

      expect(replayRes.status).toBe(200);
      expect(replayRes.body).toEqual(firstRes.body);
      // Critical assertion: single-send proof
      expect(requestOtpSpy).toHaveBeenCalledTimes(1);

      // 3. Replay with identical key but different payload: rejects with 422 Unprocessable Entity
      const mismatchRes = await request(app.getHttpServer())
        .post('/auth/otp')
        .set('idempotency-key', idempotencyKey)
        .send({ phone: '+919876500088' });

      expect(mismatchRes.status).toBe(422);
      expect(mismatchRes.headers['content-type']).toContain('application/problem+json');
      expect(mismatchRes.body.detail).toContain('Mismatching body for idempotency key');
      expect(requestOtpSpy).toHaveBeenCalledTimes(1);

      requestOtpSpy.mockRestore();
    });
  });

  describe('CSRF & Origin Security Enforcements', () => {
    it('rejects cross-origin request with forged Origin header with 403 Forbidden RFC 7807', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/otp')
        .set('origin', 'http://evil-attacker.com')
        .send({ phone: '+919876543212' });

      expect(res.status).toBe(403);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body.title).toBe('Forbidden');
      expect(res.body.detail).toContain('Cross-origin request rejected from Origin: "http://evil-attacker.com"');
    });

    it('rejects POST /auth/refresh when xsrf-token cookie exists but x-csrf-token header is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', ['xsrf-token=secret-token-123; refreshToken=sample-refresh'])
        .send({});

      expect(res.status).toBe(403);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body.detail).toContain('CSRF token missing');
    });

    it('rejects POST /auth/refresh when x-csrf-token header does not match xsrf-token cookie', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', ['xsrf-token=secret-token-123; refreshToken=sample-refresh'])
        .set('x-csrf-token', 'wrong-token-value')
        .send({});

      expect(res.status).toBe(403);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body.detail).toContain('Invalid CSRF token');
    });
  });
});
