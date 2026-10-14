import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectMongo, MongoConnectionHandle, FakeEventBus } from '@onebridge/shared';
import { createApp } from '../src/app.js';
import { OrganizationEnvConfig } from '../src/config/env.js';
import { IdentityInternalClient } from '../src/infrastructure/identity-internal.client.js';
import { OrganizationProps } from '../src/domain/organization.js';
import { MongoAuditRepository } from '../src/infrastructure/mongo-audit.repository.js';
import { MongoOrganizationRepository } from '../src/infrastructure/mongo-organization.repository.js';
import { AuditLogService } from '../src/application/audit-log.service.js';

const TENANT_A = '01JD2XORG00000000000000001';
const TENANT_B = '01JD2XORG00000000000000002';
const PERSON_OWNER = '01JD2XPER00000000000000001';
const PERSON_ADMIN = '01JD2XPER00000000000000002';
const PERSON_EMPLOYEE = '01JD2XPER00000000000000003';

describe('Feature F04: Audit Log Integration Tests', () => {
  let mongod: MongoMemoryServer;
  let connectionHandle: MongoConnectionHandle;
  let app: INestApplication;
  let fakeEventBus: FakeEventBus;
  let mockIdentityClient: IdentityInternalClient;
  let auditRepo: MongoAuditRepository;
  let auditService: AuditLogService;

  const testConfig: OrganizationEnvConfig = {
    nodeEnv: 'test',
    port: 4005,
    appUrl: 'http://localhost:3000',
    mongoUri: '',
    identityApiUrl: 'http://localhost:4001',
    internalServiceKey: 'test-key',
  };

  const seedOrg = async (tenantId: string, plan: 'starter' | 'business' = 'business') => {
    const db = connectionHandle._getInternalDb();
    const org: OrganizationProps = {
      id: tenantId,
      tenantId,
      businessId: `OB-${tenantId.substring(tenantId.length - 6)}`,
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
      createInitialMembership: async () => {},
      updateOrganizationStatus: async () => {},
    };

    app = await createApp({
      envConfig: testConfig,
      connectionHandle,
      identityClient: mockIdentityClient,
      eventBus: fakeEventBus,
    });
    await app.init();

    auditRepo = new MongoAuditRepository(connectionHandle);
    await auditRepo.createIndexes();

    const orgRepo = new MongoOrganizationRepository(connectionHandle);
    auditService = new AuditLogService(auditRepo, orgRepo, fakeEventBus);
  }, 120000);

  afterAll(async () => {
    if (app) await app.close();
    if (connectionHandle) await connectionHandle.close();
    if (mongod) await mongod.stop();
  });

  beforeEach(async () => {
    const db = connectionHandle._getInternalDb();
    await db.collection('organizations').deleteMany({});
    await db.collection('audit_logs').deleteMany({});
    fakeEventBus.calls = [];

    await seedOrg(TENANT_A, 'business');
    await seedOrg(TENANT_B, 'starter');
  });

  describe('AC-1: Every admin action writes an entry (actor, action, entity, before, after, timestamp, IP)', () => {
    it('records an audit entry with all required fields and publishes audit.recorded event', async () => {
      const entry = await auditService.recordAudit(
        TENANT_A,
        {
          actor: PERSON_ADMIN,
          action: 'dept.created',
          entityType: 'department',
          entityId: '01JD2XDEP00000000000000001',
          before: undefined,
          after: { name: 'Engineering', code: 'ENG' },
          ip: '192.168.1.10',
        },
        'corr-123'
      );

      expect(entry.id).toBeDefined();
      expect(entry.tenantId).toBe(TENANT_A);
      expect(entry.actor).toBe(PERSON_ADMIN);
      expect(entry.action).toBe('dept.created');
      expect(entry.entityType).toBe('department');
      expect(entry.entityId).toBe('01JD2XDEP00000000000000001');
      expect(entry.ip).toBe('192.168.1.10');
      expect(entry.after).toEqual({ name: 'Engineering', code: 'ENG' });
      expect(entry.occurredAt).toBeDefined();

      interface DomainEventLike {
        type: string;
        tenantId?: string;
        correlationId?: string;
        payload?: Record<string, unknown>;
      }
      const events = fakeEventBus.calls
        .filter((c) => c.name === 'publish')
        .map((c) => (c.args as { event?: DomainEventLike }).event);
      const auditEvent = events.find((e) => e?.type === 'audit.recorded');
      expect(auditEvent).toBeDefined();
      expect(auditEvent?.tenantId).toBe(TENANT_A);
      expect(auditEvent?.correlationId).toBe('corr-123');
      expect(auditEvent?.payload?.actor).toBe(PERSON_ADMIN);
      expect(auditEvent?.payload?.action).toBe('dept.created');
      expect(auditEvent?.payload?.ip).toBe('192.168.1.10');
    });

    it('defaults client IP to 127.0.0.1 when not provided', async () => {
      const entry = await auditService.recordAudit(TENANT_A, {
        actor: PERSON_OWNER,
        action: 'branch.created',
        entityType: 'branch',
        entityId: '01JD2XBR000000000000000001',
      });

      expect(entry.ip).toBe('127.0.0.1');
    });
  });

  describe('AC-2: Append-only integrity', () => {
    it('prohibits update operations on MongoAuditRepository', async () => {
      await expect(auditRepo.updateOne()).rejects.toThrow(/append-only/i);
      await expect(auditRepo.updateMany()).rejects.toThrow(/append-only/i);
      await expect(auditRepo.findOneAndUpdate()).rejects.toThrow(/append-only/i);
      await expect(auditRepo.replaceOne()).rejects.toThrow(/append-only/i);
    });

    it('prohibits direct delete operations on MongoAuditRepository', async () => {
      await expect(auditRepo.deleteOne()).rejects.toThrow(/append-only/i);
      await expect(auditRepo.deleteMany()).rejects.toThrow(/append-only/i);
    });
  });

  describe('AC-3: Filter by actor, action, entity, date and CSV Export', () => {
    beforeEach(async () => {
      // Seed a sequence of audit logs in TENANT_A
      await auditService.recordAudit(TENANT_A, {
        actor: PERSON_ADMIN,
        action: 'branch.created',
        entityType: 'branch',
        entityId: 'BR-001',
        after: { name: 'HQ' },
        occurredAt: '2026-10-01T10:00:00.000Z',
      });

      await auditService.recordAudit(TENANT_A, {
        actor: PERSON_OWNER,
        action: 'branch.updated',
        entityType: 'branch',
        entityId: 'BR-001',
        before: { name: 'HQ' },
        after: { name: 'Headquarters' },
        occurredAt: '2026-10-05T12:00:00.000Z',
      });

      await auditService.recordAudit(TENANT_A, {
        actor: PERSON_ADMIN,
        action: 'seat.assigned',
        entityType: 'seat',
        entityId: 'SEAT-001',
        after: { personId: PERSON_EMPLOYEE },
        occurredAt: '2026-10-10T15:00:00.000Z',
      });

      // And one in TENANT_B
      await auditService.recordAudit(TENANT_B, {
        actor: 'TENANT_B_ADMIN',
        action: 'branch.created',
        entityType: 'branch',
        entityId: 'BR-B-001',
        occurredAt: '2026-10-10T16:00:00.000Z',
      });
    });

    it('filters by actor via GET /orgs/:id/audit', async () => {
      const res = await request(app.getHttpServer())
        .get(`/orgs/${TENANT_A}/audit?actor=${PERSON_OWNER}`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin');

      expect(res.status).toBe(200);
      expect(res.body.entries).toHaveLength(1);
      expect(res.body.entries[0].action).toBe('branch.updated');
      expect(res.body.total).toBe(1);
    });

    it('filters by action', async () => {
      const res = await request(app.getHttpServer())
        .get(`/orgs/${TENANT_A}/audit?action=branch.created`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'owner');

      expect(res.status).toBe(200);
      expect(res.body.entries).toHaveLength(1);
      expect(res.body.entries[0].action).toBe('branch.created');
    });

    it('filters by entity ID or type', async () => {
      const res = await request(app.getHttpServer())
        .get(`/orgs/${TENANT_A}/audit?entity=BR-001`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin');

      expect(res.status).toBe(200);
      expect(res.body.entries).toHaveLength(2);
    });

    it('filters by date range', async () => {
      const res = await request(app.getHttpServer())
        .get(
          `/orgs/${TENANT_A}/audit?startDate=2026-10-04T00:00:00.000Z&endDate=2026-10-06T00:00:00.000Z`
        )
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'owner');

      expect(res.status).toBe(200);
      expect(res.body.entries).toHaveLength(1);
      expect(res.body.entries[0].action).toBe('branch.updated');
    });

    it('denies access to non-admin roles (403 Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/orgs/${TENANT_A}/audit`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'employee');

      expect(res.status).toBe(403);
      expect(res.body.type).toBe('https://tools.ietf.org/html/rfc7807');
    });

    it('enforces cross-tenant isolation: Tenant B cannot query Tenant A', async () => {
      const res = await request(app.getHttpServer())
        .get(`/orgs/${TENANT_A}/audit`)
        .set('x-tenant-id', TENANT_B)
        .set('x-user-role', 'owner');

      expect(res.status).toBe(403);
    });

    it('exports audit logs to CSV via GET /orgs/:id/audit:export', async () => {
      const res = await request(app.getHttpServer())
        .get(`/orgs/${TENANT_A}/audit:export`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'owner');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain(`audit-logs-${TENANT_A}.csv`);

      const lines = res.text.split('\r\n');
      expect(lines[0]).toBe('ID,Timestamp,Actor,Action,Entity Type,Entity ID,IP Address,Before,After');
      expect(lines.length).toBeGreaterThanOrEqual(4); // Header + 3 entries
    });

    it('exports audit logs to CSV via route alias /orgs/:id/audit/export', async () => {
      const res = await request(app.getHttpServer())
        .get(`/orgs/${TENANT_A}/audit/export?action=branch.created`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      const lines = res.text.split('\r\n');
      expect(lines[0]).toBe('ID,Timestamp,Actor,Action,Entity Type,Entity ID,IP Address,Before,After');
      expect(lines).toHaveLength(2); // Header + 1 matched entry
    });
  });

  describe('AC-4: Retention by plan (Starter 90 days, Business 1 year, Enterprise 2 years)', () => {
    it('restricts Starter plan queries from fetching records older than 90 days', async () => {
      const now = new Date();
      const withinRetention = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const expiredDate = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000).toISOString();

      await auditService.recordAudit(TENANT_B, {
        actor: 'ADMIN_B',
        action: 'recent.action',
        entityType: 'test',
        entityId: 'T1',
        occurredAt: withinRetention,
      });

      await auditService.recordAudit(TENANT_B, {
        actor: 'ADMIN_B',
        action: 'expired.action',
        entityType: 'test',
        entityId: 'T2',
        occurredAt: expiredDate,
      });

      const res = await request(app.getHttpServer())
        .get(`/orgs/${TENANT_B}/audit`)
        .set('x-tenant-id', TENANT_B)
        .set('x-user-role', 'owner');

      expect(res.status).toBe(200);
      const actions = (res.body.entries as Array<{ action: string }>).map((e) => e.action);
      expect(actions).toContain('recent.action');
      expect(actions).not.toContain('expired.action');
    });

    it('purges only expired records for the designated tenant during maintenance purge', async () => {
      const now = new Date();
      const expiredDate = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000).toISOString();
      const freshDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();

      await auditService.recordAudit(TENANT_B, {
        actor: 'ADMIN_B',
        action: 'old.action',
        entityType: 'test',
        entityId: 'OLD',
        occurredAt: expiredDate,
      });

      await auditService.recordAudit(TENANT_B, {
        actor: 'ADMIN_B',
        action: 'fresh.action',
        entityType: 'test',
        entityId: 'FRESH',
        occurredAt: freshDate,
      });

      const purgeResult = await auditService.purgeByPlanRetention(TENANT_B, 'starter');
      expect(purgeResult.deletedCount).toBeGreaterThanOrEqual(1);

      // Verify fresh record remains in database
      const db = connectionHandle._getInternalDb();
      const remaining = await db.collection('audit_logs').find({ tenantId: TENANT_B }).toArray();
      const remainingActions = remaining.map((r: { action?: unknown }) => r.action);
      expect(remainingActions).toContain('fresh.action');
      expect(remainingActions).not.toContain('old.action');
    });
  });

  describe('AC-5: Passwords, tokens and OTPs never appear in before/after', () => {
    it('automatically redacts passwords, tokens, hashes, and OTPs in before/after payload', async () => {
      const sensitiveBefore = {
        username: 'alice',
        password: 'PlainSecretPassword123!',
        authToken: 'jwt.token.secret',
        nested: {
          refreshToken: 'refresh-xyz',
          otpCode: '123456',
          apiKey: 'key_live_9999',
        },
        regularField: 'keep_this_safe_value',
      };

      const sensitiveAfter = {
        username: 'alice_updated',
        passwordHash: '$2b$12$e8r0.unreadablehash',
        secretCode: '445566',
        items: [{ token: 'nested-token' }, { note: 'safe note' }],
      };

      const entry = await auditService.recordAudit(TENANT_A, {
        actor: PERSON_ADMIN,
        action: 'user.security_update',
        entityType: 'person',
        entityId: 'PERSON_123',
        before: sensitiveBefore,
        after: sensitiveAfter,
      });

      expect(entry.before?.username).toBe('alice');
      expect(entry.before?.regularField).toBe('keep_this_safe_value');
      expect(entry.before?.password).toBe('[REDACTED]');
      const beforeNested = entry.before?.nested as Record<string, unknown>;
      expect(beforeNested.refreshToken).toBe('[REDACTED]');
      expect(beforeNested.otpCode).toBe('[REDACTED]');
      expect(beforeNested.apiKey).toBe('[REDACTED]');

      expect(entry.after?.username).toBe('alice_updated');
      expect(entry.after?.passwordHash).toBe('[REDACTED]');
      expect(entry.after?.secretCode).toBe('[REDACTED]');
      const afterItems = entry.after?.items as Array<Record<string, unknown>>;
      expect(afterItems[0]?.token).toBe('[REDACTED]');
      expect(afterItems[1]?.note).toBe('safe note');

      // Check database persistence directly to ensure no leakage at rest
      const db = connectionHandle._getInternalDb();
      const stored = await db.collection('audit_logs').findOne({ id: entry.id });
      expect(stored?.before.password).toBe('[REDACTED]');
      expect(stored?.after.passwordHash).toBe('[REDACTED]');
      expect(JSON.stringify(stored)).not.toContain('PlainSecretPassword123!');
      expect(JSON.stringify(stored)).not.toContain('jwt.token.secret');
      expect(JSON.stringify(stored)).not.toContain('123456');

      // Also verify via GET endpoint and CSV export
      const csvRes = await request(app.getHttpServer())
        .get(`/orgs/${TENANT_A}/audit:export?action=user.security_update`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin');

      expect(csvRes.status).toBe(200);
      expect(csvRes.text).toContain('[REDACTED]');
      expect(csvRes.text).not.toContain('PlainSecretPassword123!');
      expect(csvRes.text).not.toContain('jwt.token.secret');
      expect(csvRes.text).not.toContain('123456');
    });
  });
});
