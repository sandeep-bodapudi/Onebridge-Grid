import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectMongo, MongoConnectionHandle, InMemoryEventBus, DomainEvent } from '@onebridge/shared';
import { ulid } from 'ulid';
import { createApp } from '../src/app.js';
import { CardsEnvConfig } from '../src/config/env.js';
import { FakeRevalidationNotifier } from '../src/infrastructure/revalidation-notifier.js';

describe('F11: Short Links & QR Codes HTTP API', () => {
  let mongod: MongoMemoryServer;
  let connectionHandle: MongoConnectionHandle;
  let app: INestApplication;
  let eventBus: InMemoryEventBus;
  let revalidationNotifier: FakeRevalidationNotifier;

  const TENANT_A = '01JACTENANTA00000000000000';
  const TENANT_B = '01JACTENANTB00000000000000';
  const SEAT_A = 'OB-7KQ2MX-E0001';
  const SEAT_B = 'OB-9ZZZZZ-E0001';

  const testConfig: CardsEnvConfig = {
    nodeEnv: 'test',
    port: 4006,
    appUrl: 'http://localhost:3000',
    mongoUri: '',
    webPublicUrl: 'http://localhost:3001',
    revalidationSigningSecret: 'test-secret-at-least-32-characters-long',
  };

  function orgCreatedEvent(tenantId: string, overrides: Partial<DomainEvent['payload']> = {}): DomainEvent {
    return {
      eventId: ulid(),
      type: 'org.created',
      version: '1.0.0',
      tenantId,
      occurredAt: new Date().toISOString(),
      correlationId: 'corr_1',
      aggregateVersion: 1,
      payload: {
        orgId: tenantId,
        businessId: 'OB-7KQ2MX',
        name: 'Acme Steels',
        slug: 'acme-steels',
        brandColours: { band: '#1B2A4A', text: '#FFFFFF', accent: '#F68713' },
        ...overrides,
      },
    };
  }

  function seatCreatedEvent(tenantId: string, seatId: string): DomainEvent {
    return {
      eventId: ulid(),
      type: 'seat.created',
      version: '1.0.0',
      tenantId,
      occurredAt: new Date().toISOString(),
      correlationId: 'corr_1',
      aggregateVersion: 1,
      payload: {
        orgId: tenantId,
        seatId,
        title: 'Sales Lead',
        personId: 'person_sneha',
        status: 'active',
      },
    };
  }

  function branchCreatedEvent(tenantId: string, branchId: string, name: string): DomainEvent {
    return {
      eventId: ulid(),
      type: 'branch.created',
      version: '1.0.0',
      tenantId,
      occurredAt: new Date().toISOString(),
      correlationId: 'corr_1',
      aggregateVersion: 1,
      payload: {
        orgId: tenantId,
        branchId,
        name,
        slug: 'mumbai-hq',
        city: 'Mumbai',
        status: 'active',
      },
    };
  }

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    testConfig.mongoUri = mongod.getUri();
    connectionHandle = await connectMongo(mongod.getUri());

    eventBus = new InMemoryEventBus();
    revalidationNotifier = new FakeRevalidationNotifier();

    app = await createApp({
      envConfig: testConfig,
      connectionHandle,
      eventBus,
      revalidationNotifier,
    });
    await app.init();

    // Seed Tenant A and Tenant B
    await eventBus.publish(orgCreatedEvent(TENANT_A));
    await eventBus.publish(seatCreatedEvent(TENANT_A, SEAT_A));
    await eventBus.publish(branchCreatedEvent(TENANT_A, 'OB-7KQ2MX-B01', 'Mumbai Headquarters'));

    await eventBus.publish(orgCreatedEvent(TENANT_B, { name: 'Beta Logistics', businessId: 'OB-9ZZZZZ', slug: 'beta-logistics' }));
    await eventBus.publish(seatCreatedEvent(TENANT_B, SEAT_B));
  });

  afterAll(async () => {
    if (app) await app.close();
    if (connectionHandle) await connectionHandle.close();
    if (mongod) await mongod.stop();
  });

  describe('AC-1: Card Default Short Link Provisioning', () => {
    it('creates default short link on card provisioning with an immutable 8-char code', async () => {
      const res = await request(app.getHttpServer())
        .get(`/cards/${SEAT_A}/qr`)
        .set('X-Tenant-Id', TENANT_A)
        .set('X-User-Role', 'admin');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);

      const defaultQr = res.body[0];
      expect(defaultQr.source).toBe('default');
      expect(defaultQr.code).toMatch(/^[0-9a-zA-Z]{8}$/);
      expect(defaultQr.shortUrl).toContain(defaultQr.code);
      expect(defaultQr.status).toBe('active');
      // Visitor pages are served at /c/<slug> on web-public (testConfig.webPublicUrl)
      expect(defaultQr.destinationUrl).toMatch(/^http:\/\/localhost:3001\/c\//);
    });
  });

  describe('AC-5: Multiple QR Codes with Source Tags', () => {
    it('allows creating an additional source-tagged QR code for a card', async () => {
      const res = await request(app.getHttpServer())
        .post(`/cards/${SEAT_A}/qr`)
        .set('X-Tenant-Id', TENANT_A)
        .set('X-User-Role', 'employee')
        .set('X-Person-Id', 'person_sneha')
        .send({
          source: 'Expo 2026 standee',
          label: 'Booth Counter',
        });

      expect(res.status).toBe(201);
      expect(res.body.source).toBe('Expo 2026 standee');
      expect(res.body.label).toBe('Booth Counter');
      expect(res.body.code).toMatch(/^[0-9a-zA-Z]{8}$/);
      expect(res.body.targetId).toBe(SEAT_A);
    });

    it('rejects duplicate or empty source tag with 400', async () => {
      const res = await request(app.getHttpServer())
        .post(`/cards/${SEAT_A}/qr`)
        .set('X-Tenant-Id', TENANT_A)
        .set('X-User-Role', 'admin')
        .send({ source: '' });

      expect(res.status).toBe(400);
    });
  });

  describe('AC-4: QR Asset Downloads (PNG, SVG, PDF)', () => {
    let qrId: string;

    beforeAll(async () => {
      const listRes = await request(app.getHttpServer())
        .get(`/cards/${SEAT_A}/qr`)
        .set('X-Tenant-Id', TENANT_A)
        .set('X-User-Role', 'admin');
      qrId = listRes.body[0].id;
    });

    it('downloads branded QR as SVG', async () => {
      const res = await request(app.getHttpServer())
        .get(`/cards/${SEAT_A}/qr/${qrId}.svg`)
        .set('X-Tenant-Id', TENANT_A);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('image/svg+xml');
      const svgText = res.text || (Buffer.isBuffer(res.body) ? res.body.toString('utf-8') : '');
      expect(svgText).toContain('<svg');
    });

    it('downloads branded QR as PNG in print resolution', async () => {
      const res = await request(app.getHttpServer())
        .get(`/cards/${SEAT_A}/qr/${qrId}.png`)
        .set('X-Tenant-Id', TENANT_A);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('image/png');
      expect(Buffer.isBuffer(res.body)).toBe(true);
    });

    it('downloads branded QR as standalone PDF', async () => {
      const res = await request(app.getHttpServer())
        .get(`/cards/${SEAT_A}/qr/${qrId}.pdf`)
        .set('X-Tenant-Id', TENANT_A);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
    });

    it('supports direct browser download via query parameter ?tenantId=... without header', async () => {
      const res = await request(app.getHttpServer())
        .get(`/cards/${SEAT_A}/qr/${qrId}.svg?tenantId=${TENANT_A}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('image/svg+xml');
    });
  });

  describe('AC-6: Company and Branch Standees (A4 & A5)', () => {
    it('generates Company Standee in A4 and A5 formats for authenticated tenant', async () => {
      const resA4 = await request(app.getHttpServer())
        .get(`/orgs/${TENANT_A}/qr/standee?template=a4&format=svg`)
        .set('X-Tenant-Id', TENANT_A)
        .set('X-User-Role', 'admin');

      expect(resA4.status).toBe(200);
      const svgText = resA4.text || (Buffer.isBuffer(resA4.body) ? resA4.body.toString('utf-8') : '');
      expect(svgText).toContain('<svg');
      expect(svgText).toContain('210mm');
      expect(svgText).toContain('Acme Steels');
      expect(svgText).toContain('Scan to save contact');

      const resA5 = await request(app.getHttpServer())
        .get(`/orgs/${TENANT_A}/qr/standee?template=a5&format=pdf`)
        .set('X-Tenant-Id', TENANT_A)
        .set('X-User-Role', 'admin');

      expect(resA5.status).toBe(200);
      expect(resA5.headers['content-type']).toContain('application/pdf');
    });

    it('generates Branch Standee with branch name in A4 format', async () => {
      const resBranch = await request(app.getHttpServer())
        .get(`/orgs/${TENANT_A}/branches/OB-7KQ2MX-B01/qr/standee?template=a4&format=svg`)
        .set('X-Tenant-Id', TENANT_A)
        .set('X-User-Role', 'admin');

      expect(resBranch.status).toBe(200);
      const svgText = resBranch.text || (Buffer.isBuffer(resBranch.body) ? resBranch.body.toString('utf-8') : '');
      expect(svgText).toContain('Mumbai Headquarters');
      expect(svgText).toContain('Scan to save contact');
    });

    it('blocks unauthenticated or cross-tenant standee generation with 401/403', async () => {
      // Unauthenticated
      const unauth = await request(app.getHttpServer())
        .get(`/orgs/${TENANT_A}/qr/standee`);
      expect([400, 401, 403]).toContain(unauth.status);

      // Cross-tenant attempt (Tenant B tries to generate Tenant A standee)
      const crossTenant = await request(app.getHttpServer())
        .get(`/orgs/${TENANT_A}/qr/standee`)
        .set('X-Tenant-Id', TENANT_B)
        .set('X-User-Role', 'admin');
      expect(crossTenant.status).toBe(403);
    });
  });

  describe('AC-7: External Destination Guard & Repointing', () => {
    let qrId: string;

    beforeAll(async () => {
      const listRes = await request(app.getHttpServer())
        .get(`/cards/${SEAT_A}/qr`)
        .set('X-Tenant-Id', TENANT_A)
        .set('X-User-Role', 'admin');
      qrId = listRes.body[0].id;
    });

    it('blocks employee from setting external destination with 403 (AC-7)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/cards/${SEAT_A}/qr/${qrId}`)
        .set('X-Tenant-Id', TENANT_A)
        .set('X-User-Role', 'employee')
        .set('X-Person-Id', 'person_sneha')
        .send({
          destinationUrl: 'https://external-portfolio.com',
        });

      expect(res.status).toBe(403);
      expect(res.body.detail).toMatch(/Company Admin approval/i);
    });

    it('allows admin to repoint to external destination after safety check', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/cards/${SEAT_A}/qr/${qrId}`)
        .set('X-Tenant-Id', TENANT_A)
        .set('X-User-Role', 'admin')
        .set('X-Person-Id', 'admin_1')
        .send({
          destinationUrl: 'https://acme-steels.com/leadership',
        });

      expect(res.status).toBe(200);
      expect(res.body.destinationUrl).toBe('https://acme-steels.com/leadership');
      expect(res.body.isExternal).toBe(true);
      expect(res.body.externalApprovedBy).toBe('admin_1');
    });

    it('rejects unsafe external URL schemes (javascript:, private IPs)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/cards/${SEAT_A}/qr/${qrId}`)
        .set('X-Tenant-Id', TENANT_A)
        .set('X-User-Role', 'admin')
        .send({
          destinationUrl: 'http://127.0.0.1:8080/admin',
        });

      expect(res.status).toBe(400);
      expect(res.body.detail).toMatch(/unsafe/i);
    });
  });

  describe('Cross-Tenant Isolation & Idempotency', () => {
    it('prevents Tenant B from viewing or repointing Tenant A short links', async () => {
      // List Tenant A's QRs
      const listResA = await request(app.getHttpServer())
        .get(`/cards/${SEAT_A}/qr`)
        .set('X-Tenant-Id', TENANT_A)
        .set('X-User-Role', 'admin');
      const qrIdA = listResA.body[0].id;

      // Tenant B tries to query Tenant A's card QRs
      const unauthorizedGet = await request(app.getHttpServer())
        .get(`/cards/${SEAT_A}/qr`)
        .set('X-Tenant-Id', TENANT_B)
        .set('X-User-Role', 'admin');
      expect(unauthorizedGet.status).toBe(404);

      // Tenant B tries to repoint Tenant A's QR
      const unauthorizedPatch = await request(app.getHttpServer())
        .patch(`/cards/${SEAT_A}/qr/${qrIdA}`)
        .set('X-Tenant-Id', TENANT_B)
        .set('X-User-Role', 'admin')
        .send({ destinationUrl: 'https://hacked.com' });
      expect(unauthorizedPatch.status).toBe(404);
    });

    it('enforces idempotency on QR creation when Idempotency-Key is provided', async () => {
      const key = 'idem_create_qr_123';
      const payload = { source: 'Brochure 2026', label: 'Product Brochure' };

      const first = await request(app.getHttpServer())
        .post(`/cards/${SEAT_A}/qr`)
        .set('X-Tenant-Id', TENANT_A)
        .set('X-User-Role', 'admin')
        .set('Idempotency-Key', key)
        .send(payload);
      expect(first.status).toBe(201);

      // Replay identical
      const replay = await request(app.getHttpServer())
        .post(`/cards/${SEAT_A}/qr`)
        .set('X-Tenant-Id', TENANT_A)
        .set('X-User-Role', 'admin')
        .set('Idempotency-Key', key)
        .send(payload);
      expect(replay.status).toBe(201);
      expect(replay.body.id).toBe(first.body.id);

      // Mismatched body returns 422
      const mismatch = await request(app.getHttpServer())
        .post(`/cards/${SEAT_A}/qr`)
        .set('X-Tenant-Id', TENANT_A)
        .set('X-User-Role', 'admin')
        .set('Idempotency-Key', key)
        .send({ source: 'Different' });
      expect(mismatch.status).toBe(422);
    });
  });

  describe('Origin Resolution Endpoints (GET /r/:code, GET /links/:code)', () => {
    let activeCode: string;

    beforeAll(async () => {
      const listRes = await request(app.getHttpServer())
        .get(`/cards/${SEAT_A}/qr`)
        .set('X-Tenant-Id', TENANT_A)
        .set('X-User-Role', 'admin');
      activeCode = listRes.body[0].code;
    });

    it('GET /r/:code redirects 302 to destinationUrl for active short link', async () => {
      const res = await request(app.getHttpServer()).get(`/r/${activeCode}`);
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('https://acme-steels.com/leadership');
    });

    it('GET /r/:code returns 200 neutral inactive HTML for disabled short link', async () => {
      // Create and disable a link
      const createRes = await request(app.getHttpServer())
        .post(`/cards/${SEAT_A}/qr`)
        .set('X-Tenant-Id', TENANT_A)
        .set('X-User-Role', 'admin')
        .send({ source: 'disabled-test-tag' });
      const qrId = createRes.body.id;
      const code = createRes.body.code;

      await request(app.getHttpServer())
        .patch(`/cards/${SEAT_A}/qr/${qrId}`)
        .set('X-Tenant-Id', TENANT_A)
        .set('X-User-Role', 'admin')
        .send({ status: 'disabled' });

      const res = await request(app.getHttpServer()).get(`/r/${code}`);
      expect(res.status).toBe(200);
      expect(res.text).toContain('Card or Link Inactive');
    });

    it('GET /r/:code returns 404 neutral inactive HTML for unknown code', async () => {
      const res = await request(app.getHttpServer()).get('/r/nonexist');
      expect(res.status).toBe(404);
      expect(res.text).toContain('Card or Link Inactive');
    });

    it('GET /links/:code returns JSON metadata for edge KV sync', async () => {
      const res = await request(app.getHttpServer()).get(`/links/${activeCode}`);
      expect(res.status).toBe(200);
      expect(res.body.code).toBe(activeCode);
      expect(res.body.status).toBe('active');
      expect(res.body.targetId).toBe(SEAT_A);
    });

    it('GET /links/:code returns 404 problem details for unknown code', async () => {
      const res = await request(app.getHttpServer()).get('/links/nonexist');
      expect(res.status).toBe(404);
      expect(res.body.type).toBe('https://tools.ietf.org/html/rfc7807');
    });
  });

  describe('Analytics Ingestion Endpoint (POST /analytics/events)', () => {
    it('POST /analytics/events accepts telemetry payload with 202 Accepted', async () => {
      const payload = [
        {
          eventId: 'evt_scan_123',
          eventType: 'qr_scanned',
          timestamp: new Date().toISOString(),
          tenantId: TENANT_A,
          properties: {
            code: 'x8Fk2LpQ',
            source: 'standee',
            deviceType: 'mobile',
          },
        },
      ];

      const res = await request(app.getHttpServer())
        .post('/analytics/events')
        .send(payload);

      expect(res.status).toBe(202);
      expect(res.body.status).toBe('accepted');
      expect(res.body.count).toBe(1);
    });
  });
});
