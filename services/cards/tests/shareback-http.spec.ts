import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  connectMongo,
  MongoConnectionHandle,
  InMemoryEventBus,
  TenantContext,
  LocalKeyVaultProvider,
  InMemoryRateLimiter,
  decryptLeadPayload,
} from '@onebridge/shared';
import { createApp } from '../src/app.js';
import { CardsEnvConfig } from '../src/config/env.js';
import { FakeRevalidationNotifier } from '../src/infrastructure/revalidation-notifier.js';
import { MongoCardRepository } from '../src/infrastructure/mongo-card.repository.js';
import { MongoLeadRepository } from '../src/infrastructure/mongo-lead.repository.js';
import { MongoOrgReadModelRepository, MongoSeatReadModelRepository } from '../src/infrastructure/mongo-read-model.repositories.js';
import { FakeLeadNotifier } from '../src/domain/notifier.js';
import { BypassTurnstileValidator } from '../src/application/turnstile-validator.js';
import { Lead } from '../src/domain/lead.js';

describe('F13: Share-back and Leads HTTP API (POST /public/c/:slug/shareback)', () => {
  let mongod: MongoMemoryServer;
  let connectionHandle: MongoConnectionHandle;
  let app: INestApplication;
  let eventBus: InMemoryEventBus;
  let keyVault: LocalKeyVaultProvider;
  let rateLimiter: InMemoryRateLimiter;
  let leadNotifier: FakeLeadNotifier;
  let turnstileValidator: BypassTurnstileValidator;

  let cardRepo: MongoCardRepository;
  let leadRepo: MongoLeadRepository;
  let orgRepo: MongoOrgReadModelRepository;
  let seatRepo: MongoSeatReadModelRepository;

  const TENANT_A = '01JACTENANTA00000000000000';
  const TENANT_B = '01JACTENANTB00000000000000';

  const testConfig: CardsEnvConfig = {
    nodeEnv: 'test',
    port: 4016,
    appUrl: 'http://localhost:3000',
    mongoUri: '',
    webPublicUrl: 'http://localhost:3001',
    revalidationSigningSecret: 'test-secret-at-least-32-characters-long',
  };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    testConfig.mongoUri = mongod.getUri();
    connectionHandle = await connectMongo(mongod.getUri());

    eventBus = new InMemoryEventBus();
    keyVault = new LocalKeyVaultProvider();
    rateLimiter = new InMemoryRateLimiter();
    leadNotifier = new FakeLeadNotifier();
    turnstileValidator = new BypassTurnstileValidator(true);

    cardRepo = new MongoCardRepository(connectionHandle);
    leadRepo = new MongoLeadRepository(connectionHandle);
    orgRepo = new MongoOrgReadModelRepository(connectionHandle);
    seatRepo = new MongoSeatReadModelRepository(connectionHandle);

    app = await createApp({
      envConfig: testConfig,
      connectionHandle,
      eventBus,
      revalidationNotifier: new FakeRevalidationNotifier(),
      keyVault,
      rateLimiter,
      turnstileValidator,
      leadNotifier,
    });
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
    if (connectionHandle) await connectionHandle.close();
    if (mongod) await mongod.stop();
  });

  beforeEach(async () => {
    leadNotifier.clear();
    rateLimiter.clear();
  });

  const setupCard = async (tenantId: string, slug: string, seatId: string) => {
    return TenantContext.run(tenantId, async () => {
      await orgRepo.upsertIfNewer({
        tenantId,
        businessId: 'OB-TEST01',
        name: 'Acme Corp',
        slug: slug.split('/')[0],
        status: 'active',
        aggregateVersion: 1,
        updatedAt: new Date().toISOString(),
      });

      await seatRepo.upsertIfNewer({
        seatId,
        tenantId,
        personId: 'person-123',
        status: 'active',
        aggregateVersion: 1,
        updatedAt: new Date().toISOString(),
      });

      return cardRepo.save({
        id: seatId,
        tenantId,
        ownerType: 'seat',
        ownerId: seatId,
        slug,
        templateId: 'modern-dark',
        status: 'published',
        language: 'en',
        verifiedBadge: true,
        approvalRequired: false,
        sections: [],
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });
  };

  describe('AC-1: Form fields validation', () => {
    it('rejects missing name, phone, or unchecked consent with 400 Problem Details', async () => {
      await setupCard(TENANT_A, 'acme-corp/card-val', 'seat-val');

      // Missing name
      const res1 = await request(app.getHttpServer())
        .post('/public/c/acme-corp/card-val/shareback')
        .send({
          phone: '9876543210',
          consent: true,
        });
      expect(res1.status).toBe(400);
      expect(res1.body.type).toContain('rfc7807');

      // Missing phone
      const res2 = await request(app.getHttpServer())
        .post('/public/c/acme-corp/card-val/shareback')
        .send({
          name: 'Priya Patel',
          consent: true,
        });
      expect(res2.status).toBe(400);

      // Consent false
      const res3 = await request(app.getHttpServer())
        .post('/public/c/acme-corp/card-val/shareback')
        .send({
          name: 'Priya Patel',
          phone: '9876543210',
          consent: false,
        });
      expect(res3.status).toBe(400);

      // Invalid phone string
      const res4 = await request(app.getHttpServer())
        .post('/public/c/acme-corp/card-val/shareback')
        .send({
          name: 'Priya Patel',
          phone: '123',
          consent: true,
        });
      expect(res4.status).toBe(400);

      // Invalid email string
      const res5 = await request(app.getHttpServer())
        .post('/public/c/acme-corp/card-val/shareback')
        .send({
          name: 'Priya Patel',
          phone: '9876543210',
          email: 'not-an-email',
          consent: true,
        });
      expect(res5.status).toBe(400);
      expect(res5.body.type).toContain('rfc7807');
      expect(res5.body.detail).toContain('Valid email address is required');
    });

    it('rejects submission for non-existent or inactive card with 404 Problem Details', async () => {
      const res = await request(app.getHttpServer())
        .post('/public/c/unknown-org/unknown-card/shareback')
        .send({
          name: 'Priya Patel',
          phone: '9876543210',
          consent: true,
        });
      expect(res.status).toBe(404);
      expect(res.body.type).toContain('rfc7807');
    });
  });

  describe('AC-2, AC-3, AC-4, AC-5: Lead Creation, Encryption, Consent, and Notification', () => {
    it('creates encrypted Lead owned by seat company, records consent, notifies owner < 10s, and emits events with zero PII', async () => {
      await setupCard(TENANT_A, 'acme-corp/rahul-lead', 'seat-rahul');

      const res = await request(app.getHttpServer())
        .post('/public/c/acme-corp/rahul-lead/shareback?source=qr&sourceTag=booth-a')
        .send({
          name: 'Vikram Seth',
          phone: '9876543210',
          email: 'vikram@example.com',
          company: 'Seth Logistics',
          note: 'Please send product catalogue',
          consent: true,
          noticeVersion: 'v1.0',
        });

      expect(res.status).toBe(201);
      expect(res.body.leadId).toBeDefined();
      expect(res.body.status).toBe('created');
      expect(res.body.cardId).toBe('seat-rahul');

      // 1. Check database persistence inside TenantContext (AC-2)
      let persistedLead: Lead | null = null;
      await TenantContext.run(TENANT_A, async () => {
        persistedLead = await leadRepo.findById(res.body.leadId);
      });

      expect(persistedLead).not.toBeNull();
      expect(persistedLead?.tenantId).toBe(TENANT_A);
      expect(persistedLead?.ownerSeatId).toBe('seat-rahul');
      expect(persistedLead?.source).toBe('qr');
      expect(persistedLead?.sourceTag).toBe('booth-a');

      // 2. Consent recorded with timestamp, notice version and card (AC-3)
      expect(persistedLead?.consent.granted).toBe(true);
      expect(persistedLead?.consent.noticeVersion).toBe('v1.0');
      expect(persistedLead?.consent.cardId).toBe('seat-rahul');
      expect(new Date(persistedLead!.consent.timestamp).getTime()).toBeGreaterThan(0);

      // 3. Encrypted at rest per ADR-0002 (AC-5)
      expect(persistedLead?.encryptedPayload).toBeDefined();
      expect(persistedLead?.encryptedPayload.ciphertext).toBeDefined();
      expect(persistedLead?.encryptedPayload.iv).toBeDefined();
      expect(persistedLead?.encryptedPayload.authTag).toBeDefined();
      // Ensure raw document does NOT contain plaintext PII
      const rawDoc = await connectionHandle._getInternalDb().collection('leads').findOne({ id: res.body.leadId });
      expect(JSON.stringify(rawDoc)).not.toContain('Vikram Seth');
      expect(JSON.stringify(rawDoc)).not.toContain('vikram@example.com');
      expect(JSON.stringify(rawDoc)).not.toContain('9876543210');

      // Verify decryption works with tenant key
      const { key } = await keyVault.getTenantKey(TENANT_A);
      const decrypted = decryptLeadPayload({
        encrypted: persistedLead!.encryptedPayload,
        key,
        tenantId: TENANT_A,
        leadId: res.body.leadId,
      });
      expect(decrypted.name).toBe('Vikram Seth');
      expect(decrypted.phone).toBe('+919876543210');
      expect(decrypted.email).toBe('vikram@example.com');
      expect(decrypted.company).toBe('Seth Logistics');
      expect(decrypted.note).toBe('Please send product catalogue');

      // 4. Owner notified under 10 seconds (AC-4)
      const notification = leadNotifier.getNotificationForLead(res.body.leadId);
      expect(notification).toBeDefined();
      expect(notification?.ownerSeatId).toBe('seat-rahul');
      expect(notification?.latencyMs).toBeLessThan(10000);

      // 5. Check events emitted on bus with ZERO visitor PII (AC-4)
      const emittedEvents = eventBus.published;
      const sharebackEvent = emittedEvents.find(
        (e) => e.type === 'shareback.submitted' && (e.payload as Record<string, unknown>).leadId === res.body.leadId
      );
      const leadCreatedEvent = emittedEvents.find(
        (e) => e.type === 'lead.created' && (e.payload as Record<string, unknown>).leadId === res.body.leadId
      );

      expect(sharebackEvent).toBeDefined();
      expect(leadCreatedEvent).toBeDefined();
      expect(sharebackEvent?.version).toBe('1.0.0');
      expect(leadCreatedEvent?.version).toBe('1.0.0');

      // Zero visitor PII assertion in event payload
      expect(JSON.stringify(sharebackEvent?.payload)).not.toContain('Vikram');
      expect(JSON.stringify(sharebackEvent?.payload)).not.toContain('vikram@example.com');
      expect(JSON.stringify(sharebackEvent?.payload)).not.toContain('9876543210');
      expect(JSON.stringify(leadCreatedEvent?.payload)).not.toContain('Vikram');
      expect(JSON.stringify(leadCreatedEvent?.payload)).not.toContain('vikram@example.com');
      expect(JSON.stringify(leadCreatedEvent?.payload)).not.toContain('9876543210');
    });
  });

  describe('AC-6: Spam protection, duplicate detection, and rate limits', () => {
    it('returns original confirmation on duplicate submission by same phone on same card within 24 hours without creating second lead', async () => {
      await setupCard(TENANT_A, 'acme-corp/dup-card', 'seat-dup');

      // First submission
      const res1 = await request(app.getHttpServer())
        .post('/public/c/acme-corp/dup-card/shareback')
        .send({
          name: 'Ananya Sharma',
          phone: '+919988776655',
          consent: true,
        });

      expect(res1.status).toBe(201);
      const leadId1 = res1.body.leadId;
      leadNotifier.clear();

      // Second submission: same phone, same card within 24h
      const res2 = await request(app.getHttpServer())
        .post('/public/c/acme-corp/dup-card/shareback')
        .send({
          name: 'Ananya S.',
          phone: '9988776655', // without prefix, normalized to same E.164
          consent: true,
        });

      expect(res2.status).toBe(200);
      expect(res2.body.status).toBe('duplicate');
      expect(res2.body.leadId).toBe(leadId1);

      // Verify no second notification was sent
      expect(leadNotifier.deliveredNotifications.length).toBe(0);

      // Verify only 1 lead exists in database
      await TenantContext.run(TENANT_A, async () => {
        const leads = await leadRepo.listByCard('seat-dup');
        expect(leads.length).toBe(1);
      });
    });

    it('rejects submission when Turnstile verification fails', async () => {
      await setupCard(TENANT_A, 'acme-corp/turnstile-card', 'seat-turnstile');

      const res = await request(app.getHttpServer())
        .post('/public/c/acme-corp/turnstile-card/shareback')
        .send({
          name: 'Bot Visitor',
          phone: '9876543210',
          consent: true,
          turnstileToken: 'turnstile-test-fail', // Triggers failure
        });

      expect(res.status).toBe(400);
      expect(res.body.type).toContain('rfc7807');
    });

    it('enforces rate limits per IP and returns 429 Problem Details with Retry-After header', async () => {
      await setupCard(TENANT_A, 'acme-corp/rate-card', 'seat-rate');

      const ip = '198.51.100.42';

      // Submit 5 requests within limit
      for (let i = 1; i <= 5; i++) {
        const res = await request(app.getHttpServer())
          .post('/public/c/acme-corp/rate-card/shareback')
          .set('X-Forwarded-For', ip)
          .send({
            name: `User ${i}`,
            phone: `987654320${i}`,
            consent: true,
          });
        expect(res.status).toBe(201);
      }

      // 6th request from same IP should be blocked
      const blockedRes = await request(app.getHttpServer())
        .post('/public/c/acme-corp/rate-card/shareback')
        .set('X-Forwarded-For', ip)
        .send({
          name: 'User 6',
          phone: '9876543299',
          consent: true,
        });

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.type).toContain('rfc7807');
      expect(blockedRes.headers['retry-after']).toBeDefined();
    });
  });

  describe('AC-8 & Cross-tenant isolation', () => {
    it('leads stay with the company when the seat is offboarded or reassigned', async () => {
      await setupCard(TENANT_A, 'acme-corp/offboard-card', 'seat-offboard');

      const res = await request(app.getHttpServer())
        .post('/public/c/acme-corp/offboard-card/shareback')
        .send({
          name: 'Customer One',
          phone: '9123456789',
          consent: true,
        });
      expect(res.status).toBe(201);
      const leadId = res.body.leadId;

      // Simulate seat offboarding in read model
      await TenantContext.run(TENANT_A, async () => {
        await seatRepo.upsertIfNewer({
          seatId: 'seat-offboard',
          tenantId: TENANT_A,
          personId: 'person-123',
          status: 'offboarded',
          aggregateVersion: 2,
          updatedAt: new Date().toISOString(),
        });
      });

      // Verify lead still exists and belongs to company TENANT_A
      await TenantContext.run(TENANT_A, async () => {
        const lead = await leadRepo.findById(leadId);
        expect(lead).not.toBeNull();
        expect(lead?.tenantId).toBe(TENANT_A);
        expect(lead?.ownerSeatId).toBe('seat-offboard');
      });
    });

    it('cross-tenant isolation: identical phone in different tenants produces distinct blind indexes and cannot be accessed across tenants', async () => {
      await setupCard(TENANT_A, 'acme-corp/card-a', 'seat-a');
      await setupCard(TENANT_B, 'beta-corp/card-b', 'seat-b');

      const phone = '9876543210';

      const resA = await request(app.getHttpServer())
        .post('/public/c/acme-corp/card-a/shareback')
        .send({ name: 'Cross Visitor', phone, consent: true });
      expect(resA.status).toBe(201);

      const resB = await request(app.getHttpServer())
        .post('/public/c/beta-corp/card-b/shareback')
        .send({ name: 'Cross Visitor', phone, consent: true });
      expect(resB.status).toBe(201);

      // Verify blind indexes are completely different due to per-tenant salting
      let leadA: Lead | null = null;
      let leadB: Lead | null = null;
      await TenantContext.run(TENANT_A, async () => {
        leadA = await leadRepo.findById(resA.body.leadId);
      });
      await TenantContext.run(TENANT_B, async () => {
        leadB = await leadRepo.findById(resB.body.leadId);
      });

      expect(leadA?.phoneBlindIndex).not.toBe(leadB?.phoneBlindIndex);

      // Tenant A repository cannot read Tenant B's leads
      await TenantContext.run(TENANT_A, async () => {
        const notFound = await leadRepo.findById(resB.body.leadId);
        expect(notFound).toBeNull();
      });
    });
  });

  describe('Rule 12: Write Idempotency handling (Condition 12)', () => {
    it('replays original response when identical Idempotency-Key is reused', async () => {
      await setupCard(TENANT_A, 'acme-corp/idemp-card', 'seat-idemp');

      const payload = {
        name: 'Idempotent User',
        phone: '9876543210',
        consent: true,
      };

      // 1. First submission with Idempotency-Key
      const res1 = await request(app.getHttpServer())
        .post('/public/c/acme-corp/idemp-card/shareback')
        .set('Idempotency-Key', 'key-test-shareback-1')
        .send(payload);

      expect(res1.status).toBe(201);
      const originalLeadId = res1.body.leadId;
      leadNotifier.clear();

      // 2. Replay submission with exact same Idempotency-Key and payload
      const res2 = await request(app.getHttpServer())
        .post('/public/c/acme-corp/idemp-card/shareback')
        .set('Idempotency-Key', 'key-test-shareback-1')
        .send(payload);

      expect(res2.status).toBe(201);
      expect(res2.body.leadId).toBe(originalLeadId);
      // Ensure no secondary notification occurred during replay
      expect(leadNotifier.deliveredNotifications.length).toBe(0);
    });

    it('rejects conflicting request body for existing Idempotency-Key with 422 Problem Details', async () => {
      await setupCard(TENANT_A, 'acme-corp/idemp-card-conflict', 'seat-idemp-conflict');

      const payload1 = {
        name: 'User One',
        phone: '9876543211',
        consent: true,
      };

      const res1 = await request(app.getHttpServer())
        .post('/public/c/acme-corp/idemp-card-conflict/shareback')
        .set('Idempotency-Key', 'key-test-conflict-1')
        .send(payload1);

      expect(res1.status).toBe(201);

      // Replay with SAME key but DIFFERENT body
      const payload2 = {
        name: 'User Two',
        phone: '9876543212',
        consent: true,
      };

      const res2 = await request(app.getHttpServer())
        .post('/public/c/acme-corp/idemp-card-conflict/shareback')
        .set('Idempotency-Key', 'key-test-conflict-1')
        .send(payload2);

      expect(res2.status).toBe(422);
      expect(res2.body.type).toContain('rfc7807');
      expect(res2.body.title).toBe('Unprocessable Entity');
      expect(res2.body.detail).toContain('Mismatching request body for provided Idempotency-Key');
    });
  });
});
