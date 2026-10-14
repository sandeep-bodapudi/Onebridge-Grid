import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectMongo, MongoConnectionHandle, FakeEventBus } from '@onebridge/shared';
import { createApp } from '../src/app.js';
import { OrganizationEnvConfig } from '../src/config/env.js';
import { IdentityInternalClient } from '../src/infrastructure/identity-internal.client.js';
import { OrganizationProps } from '../src/domain/organization.js';
import { BrandKit, FieldLocks, UploadLogoResponse } from '@onebridge/api-contracts';

const TENANT_A = '01JD2XORG00000000000000001';
const TENANT_B = '01JD2XORG00000000000000002';

describe('Feature F09: Brand Kit and Field Locks Integration Tests', () => {
  let mongod: MongoMemoryServer;
  let connectionHandle: MongoConnectionHandle;
  let app: INestApplication;
  let fakeEventBus: FakeEventBus;
  let mockIdentityClient: IdentityInternalClient;

  const testConfig: OrganizationEnvConfig = {
    nodeEnv: 'test',
    port: 4004,
    appUrl: 'http://localhost:3000',
    mongoUri: '',
    identityApiUrl: 'http://localhost:4001',
    internalServiceKey: 'test-key',
  };

  const seedOrg = async (tenantId: string, plan: 'starter' | 'business' = 'business', businessId?: string) => {
    const db = connectionHandle._getInternalDb();
    const resolvedBusinessId = businessId || `OB-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const org: OrganizationProps = {
      id: tenantId,
      tenantId,
      businessId: resolvedBusinessId,
      name: `Org ${tenantId}`,
      slug: `org-${tenantId.toLowerCase()}`,
      previousSlugs: [],
      industry: 'Technology',
      size: '11-50',
      city: 'Bengaluru',
      plan,
      verifiedBadge: false,
      onboardingStartedAt: new Date().toISOString(),
      aggregateVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.collection('organizations').insertOne(org);
    return org;
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
    await db.collection('seats').deleteMany({});
    await db.collection('counters').deleteMany({});
    await db.collection('audit_logs').deleteMany({});
    fakeEventBus.calls = [];

    await seedOrg(TENANT_A, 'business', 'OB-7KQ2MX');
    await seedOrg(TENANT_B, 'business', 'OB-8XYZ99');
  });

  // ===========================================================================
  // AC-1: Brand kit: logo, brand colours (band, accent, text), cover image.
  // ===========================================================================
  describe('AC-1: Brand kit persistence', () => {
    it('persists logo, brand colours (band, accent, text), and cover image via PATCH /orgs/:id/brand', async () => {
      const payload = {
        logo: 'https://cdn.onebridge.in/logos/apex.png',
        brandColours: {
          band: '#1B2A4A',
          accent: '#F68713',
          text: '#FFFFFF',
        },
        coverImage: 'https://cdn.onebridge.in/covers/apex-hero.jpg',
      };

      const res = await request(app.getHttpServer())
        .patch(`/orgs/${TENANT_A}/brand`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send(payload);

      expect(res.status).toBe(200);
      const brandKit: BrandKit = res.body;
      expect(brandKit.logo).toBe(payload.logo);
      expect(brandKit.brandColours.band).toBe('#1B2A4A');
      expect(brandKit.brandColours.accent).toBe('#F68713');
      expect(brandKit.brandColours.text).toBe('#FFFFFF');
      expect(brandKit.coverImage).toBe(payload.coverImage);

      // Verify GET /orgs/:id/brand returns persisted brand kit
      const getRes = await request(app.getHttpServer())
        .get(`/orgs/${TENANT_A}/brand`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin');

      expect(getRes.status).toBe(200);
      expect(getRes.body.logo).toBe(payload.logo);
      expect(getRes.body.brandColours.band).toBe('#1B2A4A');
    });
  });

  // ===========================================================================
  // AC-2: Field-level locks (greyed out for employees and rejected server-side)
  // ===========================================================================
  describe('AC-2: Field-level locks', () => {
    it('admin sets field-level locks via PUT /orgs/:id/locks and retrieves them', async () => {
      const locksPayload = {
        lockedFields: ['title', 'departmentId', 'logo', 'brandColours'],
      };

      const res = await request(app.getHttpServer())
        .put(`/orgs/${TENANT_A}/locks`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send(locksPayload);

      expect(res.status).toBe(200);
      const locks: FieldLocks = res.body;
      expect(locks.lockedFields).toEqual(expect.arrayContaining(['title', 'departmentId', 'logo', 'brandColours']));

      // GET /orgs/:id/locks
      const getRes = await request(app.getHttpServer())
        .get(`/orgs/${TENANT_A}/locks`)
        .set('x-tenant-id', TENANT_A);

      expect(getRes.status).toBe(200);
      expect(getRes.body.lockedFields).toEqual(expect.arrayContaining(['title', 'departmentId']));
    });

    it('server rejects employee attempts to mutate a locked field with 403 Forbidden', async () => {
      // 1. Admin locks 'title'
      await request(app.getHttpServer())
        .put(`/orgs/${TENANT_A}/locks`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({ lockedFields: ['title'] });

      // 2. Create seat assigned to person_emp1
      const seatRes = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/seats`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({
          title: 'Staff Consultant',
          personId: 'person_emp1',
          status: 'active',
        });
      const seatId = seatRes.body.id;

      // 3. Employee attempts to update 'title'
      const patchRes = await request(app.getHttpServer())
        .patch(`/orgs/${TENANT_A}/seats/${seatId}`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'employee')
        .set('x-user-id', 'person_emp1')
        .send({ title: 'Vice President' });

      expect(patchRes.status).toBe(403);
      expect(patchRes.body.title).toBe('Forbidden');
      expect(patchRes.body.detail).toContain('locked by organization policy');
    });

    it('allows employee mutation on unlocked fields', async () => {
      // Admin locks only 'title'
      await request(app.getHttpServer())
        .put(`/orgs/${TENANT_A}/locks`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({ lockedFields: ['title'] });

      // Create seat
      const seatRes = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/seats`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({
          title: 'Support Analyst',
          personId: 'person_emp2',
          status: 'active',
        });
      const seatId = seatRes.body.id;

      // Employee updates unlocked field 'managerSeatId'
      const patchRes = await request(app.getHttpServer())
        .patch(`/orgs/${TENANT_A}/seats/${seatId}`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'employee')
        .set('x-user-id', 'person_emp2')
        .send({ managerSeatId: 'OB-7KQ2MX-E0099' });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.managerSeatId).toBe('OB-7KQ2MX-E0099');
    });
  });

  // ===========================================================================
  // AC-4: Contrast validation and auto-pick
  // ===========================================================================
  describe('AC-4: Contrast validation and auto-pick', () => {
    it('accepts readable combination (contrast ratio >= 4.5:1) without auto-pick', async () => {
      // Navy band (#1B2A4A) with White text (#FFFFFF) has contrast ~12.5:1
      const res = await request(app.getHttpServer())
        .patch(`/orgs/${TENANT_A}/brand`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({
          brandColours: {
            band: '#1B2A4A',
            accent: '#F68713',
            text: '#FFFFFF',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.brandColours.text).toBe('#FFFFFF');
    });

    it('rejects unreadable combination (< 4.5:1) when acceptAutoPick is false or omitted', async () => {
      // Bridge Orange band (#F68713) with White text (#FFFFFF) has contrast ~2.5:1 (unreadable)
      const res = await request(app.getHttpServer())
        .patch(`/orgs/${TENANT_A}/brand`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({
          brandColours: {
            band: '#F68713',
            accent: '#1B2A4A',
            text: '#FFFFFF',
          },
          acceptAutoPick: false,
        });

      expect(res.status).toBe(400);
      expect(res.body.title).toBe('Bad Request');
      expect(res.body.detail).toContain('Contrast ratio');
      expect(res.body.detail).toContain('Auto-pick recommendation');
    });

    it('auto-picks Charcoal or Warm Paper text when acceptAutoPick is true on low-contrast input', async () => {
      // Bridge Orange band (#F68713) with White text (#FFFFFF) and acceptAutoPick: true
      const res = await request(app.getHttpServer())
        .patch(`/orgs/${TENANT_A}/brand`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({
          brandColours: {
            band: '#F68713',
            accent: '#1B2A4A',
            text: '#FFFFFF',
          },
          acceptAutoPick: true,
        });

      expect(res.status).toBe(200);
      // Charcoal (#393536) on Bridge Orange achieves >= 4.5:1
      expect(res.body.brandColours.text).toBe('#393536');
    });
  });

  // ===========================================================================
  // AC-5: Logo upload: PNG, SVG, WebP, size limit, scanned, resized, S3 CDN
  // ===========================================================================
  describe('AC-5: Logo upload validation and scanning', () => {
    it('uploads valid PNG logo under size limit and returns CDN URL', async () => {
      const res = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/brand/logo`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({
          filename: 'company-logo.png',
          contentType: 'image/png',
          size: 1024 * 50, // 50 KB
          contentBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        });

      expect(res.status).toBe(200);
      const data: UploadLogoResponse = res.body;
      expect(data.url).toContain('https://cdn.onebridge.in/');
      expect(data.key).toContain(`tenants/${TENANT_A}/logos/`);
    });

    it('rejects unsupported file formats (JPEG, GIF, EXE)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/brand/logo`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({
          filename: 'logo.jpg',
          contentType: 'image/jpeg',
          size: 1024 * 50,
          contentBase64: 'dGVzdA==',
        });

      expect(res.status).toBe(400);
      expect(res.body.title).toBe('Bad Request');
      expect(res.body.detail).toContain('Allowed formats: PNG, SVG, WebP');
    });

    it('rejects files exceeding size limit (> 5 MB)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/brand/logo`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({
          filename: 'huge-logo.png',
          contentType: 'image/png',
          size: 6 * 1024 * 1024, // 6 MB
          contentBase64: 'dGVzdA==',
        });

      expect(res.status).toBe(400);
      expect(res.body.title).toBe('Bad Request');
      expect(res.body.detail).toContain('5MB');
    });

    it('rejects infected files failing virus scan with 422 Unprocessable Entity', async () => {
      const res = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/brand/logo`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({
          filename: 'malicious-eicar-logo.png',
          contentType: 'image/png',
          size: 1024 * 5,
          contentBase64: 'dGVzdA==',
        });

      expect(res.status).toBe(422);
      expect(res.body.title).toBe('Unprocessable Entity');
      expect(res.body.detail).toContain('Malware signature detected');
    });
  });

  // ===========================================================================
  // AC-6: Changes publish org.branding_updated
  // ===========================================================================
  describe('AC-6: Event emission', () => {
    it('publishes org.branding_updated on brand kit updates', async () => {
      await request(app.getHttpServer())
        .patch(`/orgs/${TENANT_A}/brand`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({
          brandColours: {
            band: '#1B2A4A',
            accent: '#F68713',
            text: '#FFFFFF',
          },
        });

      interface FakePublishCall {
        args: {
          event: {
            type: string;
            tenantId: string;
            payload: { orgId: string; businessId: string; brandKit: unknown };
          };
        };
      }
      const brandingCalls = (fakeEventBus.calls as unknown as FakePublishCall[]).filter(
        (c) => c.args?.event?.type === 'org.branding_updated'
      );
      expect(brandingCalls.length).toBeGreaterThan(0);
      expect(brandingCalls[0].args.event.payload.orgId).toBe(TENANT_A);
      expect(brandingCalls[0].args.event.payload.businessId).toBe('OB-7KQ2MX');
    });

    it('publishes org.branding_updated on field locks updates', async () => {
      await request(app.getHttpServer())
        .put(`/orgs/${TENANT_A}/locks`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({ lockedFields: ['logo'] });

      interface FakePublishCall {
        args: {
          event: {
            type: string;
            tenantId: string;
            payload: { orgId: string; fieldLocks: unknown };
          };
        };
      }
      const lockCalls = (fakeEventBus.calls as unknown as FakePublishCall[]).filter(
        (c) => c.args?.event?.type === 'org.branding_updated'
      );
      expect(lockCalls.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // Security & Isolation
  // ===========================================================================
  describe('Security and Tenancy Isolation', () => {
    it('rejects cross-tenant brand kit updates with 403 Forbidden', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/orgs/${TENANT_A}/brand`)
        .set('x-tenant-id', TENANT_B) // Tenant B caller
        .set('x-user-role', 'admin')
        .send({
          brandColours: {
            band: '#1B2A4A',
            text: '#FFFFFF',
          },
        });

      expect(res.status).toBe(403);
      expect(res.body.title).toBe('Forbidden');
    });

    it('rejects non-admin/owner callers attempting to edit brand kit with 403 Forbidden', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/orgs/${TENANT_A}/brand`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'employee') // Employee caller
        .send({
          brandColours: {
            band: '#1B2A4A',
            text: '#FFFFFF',
          },
        });

      expect(res.status).toBe(403);
      expect(res.body.title).toBe('Forbidden');
    });

    it('handles idempotency replay on PATCH /orgs/:id/brand', async () => {
      const idemKey = 'idem-brand-patch-1';
      const body = {
        brandColours: {
          band: '#1B2A4A',
          text: '#FFFFFF',
        },
      };

      const res1 = await request(app.getHttpServer())
        .patch(`/orgs/${TENANT_A}/brand`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .set('idempotency-key', idemKey)
        .send(body);

      expect(res1.status).toBe(200);

      // Replay
      const res2 = await request(app.getHttpServer())
        .patch(`/orgs/${TENANT_A}/brand`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .set('idempotency-key', idemKey)
        .send(body);

      expect(res2.status).toBe(200);
      expect(res2.body).toEqual(res1.body);

      // Mismatch returns 422
      const resMismatch = await request(app.getHttpServer())
        .patch(`/orgs/${TENANT_A}/brand`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .set('idempotency-key', idemKey)
        .send({ brandColours: { band: '#222222', text: '#FFFFFF' } });

      expect(resMismatch.status).toBe(422);
    });

    it('handles idempotency replay on POST /orgs/:id/brand/logo', async () => {
      const idemKey = 'idem-logo-upload-1';
      const body = {
        filename: 'idempotent-logo.png',
        contentType: 'image/png',
        size: 1024 * 20,
        contentBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      };

      const res1 = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/brand/logo`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .set('idempotency-key', idemKey)
        .send(body);

      expect(res1.status).toBe(200);
      expect(res1.body.url).toContain('https://cdn.onebridge.in/');

      // Replay identical request with same idempotency key
      const res2 = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/brand/logo`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .set('idempotency-key', idemKey)
        .send(body);

      expect(res2.status).toBe(200);
      expect(res2.body).toEqual(res1.body);

      // Replay with different payload returns 422
      const resMismatch = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/brand/logo`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .set('idempotency-key', idemKey)
        .send({ ...body, filename: 'different-logo.png' });

      expect(resMismatch.status).toBe(422);
    });
  });
});
