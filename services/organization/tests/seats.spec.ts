import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectMongo, MongoConnectionHandle, FakeEventBus } from '@onebridge/shared';
import { createApp } from '../src/app.js';
import { OrganizationEnvConfig } from '../src/config/env.js';
import { IdentityInternalClient } from '../src/infrastructure/identity-internal.client.js';
import { OrganizationProps } from '../src/domain/organization.js';
import type { Seat, PaginatedSeats } from '@onebridge/api-contracts';

describe('F08: Seats and People API (supertest & isolation)', () => {
  let mongod: MongoMemoryServer;
  let connectionHandle: MongoConnectionHandle;
  let app: INestApplication;
  let fakeEventBus: FakeEventBus;
  let mockIdentityClient: IdentityInternalClient;

  const TENANT_A = '01JACTENANTA00000000000000';
  const TENANT_B = '01JACTENANTB00000000000000';

  const testConfig: OrganizationEnvConfig = {
    nodeEnv: 'test',
    port: 4004,
    appUrl: 'http://localhost:3000',
    mongoUri: '',
    identityApiUrl: 'http://localhost:4001',
    internalServiceKey: 'test-key',
  };

  const seedOrg = async (tenantId: string, plan: 'starter' | 'business' = 'starter', businessId?: string) => {
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
    await db.collection('branches').deleteMany({});
    await db.collection('departments').deleteMany({});
    await db.collection('teams').deleteMany({});
    await db.collection('seats').deleteMany({});
    await db.collection('counters').deleteMany({});
    await db.collection('audit_logs').deleteMany({});
    fakeEventBus.calls = [];
  });

  // ===========================================================================
  // AC-1: A seat holds title, branch, department, team, manager, status and bindings.
  // ===========================================================================
  describe('AC-1: Seat attributes and bindings', () => {
    it('creates a seat with title, branch, department, team, manager, status, and card/QR/chip bindings', async () => {
      await seedOrg(TENANT_A, 'business', 'OB-7KQ2MX');

      const createRes = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/seats`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({
          title: 'Senior Account Executive',
          branchId: 'OB-7KQ2MX-B01',
          departmentId: 'OB-7KQ2MX-D01',
          teamId: '01JACTEAM00000000000000001',
          managerSeatId: 'OB-7KQ2MX-E0000',
          personId: 'person_vikram',
          status: 'active',
          cardBinding: {
            cardId: 'card_vikram_01',
            cardUrl: 'https://onebridge.in/vikram',
            qrCodeUrl: 'https://onebridge.in/qr/vikram',
            nfcChipId: 'nfc_tag_98765',
          },
        });

      expect(createRes.status).toBe(201);
      const seat: Seat = createRes.body;
      expect(seat.id).toBe('OB-7KQ2MX-E0001');
      expect(seat.tenantId).toBe(TENANT_A);
      expect(seat.title).toBe('Senior Account Executive');
      expect(seat.branchId).toBe('OB-7KQ2MX-B01');
      expect(seat.departmentId).toBe('OB-7KQ2MX-D01');
      expect(seat.teamId).toBe('01JACTEAM00000000000000001');
      expect(seat.managerSeatId).toBe('OB-7KQ2MX-E0000');
      expect(seat.personId).toBe('person_vikram');
      expect(seat.status).toBe('active');
      expect(seat.isReadOnly).toBe(false);
      expect(seat.cardBinding?.cardId).toBe('card_vikram_01');
      expect(seat.cardBinding?.cardUrl).toBe('https://onebridge.in/vikram');
      expect(seat.cardBinding?.qrCodeUrl).toBe('https://onebridge.in/qr/vikram');
      expect(seat.cardBinding?.nfcChipId).toBe('nfc_tag_98765');

      // Check single retrieval
      const getRes = await request(app.getHttpServer())
        .get(`/orgs/${TENANT_A}/seats/${seat.id}`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin');
      expect(getRes.status).toBe(200);
      expect(getRes.body.title).toBe('Senior Account Executive');
    });

    it('rejects seat creation if title is empty', async () => {
      await seedOrg(TENANT_A, 'business', 'OB-7KQ2MX');

      const res = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/seats`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({
          title: '',
        });

      expect(res.status).toBe(400);
      expect(res.body.title).toBe('Bad Request');
    });
  });

  // ===========================================================================
  // AC-2: Reassigning a seat keeps card URL, QR, NFC binding, analytics & leads.
  // ===========================================================================
  describe('AC-2: Seat reassignment preserves bindings and history', () => {
    it('reassigning a seat to another person strictly preserves card URL, QR, NFC chip bindings, and past leads', async () => {
      await seedOrg(TENANT_A, 'business', 'OB-7KQ2MX');

      // 1. Create seat with person_rahul
      const seatRes = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/seats`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({
          title: 'Regional Sales Manager',
          personId: 'person_rahul',
          status: 'active',
          cardBinding: {
            cardId: 'card_sales_reg_01',
            cardUrl: 'https://onebridge.in/c/OB-7KQ2MX-E0001',
            qrCodeUrl: 'https://onebridge.in/qr/OB-7KQ2MX-E0001',
            nfcChipId: 'chip_nfc_abc123',
          },
        });
      expect(seatRes.status).toBe(201);
      const seatId = seatRes.body.id;

      // 2. Reassign to person_priya
      const reassignRes = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/seats/${seatId}/assign`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({
          personId: 'person_priya',
        });

      expect(reassignRes.status).toBe(200);
      const updatedSeat: Seat = reassignRes.body;
      expect(updatedSeat.personId).toBe('person_priya');

      // Verify all bindings are strictly preserved
      expect(updatedSeat.cardBinding?.cardId).toBe('card_sales_reg_01');
      expect(updatedSeat.cardBinding?.cardUrl).toBe('https://onebridge.in/c/OB-7KQ2MX-E0001');
      expect(updatedSeat.cardBinding?.qrCodeUrl).toBe('https://onebridge.in/qr/OB-7KQ2MX-E0001');
      expect(updatedSeat.cardBinding?.nfcChipId).toBe('chip_nfc_abc123');

      // 3. Verify event emitted with bindingsPreserved: true
      interface FakePublishCall {
        args: {
          event: {
            type: string;
            tenantId: string;
            payload: { seatId: string; previousPersonId: string; personId: string; bindingsPreserved: boolean };
          };
        };
      }
      const assignCall = (fakeEventBus.calls as unknown as FakePublishCall[]).find(
        (c) => c.args?.event?.type === 'seat.assigned'
      );
      expect(assignCall).toBeDefined();
      expect(assignCall?.args.event.payload.previousPersonId).toBe('person_rahul');
      expect(assignCall?.args.event.payload.personId).toBe('person_priya');
      expect(assignCall?.args.event.payload.bindingsPreserved).toBe(true);
    });
  });

  // ===========================================================================
  // AC-3: Seat statuses: invited, active, inactive, offboarded.
  // ===========================================================================
  describe('AC-3: Seat statuses', () => {
    it('supports invited, active, inactive, and offboarded statuses and queries by status', async () => {
      await seedOrg(TENANT_A, 'business', 'OB-7KQ2MX');

      // Create seats in various statuses
      await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/seats`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({ title: 'Lead 1', status: 'invited' });

      const s2 = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/seats`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({ title: 'Lead 2', status: 'active', personId: 'p2' });

      // Update s2 to inactive
      const patchRes = await request(app.getHttpServer())
        .patch(`/orgs/${TENANT_A}/seats/${s2.body.id}`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({ status: 'inactive' });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.status).toBe('inactive');

      // Soft archive to offboarded
      const archiveRes = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/seats/${s2.body.id}/archive`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin');
      expect(archiveRes.status).toBe(200);
      expect(archiveRes.body.status).toBe('offboarded');

      // Filter by status=invited
      const invitedList = await request(app.getHttpServer())
        .get(`/orgs/${TENANT_A}/seats?status=invited`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin');
      expect(invitedList.status).toBe(200);
      expect(invitedList.body.items).toHaveLength(1);
      expect(invitedList.body.items[0].status).toBe('invited');
    });

    it('rejects invalid status with 400 Bad Request', async () => {
      await seedOrg(TENANT_A, 'business', 'OB-7KQ2MX');

      const res = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/seats`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({ title: 'Bad Seat', status: 'non_existent_status' });

      expect(res.status).toBe(400);
    });
  });

  // ===========================================================================
  // AC-4: Seat limit comes from plan. Over-limit seats become read-only, never deleted.
  // ===========================================================================
  describe('AC-4: Plan seat limits and over-limit read-only behaviour', () => {
    it('marks over-limit seats as read-only rather than deleting them, and prevents write mutations', async () => {
      // Seed Starter plan (default starter limit is 5 seats)
      await seedOrg(TENANT_A, 'starter', 'OB-7KQ2MX');

      // Create 5 seats (within limit)
      for (let i = 1; i <= 5; i++) {
        const res = await request(app.getHttpServer())
          .post(`/orgs/${TENANT_A}/seats`)
          .set('x-tenant-id', TENANT_A)
          .set('x-user-role', 'admin')
          .send({ title: `Seat ${i}` });
        expect(res.status).toBe(201);
        expect(res.body.isReadOnly).toBe(false);
      }

      // Create 6th seat (exceeds Starter limit of 5)
      const overLimitRes = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/seats`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({ title: 'Seat 6 - Over Limit' });

      expect(overLimitRes.status).toBe(201);
      expect(overLimitRes.body.isReadOnly).toBe(true);

      // Attempting to update over-limit seat throws 403 Forbidden ProblemDetails
      const patchOverLimit = await request(app.getHttpServer())
        .patch(`/orgs/${TENANT_A}/seats/${overLimitRes.body.id}`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({ title: 'Attempted Update' });

      expect(patchOverLimit.status).toBe(403);
      expect(patchOverLimit.body.title).toBe('Forbidden');
      expect(patchOverLimit.body.detail).toContain('read-only');

      // Attempting to reassign over-limit seat throws 403 Forbidden
      const assignOverLimit = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/seats/${overLimitRes.body.id}/assign`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({ personId: 'p_test' });

      expect(assignOverLimit.status).toBe(403);

      // Verify the over-limit seat is preserved in database (never deleted)
      const listRes = await request(app.getHttpServer())
        .get(`/orgs/${TENANT_A}/seats`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin');
      expect(listRes.status).toBe(200);
      expect(listRes.body.total).toBe(6);
      expect(listRes.body.items).toHaveLength(6);
    });
  });

  // ===========================================================================
  // AC-5: Seat ID format <BusinessID>-E<nnnn>
  // ===========================================================================
  describe('AC-5: Seat ID format OB-XXXXXX-Ennnn', () => {
    it('mints monotonic unique four-digit zero padded seat IDs derived from businessId', async () => {
      await seedOrg(TENANT_A, 'business', 'OB-7KQ2MX');

      const s1 = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/seats`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({ title: 'Seat Alpha' });
      expect(s1.body.id).toBe('OB-7KQ2MX-E0001');

      const s2 = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/seats`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({ title: 'Seat Beta' });
      expect(s2.body.id).toBe('OB-7KQ2MX-E0002');
    });
  });

  // ===========================================================================
  // AC-6: An admin can create a seat without a person (vacant) and assign later.
  // ===========================================================================
  describe('AC-6: Vacant seat creation and delayed assignment', () => {
    it('allows creating vacant seat without a person, and assigning a person later', async () => {
      await seedOrg(TENANT_A, 'business', 'OB-7KQ2MX');

      // Create vacant seat
      const vacantRes = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/seats`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({
          title: 'Enterprise Account Executive',
        });

      expect(vacantRes.status).toBe(201);
      const vacantSeat: Seat = vacantRes.body;
      expect(vacantSeat.personId).toBeUndefined();
      expect(vacantSeat.status).toBe('vacant');

      // Assign person later
      const assignRes = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/seats/${vacantSeat.id}/assign`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({
          personId: 'person_ananya',
        });

      expect(assignRes.status).toBe(200);
      expect(assignRes.body.personId).toBe('person_ananya');
      expect(assignRes.body.status).toBe('active');
    });
  });

  // ===========================================================================
  // Cross-Tenant Isolation & Role Authorization
  // ===========================================================================
  describe('Cross-Tenant Isolation & Role Authorization', () => {
    it('strictly forbids cross-tenant access between Tenant A and Tenant B', async () => {
      await seedOrg(TENANT_A, 'business', 'OB-7KQ2MX');
      await seedOrg(TENANT_B, 'business', 'OB-999999');

      const sA = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/seats`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({ title: 'Tenant A Seat' });
      expect(sA.status).toBe(201);

      // Tenant B tries to read Tenant A's seat
      const res = await request(app.getHttpServer())
        .get(`/orgs/${TENANT_A}/seats/${sA.body.id}`)
        .set('x-tenant-id', TENANT_B)
        .set('x-user-role', 'admin');

      expect(res.status).toBe(403);
    });

    it('rejects seat write operations from non-admin role', async () => {
      await seedOrg(TENANT_A, 'business', 'OB-7KQ2MX');

      const res = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/seats`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'member')
        .send({ title: 'Unauthorized Seat' });

      expect(res.status).toBe(403);
    });

    it('rejects write operations when x-user-role is missing', async () => {
      await seedOrg(TENANT_A, 'business', 'OB-7KQ2MX');

      const res = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/seats`)
        .set('x-tenant-id', TENANT_A)
        .send({ title: 'No Role Header' });

      expect(res.status).toBe(403);
    });
  });

  // ===========================================================================
  // Idempotency & Replay Protection (Rule 12)
  // ===========================================================================
  describe('Idempotency & Replay Protection (Rule 12)', () => {
    it('returns cached response on replayed Idempotency-Key and rejects payload mismatch with 422', async () => {
      await seedOrg(TENANT_A, 'business', 'OB-7KQ2MX');
      const idemKey = 'idem-seat-create-123';

      const payload = { title: 'Idempotent Seat' };

      const res1 = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/seats`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .set('idempotency-key', idemKey)
        .send(payload);

      expect(res1.status).toBe(201);

      // Replay with exact same payload
      const res2 = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/seats`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .set('idempotency-key', idemKey)
        .send(payload);

      expect(res2.status).toBe(201);
      expect(res2.body.id).toBe(res1.body.id);

      // Replay with mismatched payload returns 422
      const resMismatch = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/seats`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .set('idempotency-key', idemKey)
        .send({ title: 'Mismatched Title' });

      expect(resMismatch.status).toBe(422);
      expect(resMismatch.body.status).toBe(422);
    });

    it('idempotently handles PATCH /seats/:seatId with replay and 422 mismatch rejection', async () => {
      await seedOrg(TENANT_A, 'business', 'OB-7KQ2MX');
      const createRes = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/seats`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({ title: 'Initial Title' });

      const seatId = createRes.body.id;
      const idemKey = 'idem-seat-patch-456';
      const patchBody = { title: 'Updated Title' };

      const res1 = await request(app.getHttpServer())
        .patch(`/orgs/${TENANT_A}/seats/${seatId}`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .set('idempotency-key', idemKey)
        .send(patchBody);

      expect(res1.status).toBe(200);
      expect(res1.body.title).toBe('Updated Title');

      // Replay with identical body
      const res2 = await request(app.getHttpServer())
        .patch(`/orgs/${TENANT_A}/seats/${seatId}`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .set('idempotency-key', idemKey)
        .send(patchBody);

      expect(res2.status).toBe(200);
      expect(res2.body.title).toBe('Updated Title');

      // Replay with mismatched body returns 422
      const resMismatch = await request(app.getHttpServer())
        .patch(`/orgs/${TENANT_A}/seats/${seatId}`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .set('idempotency-key', idemKey)
        .send({ title: 'Different Title' });

      expect(resMismatch.status).toBe(422);
      expect(resMismatch.body.status).toBe(422);
    });

    it('idempotently handles POST /seats/:seatId/assign with replay and 422 mismatch rejection', async () => {
      await seedOrg(TENANT_A, 'business', 'OB-7KQ2MX');
      const createRes = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/seats`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({ title: 'Sales Seat' });

      const seatId = createRes.body.id;
      const idemKey = 'idem-seat-assign-789';
      const assignBody = { personId: 'person_vikram' };

      const res1 = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/seats/${seatId}/assign`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .set('idempotency-key', idemKey)
        .send(assignBody);

      expect(res1.status).toBe(200);
      expect(res1.body.personId).toBe('person_vikram');

      // Replay
      const res2 = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/seats/${seatId}/assign`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .set('idempotency-key', idemKey)
        .send(assignBody);

      expect(res2.status).toBe(200);
      expect(res2.body.personId).toBe('person_vikram');

      // Mismatch
      const resMismatch = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/seats/${seatId}/assign`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .set('idempotency-key', idemKey)
        .send({ personId: 'person_other' });

      expect(resMismatch.status).toBe(422);
      expect(resMismatch.body.status).toBe(422);
    });

    it('idempotently handles POST /seats/:seatId/archive with replay', async () => {
      await seedOrg(TENANT_A, 'business', 'OB-7KQ2MX');
      const createRes = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/seats`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({ title: 'Seat to Archive' });

      const seatId = createRes.body.id;
      const idemKey = 'idem-seat-archive-999';

      const res1 = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/seats/${seatId}/archive`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .set('idempotency-key', idemKey);

      expect(res1.status).toBe(200);
      expect(res1.body.status).toBe('offboarded');

      // Replay
      const res2 = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/seats/${seatId}/archive`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .set('idempotency-key', idemKey);

      expect(res2.status).toBe(200);
      expect(res2.body.status).toBe('offboarded');
    });
  });

  // ===========================================================================
  // Reassignment of Offboarded Seats & CardBinding Immutability
  // ===========================================================================
  describe('Reassignment of Offboarded Seats & CardBinding Immutability', () => {
    it('reactivates offboarded seat to active status when assigned to a new person and preserves bindings', async () => {
      await seedOrg(TENANT_A, 'business', 'OB-7KQ2MX');

      // Create seat with binding
      const seatRes = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/seats`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({
          title: 'Senior Engineer',
          personId: 'person_emp1',
          status: 'active',
          cardBinding: {
            cardId: 'card_eng_01',
            cardUrl: 'https://onebridge.in/c/OB-7KQ2MX-E0001',
            qrCodeUrl: 'https://onebridge.in/qr/OB-7KQ2MX-E0001',
            nfcChipId: 'chip_eng_nfc',
          },
        });
      const seatId = seatRes.body.id;

      // Offboard the seat
      const archiveRes = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/seats/${seatId}/archive`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin');
      expect(archiveRes.status).toBe(200);
      expect(archiveRes.body.status).toBe('offboarded');

      // Reassign to replacement hire
      const reassignRes = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/seats/${seatId}/assign`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({ personId: 'person_replacement' });

      expect(reassignRes.status).toBe(200);
      expect(reassignRes.body.personId).toBe('person_replacement');
      expect(reassignRes.body.status).toBe('active');
      expect(reassignRes.body.cardBinding?.cardId).toBe('card_eng_01');
      expect(reassignRes.body.cardBinding?.cardUrl).toBe('https://onebridge.in/c/OB-7KQ2MX-E0001');
      expect(reassignRes.body.cardBinding?.qrCodeUrl).toBe('https://onebridge.in/qr/OB-7KQ2MX-E0001');
      expect(reassignRes.body.cardBinding?.nfcChipId).toBe('chip_eng_nfc');
    });

    it('does not allow arbitrary cardBinding overwrite via PATCH /seats/:seatId', async () => {
      await seedOrg(TENANT_A, 'business', 'OB-7KQ2MX');

      const createRes = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/seats`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({
          title: 'Account Executive',
          cardBinding: {
            cardId: 'card_orig_01',
            cardUrl: 'https://onebridge.in/c/OB-7KQ2MX-E0001',
            qrCodeUrl: 'https://onebridge.in/qr/OB-7KQ2MX-E0001',
            nfcChipId: 'chip_orig',
          },
        });

      const seatId = createRes.body.id;

      // Attempt to overwrite cardBinding via PATCH
      const patchRes = await request(app.getHttpServer())
        .patch(`/orgs/${TENANT_A}/seats/${seatId}`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({
          title: 'Updated Title',
          cardBinding: {
            cardId: 'card_malicious_override',
            cardUrl: 'https://evil.example.com',
          },
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.title).toBe('Updated Title');
      // Original card binding must be strictly preserved
      expect(patchRes.body.cardBinding?.cardId).toBe('card_orig_01');
      expect(patchRes.body.cardBinding?.cardUrl).toBe('https://onebridge.in/c/OB-7KQ2MX-E0001');
    });
  });

  // ===========================================================================
  // List Pagination (Rule 14)
  // ===========================================================================
  describe('List Pagination (Rule 14)', () => {
    it('returns paginated seat envelope with items, total, limit, and offset', async () => {
      await seedOrg(TENANT_A, 'business', 'OB-7KQ2MX');

      for (let i = 1; i <= 5; i++) {
        await request(app.getHttpServer())
          .post(`/orgs/${TENANT_A}/seats`)
          .set('x-tenant-id', TENANT_A)
          .set('x-user-role', 'admin')
          .send({ title: `Seat Page ${i}` });
      }

      const res = await request(app.getHttpServer())
        .get(`/orgs/${TENANT_A}/seats?limit=2&offset=1`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin');

      expect(res.status).toBe(200);
      const envelope: PaginatedSeats = res.body;
      expect(envelope.total).toBe(5);
      expect(envelope.limit).toBe(2);
      expect(envelope.offset).toBe(1);
      expect(envelope.items).toHaveLength(2);
      expect(envelope.items[0].id).toBe('OB-7KQ2MX-E0002');
      expect(envelope.items[1].id).toBe('OB-7KQ2MX-E0003');
    });
  });
});
