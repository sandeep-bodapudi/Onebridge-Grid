import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectMongo, MongoConnectionHandle, FakeEventBus } from '@onebridge/shared';
import { createApp } from '../src/app.js';
import { OrganizationEnvConfig } from '../src/config/env.js';
import { IdentityInternalClient } from '../src/infrastructure/identity-internal.client.js';

describe('Organization HTTP Controller Tests (supertest)', () => {
  let mongod: MongoMemoryServer;
  let connectionHandle: MongoConnectionHandle;
  let app: INestApplication;
  let fakeEventBus: FakeEventBus;
  let mockIdentityClient: IdentityInternalClient;

  const testConfig: OrganizationEnvConfig = {
    nodeEnv: 'test',
    port: 4002,
    appUrl: 'http://localhost:3000',
    mongoUri: '',
    identityApiUrl: 'http://localhost:4001',
    internalServiceKey: 'test-key',
  };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    testConfig.mongoUri = mongod.getUri();
    connectionHandle = await connectMongo(mongod.getUri());

    fakeEventBus = new FakeEventBus();
    mockIdentityClient = {
      createMembership: vi.fn().mockResolvedValue({ id: 'mem_1', role: 'owner' }),
    };

    app = await createApp({
      envConfig: testConfig,
      connectionHandle,
      identityClient: mockIdentityClient,
      eventBus: fakeEventBus,
    });
    await app.init();
  }, 120000);

  afterAll(async () => {
    if (app) await app.close();
    if (connectionHandle) await connectionHandle.close();
    if (mongod) await mongod.stop();
  });

  beforeEach(async () => {
    const db = connectionHandle._getInternalDb();
    await db.collection('organizations').deleteMany({});
    await db.collection('issued_id_registries').deleteMany({});
    fakeEventBus.calls = [];
    vi.clearAllMocks();
    mockIdentityClient.createMembership = vi.fn().mockResolvedValue({ id: 'mem_1', role: 'owner' });
  });

  describe('POST /orgs (AC-1, AC-2, AC-6, Rule 11 & 12)', () => {
    it('creates organization, returns 201 with Location header, mints IDs, and notifies Identity', async () => {
      const res = await request(app.getHttpServer())
        .post('/orgs')
        .send({
          name: 'HyperScale Technologies',
          legalName: 'HyperScale Technologies Private Limited',
          industry: 'IT & Software',
          size: '11-50',
          city: 'Hyderabad',
          creatorPersonId: 'person_alpha_1',
          gstin: '36ABCDE1234F1Z5',
        })
        .expect(201);

      expect(res.header.location).toBe(`/orgs/${res.body.id}`);
      expect(res.body.id).toBeDefined();
      expect(res.body.id.length).toBe(26);
      expect(res.body.businessId).toMatch(/^OB-[0-9A-HJKMNP-TV-Z]{6}$/);
      expect(res.body.name).toBe('HyperScale Technologies');
      expect(res.body.slug).toBe('hyperscale-technologies');
      expect(res.body.gstin).toBe('36ABCDE1234F1Z5');
      expect(res.body.verifiedBadge).toBe(false);

      expect(mockIdentityClient.createMembership).toHaveBeenCalledWith(
        expect.objectContaining({
          personId: 'person_alpha_1',
          orgId: res.body.id,
          role: 'owner',
        })
      );
    });

    it('returns 400 Bad Request if creatorPersonId and X-User-Id are absent (Rule 11)', async () => {
      const res = await request(app.getHttpServer())
        .post('/orgs')
        .send({
          name: 'Ownerless Corp',
          industry: 'IT',
          size: '1-10',
          city: 'Delhi',
          // no creatorPersonId, no x-user-id
        })
        .expect(400);

      expect(res.body.detail || res.body.title).toMatch(/creatorPersonId or X-User-Id is required/i);
    });

    it('returns 400 Bad Request on missing required fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/orgs')
        .send({
          name: 'Incomplete Org',
          creatorPersonId: 'person_1',
        })
        .expect(400);

      expect(res.body.detail || res.body.title).toBeDefined();
    });

    it('returns 400 Bad Request on invalid GSTIN format', async () => {
      const res = await request(app.getHttpServer())
        .post('/orgs')
        .send({
          name: 'Bad GSTIN Org',
          industry: 'Retail',
          size: '1-10',
          city: 'Delhi',
          creatorPersonId: 'person_1',
          gstin: 'INVALIDGSTIN123',
        })
        .expect(400);

      expect(res.body.detail || res.body.title).toMatch(/Invalid GSTIN format|GSTIN must be/i);
    });

    it('returns 409 Conflict when slug is already taken', async () => {
      await request(app.getHttpServer())
        .post('/orgs')
        .send({
          name: 'Acme Corp',
          slug: 'acme-unique',
          industry: 'IT',
          size: '1-10',
          city: 'Pune',
          creatorPersonId: 'person_1',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/orgs')
        .send({
          name: 'Acme Duplicate',
          slug: 'acme-unique',
          industry: 'IT',
          size: '1-10',
          city: 'Pune',
          creatorPersonId: 'person_2',
        })
        .expect(409);

      expect(res.body.detail || res.body.title).toMatch(/already taken/i);
    });

    it('returns 503 Service Unavailable if Identity synchronous membership call fails', async () => {
      mockIdentityClient.createMembership = vi.fn().mockRejectedValue(new Error('Connection refused'));

      await request(app.getHttpServer())
        .post('/orgs')
        .send({
          name: 'Unreachable Identity Org',
          industry: 'Logistics',
          size: '1-10',
          city: 'Chennai',
          creatorPersonId: 'person_fail',
        })
        .expect(503);
    });

    it('replays cached response when called with identical Idempotency-Key (Rule 12)', async () => {
      const payload = {
        name: 'Idempotent Corp',
        industry: 'Fintech',
        size: '11-50',
        city: 'Mumbai',
        creatorPersonId: 'person_idem_1',
      };

      const res1 = await request(app.getHttpServer())
        .post('/orgs')
        .set('idempotency-key', 'key-test-idem-001')
        .send(payload)
        .expect(201);

      const res2 = await request(app.getHttpServer())
        .post('/orgs')
        .set('idempotency-key', 'key-test-idem-001')
        .send(payload)
        .expect(201);

      expect(res2.body.id).toBe(res1.body.id);
      expect(res2.body.businessId).toBe(res1.body.businessId);
    });

    it('returns 422 Unprocessable Entity when Idempotency-Key is reused with different payload (Rule 12)', async () => {
      const payload1 = {
        name: 'Initial Name Corp',
        industry: 'Fintech',
        size: '11-50',
        city: 'Mumbai',
        creatorPersonId: 'person_idem_2',
      };

      await request(app.getHttpServer())
        .post('/orgs')
        .set('idempotency-key', 'key-mismatch-001')
        .send(payload1)
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/orgs')
        .set('idempotency-key', 'key-mismatch-001')
        .send({ ...payload1, name: 'Changed Name Diverged' })
        .expect(422);

      expect(res.body.detail || res.body.title).toMatch(/Mismatching request body/i);
    });
  });

  describe('GET /orgs/:id (AC-3, Server-side Authorization & Isolation)', () => {
    it('returns organization details when caller tenant matches id', async () => {
      const created = await request(app.getHttpServer())
        .post('/orgs')
        .send({
          name: 'Target Company',
          industry: 'Manufacturing',
          size: '51-200',
          city: 'Ahmedabad',
          creatorPersonId: 'person_target',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/orgs/${created.body.id}`)
        .set('x-tenant-id', created.body.id)
        .expect(200);

      expect(res.body.id).toBe(created.body.id);
      expect(res.body.name).toBe('Target Company');
    });

    it('returns 403 Forbidden when caller omits x-tenant-id entirely (Rule 2)', async () => {
      const created = await request(app.getHttpServer())
        .post('/orgs')
        .send({
          name: 'Protected Company',
          industry: 'Manufacturing',
          size: '1-10',
          city: 'Jaipur',
          creatorPersonId: 'person_target',
        })
        .expect(201);

      // Caller sends NO authentication headers
      await request(app.getHttpServer())
        .get(`/orgs/${created.body.id}`)
        .expect(403);
    });

    it('returns 403 Forbidden when caller tenant does not match target id', async () => {
      const created = await request(app.getHttpServer())
        .post('/orgs')
        .send({
          name: 'Private Company',
          industry: 'Manufacturing',
          size: '51-200',
          city: 'Ahmedabad',
          creatorPersonId: 'person_target',
        })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/orgs/${created.body.id}`)
        .set('x-tenant-id', '01JACTENANTOTHER0000000000') // Different tenant
        .expect(403);
    });
  });

  describe('PATCH /orgs/:id (AC-3, AC-4, AC-6, Role Scope & Idempotency)', () => {
    it('updates profile and emits org.branding_updated with request correlationId', async () => {
      const created = await request(app.getHttpServer())
        .post('/orgs')
        .send({
          name: 'Brand Updates Corp',
          industry: 'IT',
          size: '11-50',
          city: 'Bengaluru',
          creatorPersonId: 'person_owner',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch(`/orgs/${created.body.id}`)
        .set('x-tenant-id', created.body.id)
        .set('x-user-role', 'owner')
        .set('x-correlation-id', 'corr-brand-test-123')
        .send({
          brandColours: { primary: '#1B2A4A', secondary: '#F68713' },
          logo: 'https://cdn.onebridge.in/logos/acme.svg',
          about: 'Transformed digital infrastructure',
        })
        .expect(200);

      expect(res.body.brandColours.primary).toBe('#1B2A4A');
      expect(res.body.logo).toBe('https://cdn.onebridge.in/logos/acme.svg');
      expect(res.body.about).toBe('Transformed digital infrastructure');

      // Assert org.branding_updated event carries correlationId
      const brandingEvent = fakeEventBus.calls.find((c) => {
        const args = c.args as { event?: { type?: string } } | undefined;
        return args?.event?.type === 'org.branding_updated';
      });
      expect(brandingEvent).toBeDefined();
      const eventObj = (brandingEvent?.args as { event?: { correlationId?: string } } | undefined)?.event;
      expect(eventObj?.correlationId).toBe('corr-brand-test-123');
    });

    it('returns 403 Forbidden when caller omits x-tenant-id (Rule 2)', async () => {
      const created = await request(app.getHttpServer())
        .post('/orgs')
        .send({
          name: 'Lockdown Corp',
          industry: 'IT',
          size: '1-10',
          city: 'Delhi',
          creatorPersonId: 'person_owner',
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/orgs/${created.body.id}`)
        .set('x-user-role', 'owner')
        // omitted x-tenant-id
        .send({ name: 'Hacked Name' })
        .expect(403);
    });

    it('returns 403 Forbidden when caller omits x-user-role or is not owner/admin', async () => {
      const created = await request(app.getHttpServer())
        .post('/orgs')
        .send({
          name: 'RBAC Corp',
          industry: 'IT',
          size: '1-10',
          city: 'Bengaluru',
          creatorPersonId: 'person_owner',
        })
        .expect(201);

      // Missing role header entirely
      await request(app.getHttpServer())
        .patch(`/orgs/${created.body.id}`)
        .set('x-tenant-id', created.body.id)
        .send({ name: 'Hacked Name' })
        .expect(403);

      // Role is employee
      await request(app.getHttpServer())
        .patch(`/orgs/${created.body.id}`)
        .set('x-tenant-id', created.body.id)
        .set('x-user-role', 'employee')
        .send({ name: 'Hacked Name' })
        .expect(403);
    });
  });

  describe('POST /orgs/:id/first-card (AC-7 Target Metric Tracking)', () => {
    it('records first card publication timestamp and returns updated org', async () => {
      const created = await request(app.getHttpServer())
        .post('/orgs')
        .send({
          name: 'Speedy Publishing Corp',
          industry: 'Logistics',
          size: '1-10',
          city: 'Kolkata',
          creatorPersonId: 'person_speed',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post(`/orgs/${created.body.id}/first-card`)
        .set('x-tenant-id', created.body.id)
        .expect(200);

      expect(res.body.firstCardCreatedAt).toBeDefined();
      expect(typeof res.body.timeToFirstCardSeconds).toBe('number');
      expect(res.body.timeToFirstCardSeconds).toBeGreaterThanOrEqual(0);
    });

    it('returns 403 Forbidden without x-tenant-id or with cross-tenant ID', async () => {
      const created = await request(app.getHttpServer())
        .post('/orgs')
        .send({
          name: 'Secured Corp',
          industry: 'Logistics',
          size: '1-10',
          city: 'Kolkata',
          creatorPersonId: 'person_speed',
        })
        .expect(201);

      // Missing x-tenant-id
      await request(app.getHttpServer())
        .post(`/orgs/${created.body.id}/first-card`)
        .expect(403);

      // Wrong tenant id
      await request(app.getHttpServer())
        .post(`/orgs/${created.body.id}/first-card`)
        .set('x-tenant-id', '01JACTENANTOTHER0000000000')
        .expect(403);
    });
  });

  describe('GET /orgs/by-slug/:slug (AC-6 Slug Resolution & Permanent 301 Redirect)', () => {
    it('returns 200 for current active slug', async () => {
      await request(app.getHttpServer())
        .post('/orgs')
        .send({
          name: 'Direct Match Corp',
          slug: 'direct-match',
          industry: 'IT',
          size: '1-10',
          city: 'Noida',
          creatorPersonId: 'person_owner',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/orgs/by-slug/direct-match')
        .expect(200);

      expect(res.body.slug).toBe('direct-match');
      expect(res.body.name).toBe('Direct Match Corp');
    });

    it('returns 301 Moved Permanently with Location header when queried with a previous slug', async () => {
      const created = await request(app.getHttpServer())
        .post('/orgs')
        .send({
          name: 'Rebrand Corp',
          slug: 'old-brand-slug',
          industry: 'IT',
          size: '1-10',
          city: 'Noida',
          creatorPersonId: 'person_owner',
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/orgs/${created.body.id}`)
        .set('x-tenant-id', created.body.id)
        .set('x-user-role', 'owner')
        .send({ slug: 'new-brand-slug' })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get('/orgs/by-slug/old-brand-slug')
        .expect(301);

      expect(res.header.location).toBe('/orgs/by-slug/new-brand-slug');
    });

    it('returns 404 for an unknown slug', async () => {
      await request(app.getHttpServer())
        .get('/orgs/by-slug/non-existent-slug-123')
        .expect(404);
    });
  });
});
