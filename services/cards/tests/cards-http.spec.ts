import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectMongo, MongoConnectionHandle, InMemoryEventBus, DomainEvent } from '@onebridge/shared';
import { ulid } from 'ulid';
import { createApp } from '../src/app.js';
import { CardsEnvConfig } from '../src/config/env.js';
import { FakeRevalidationNotifier } from '../src/infrastructure/revalidation-notifier.js';

describe('F10: Cards HTTP API and read-model sync (supertest + mongodb-memory-server)', () => {
  let mongod: MongoMemoryServer;
  let connectionHandle: MongoConnectionHandle;
  let app: INestApplication;
  let eventBus: InMemoryEventBus;
  let revalidationNotifier: FakeRevalidationNotifier;

  const TENANT_A = '01JACTENANTA00000000000000';
  const TENANT_B = '01JACTENANTB00000000000000';

  const testConfig: CardsEnvConfig = {
    nodeEnv: 'test',
    port: 4005,
    appUrl: 'http://localhost:3000',
    mongoUri: '',
    webPublicUrl: 'http://localhost:3001',
    revalidationSigningSecret: 'test-secret-at-least-32-characters-long',
  };

  function orgCreatedEvent(tenantId: string, overrides: Partial<DomainEvent['payload']> = {}, aggregateVersion = 1): DomainEvent {
    return {
      eventId: ulid(),
      type: 'org.created',
      version: '1.0.0',
      tenantId,
      occurredAt: new Date().toISOString(),
      correlationId: 'corr_1',
      aggregateVersion,
      payload: { orgId: tenantId, businessId: 'OB-7KQ2MX', name: 'Acme Steels', slug: 'acme-steels', ...overrides },
    };
  }

  function seatCreatedEvent(tenantId: string, seatId: string, overrides: Partial<DomainEvent['payload']> = {}): DomainEvent {
    return {
      eventId: ulid(),
      type: 'seat.created',
      version: '1.0.0',
      tenantId,
      occurredAt: new Date().toISOString(),
      correlationId: 'corr_1',
      aggregateVersion: 1,
      payload: { orgId: tenantId, seatId, title: 'Sales Executive', personId: 'person_1', status: 'active', ...overrides },
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
  }, 120000);

  afterAll(async () => {
    if (app) await app.close();
    if (mongod) await mongod.stop();
  });

  describe('AC-1: a seat.created event provisions exactly one draft card for that seat', () => {
    it('creates a draft card with the correct id and default template', async () => {
      await eventBus.publish(orgCreatedEvent(TENANT_A));
      await eventBus.publish(seatCreatedEvent(TENANT_A, 'OB-7KQ2MX-E0001'));

      const res = await request(app.getHttpServer())
        .get('/cards/OB-7KQ2MX-E0001')
        .set('x-tenant-id', TENANT_A)
        .set('x-user-id', 'person_1')
        .set('x-user-role', 'employee');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('OB-7KQ2MX-E0001');
      expect(res.body.status).toBe('draft');
      expect(res.body.sections).toHaveLength(9);
    });

    it('is idempotent: a second seat.created for the same seat does not create a second card or reset edits', async () => {
      await eventBus.publish(seatCreatedEvent(TENANT_A, 'OB-7KQ2MX-E0002'));
      await request(app.getHttpServer())
        .patch('/cards/OB-7KQ2MX-E0002')
        .set('x-tenant-id', TENANT_A)
        .set('x-user-id', 'person_1')
        .set('x-user-role', 'owner')
        .send({ language: 'hi' });

      await eventBus.publish(seatCreatedEvent(TENANT_A, 'OB-7KQ2MX-E0002')); // duplicate delivery

      const res = await request(app.getHttpServer())
        .get('/cards/OB-7KQ2MX-E0002')
        .set('x-tenant-id', TENANT_A)
        .set('x-user-id', 'person_1')
        .set('x-user-role', 'owner');

      expect(res.body.language).toBe('hi'); // edit survived the duplicate event
    });
  });

  describe('AC-2: template switch keeps all content, applies in bulk', () => {
    it('PATCH templateId does not change sections', async () => {
      await eventBus.publish(seatCreatedEvent(TENANT_A, 'OB-7KQ2MX-E0003'));
      const before = await request(app.getHttpServer())
        .get('/cards/OB-7KQ2MX-E0003')
        .set('x-tenant-id', TENANT_A).set('x-user-id', 'p').set('x-user-role', 'owner');

      const res = await request(app.getHttpServer())
        .patch('/cards/OB-7KQ2MX-E0003')
        .set('x-tenant-id', TENANT_A).set('x-user-id', 'p').set('x-user-role', 'owner')
        .send({ templateId: 'bridge-orange' });

      expect(res.status).toBe(200);
      expect(res.body.templateId).toBe('bridge-orange');
      expect(res.body.sections).toEqual(before.body.sections);
    });

    it('rejects an unknown template id', async () => {
      await eventBus.publish(seatCreatedEvent(TENANT_A, 'OB-7KQ2MX-E0004'));
      const res = await request(app.getHttpServer())
        .patch('/cards/OB-7KQ2MX-E0004')
        .set('x-tenant-id', TENANT_A).set('x-user-id', 'p').set('x-user-role', 'owner')
        .send({ templateId: 'not-a-real-template' });

      expect(res.status).toBe(400);
    });

    it('bulk-template applies to all selected cards and leaves others untouched', async () => {
      await eventBus.publish(seatCreatedEvent(TENANT_A, 'OB-7KQ2MX-E0005'));
      await eventBus.publish(seatCreatedEvent(TENANT_A, 'OB-7KQ2MX-E0006'));
      await eventBus.publish(seatCreatedEvent(TENANT_A, 'OB-7KQ2MX-E0007')); // control, not in the bulk request

      const res = await request(app.getHttpServer())
        .post('/cards/bulk-template')
        .set('x-tenant-id', TENANT_A).set('x-user-id', 'p').set('x-user-role', 'admin')
        .send({ cardIds: ['OB-7KQ2MX-E0005', 'OB-7KQ2MX-E0006'], templateId: 'grid-mono' });

      expect(res.status).toBe(201); // Nest default for POST with no @HttpCode override
      expect(res.body).toHaveLength(2);
      expect(res.body.every((c: { templateId: string }) => c.templateId === 'grid-mono')).toBe(true);

      const control = await request(app.getHttpServer())
        .get('/cards/OB-7KQ2MX-E0007')
        .set('x-tenant-id', TENANT_A).set('x-user-id', 'p').set('x-user-role', 'owner');
      expect(control.body.templateId).not.toBe('grid-mono');
    });

    it('a non-admin cannot bulk-apply a template', async () => {
      const res = await request(app.getHttpServer())
        .post('/cards/bulk-template')
        .set('x-tenant-id', TENANT_A).set('x-user-id', 'p').set('x-user-role', 'employee')
        .send({ cardIds: ['OB-7KQ2MX-E0005'], templateId: 'grid-mono' });

      expect(res.status).toBe(403);
    });
  });

  describe('AC-3 & AC-4: section locks, editing, and visibility', () => {
    it('employee cannot change a section the admin locked', async () => {
      await eventBus.publish(seatCreatedEvent(TENANT_A, 'OB-7KQ2MX-E0008'));

      const current = await request(app.getHttpServer())
        .get('/cards/OB-7KQ2MX-E0008')
        .set('x-tenant-id', TENANT_A).set('x-user-id', 'p').set('x-user-role', 'owner');

      const sections = current.body.sections.map((s: { type: string }, i: number) =>
        i === 0 ? { ...s, locked: true } : s
      );
      await request(app.getHttpServer())
        .patch('/cards/OB-7KQ2MX-E0008')
        .set('x-tenant-id', TENANT_A).set('x-user-id', 'p').set('x-user-role', 'owner')
        .send({ sections });

      const attempted = sections.map((s: { enabled: boolean }, i: number) => (i === 0 ? { ...s, enabled: false } : s));
      const res = await request(app.getHttpServer())
        .patch('/cards/OB-7KQ2MX-E0008')
        .set('x-tenant-id', TENANT_A).set('x-user-id', 'person_1').set('x-user-role', 'employee')
        .send({ sections: attempted });

      expect(res.status).toBe(400);
      expect(res.body.title).toBe('Bad Request');
      expect(res.body.detail).toMatch(/locked/i);
    });

    it('employee can update unlocked sections and field visibility on their own card', async () => {
      await eventBus.publish(seatCreatedEvent(TENANT_A, 'OB-7KQ2MX-E0013', { personId: 'emp_13' }));

      const current = await request(app.getHttpServer())
        .get('/cards/OB-7KQ2MX-E0013')
        .set('x-tenant-id', TENANT_A).set('x-user-id', 'emp_13').set('x-user-role', 'employee');

      const modified = current.body.sections.map((s: { type: string; enabled: boolean; visibility: string }) =>
        s.type === 'social_links' ? { ...s, enabled: false, visibility: 'internal' } : s
      );

      const res = await request(app.getHttpServer())
        .patch('/cards/OB-7KQ2MX-E0013')
        .set('x-tenant-id', TENANT_A).set('x-user-id', 'emp_13').set('x-user-role', 'employee')
        .send({ sections: modified });

      expect(res.status).toBe(200);
      const updatedSection = res.body.sections.find((s: { type: string }) => s.type === 'social_links');
      expect(updatedSection.enabled).toBe(false);
      expect(updatedSection.visibility).toBe('internal');
    });

    it('manager holding a seat (e.g. team_lead) can update their own card', async () => {
      await eventBus.publish(seatCreatedEvent(TENANT_A, 'OB-7KQ2MX-E0014', { personId: 'lead_14' }));

      const res = await request(app.getHttpServer())
        .patch('/cards/OB-7KQ2MX-E0014')
        .set('x-tenant-id', TENANT_A).set('x-user-id', 'lead_14').set('x-user-role', 'team_lead')
        .send({ language: 'hi' });

      expect(res.status).toBe(200);
      expect(res.body.language).toBe('hi');
    });

    it('rejects an employee trying to edit another employee card', async () => {
      await eventBus.publish(seatCreatedEvent(TENANT_A, 'OB-7KQ2MX-E0015', { personId: 'person_target' }));

      const res = await request(app.getHttpServer())
        .patch('/cards/OB-7KQ2MX-E0015')
        .set('x-tenant-id', TENANT_A).set('x-user-id', 'person_other').set('x-user-role', 'employee')
        .send({ language: 'hi' });

      expect(res.status).toBe(403);
    });

    it('rejects document section exceeding 25 MB size limit with 400', async () => {
      await eventBus.publish(seatCreatedEvent(TENANT_A, 'OB-7KQ2MX-E0016', { personId: 'emp_16' }));
      const current = await request(app.getHttpServer())
        .get('/cards/OB-7KQ2MX-E0016')
        .set('x-tenant-id', TENANT_A).set('x-user-id', 'p').set('x-user-role', 'owner');

      const sections = current.body.sections.map((s: { type: string; content: Record<string, unknown> }) =>
        s.type === 'documents'
          ? {
              ...s,
              content: {
                items: [{ name: 'massive.pdf', size: 26 * 1024 * 1024, mimeType: 'application/pdf', url: 'https://cdn/m.pdf' }],
              },
            }
          : s
      );

      const res = await request(app.getHttpServer())
        .patch('/cards/OB-7KQ2MX-E0016')
        .set('x-tenant-id', TENANT_A).set('x-user-id', 'p').set('x-user-role', 'owner')
        .send({ sections });

      expect(res.status).toBe(400);
      expect(res.body.detail).toMatch(/25 MB/i);
    });

    it('rejects document section with non-PDF file with 400', async () => {
      await eventBus.publish(seatCreatedEvent(TENANT_A, 'OB-7KQ2MX-E0017', { personId: 'emp_17' }));
      const current = await request(app.getHttpServer())
        .get('/cards/OB-7KQ2MX-E0017')
        .set('x-tenant-id', TENANT_A).set('x-user-id', 'p').set('x-user-role', 'owner');

      const sections = current.body.sections.map((s: { type: string; content: Record<string, unknown> }) =>
        s.type === 'documents'
          ? {
              ...s,
              content: {
                items: [{ name: 'archive.zip', size: 1024, mimeType: 'application/zip', url: 'https://cdn/a.zip' }],
              },
            }
          : s
      );

      const res = await request(app.getHttpServer())
        .patch('/cards/OB-7KQ2MX-E0017')
        .set('x-tenant-id', TENANT_A).set('x-user-id', 'p').set('x-user-role', 'owner')
        .send({ sections });

      expect(res.status).toBe(400);
      expect(res.body.detail).toMatch(/PDF/i);
    });
  });

  describe('AC-6: publish fires card.published and triggers revalidation', () => {
    it('publishes a draft card and calls the revalidation notifier', async () => {
      await eventBus.publish(seatCreatedEvent(TENANT_A, 'OB-7KQ2MX-E0009'));
      const callsBefore = revalidationNotifier.calls.length;

      const res = await request(app.getHttpServer())
        .post('/cards/OB-7KQ2MX-E0009/publish')
        .set('x-tenant-id', TENANT_A).set('x-user-id', 'p').set('x-user-role', 'owner');

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('published');
      expect(res.body.publishedAt).toBeTruthy();
      expect(revalidationNotifier.calls.length).toBe(callsBefore + 1);
      expect(revalidationNotifier.calls.at(-1)?.cardId).toBe('OB-7KQ2MX-E0009');

      const publishedEvents = eventBus.published.filter((e) => e.type === 'card.published');
      expect(publishedEvents.some((e) => (e.payload as { cardId: string }).cardId === 'OB-7KQ2MX-E0009')).toBe(true);
    });
  });

  describe('Approval workflow: company setting routes a non-admin publish through pending_approval (AC-8)', () => {
    it('owner can always publish directly even when approval is required', async () => {
      await eventBus.publish(seatCreatedEvent(TENANT_A, 'OB-7KQ2MX-E0010'));
      const res = await request(app.getHttpServer())
        .post('/cards/OB-7KQ2MX-E0010/publish')
        .set('x-tenant-id', TENANT_A).set('x-user-id', 'p').set('x-user-role', 'owner');

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('published');
    });

    it('company setting cardApprovalRequired routes employee publish to pending_approval', async () => {
      // Turn on company setting via org.updated
      await eventBus.publish({
        eventId: ulid(),
        type: 'org.updated',
        version: '1.0.0',
        tenantId: TENANT_A,
        occurredAt: new Date().toISOString(),
        correlationId: 'corr_appr',
        aggregateVersion: 2,
        payload: { orgId: TENANT_A, updatedFields: { cardApprovalRequired: true } },
      });

      await eventBus.publish(seatCreatedEvent(TENANT_A, 'OB-7KQ2MX-E0018', { personId: 'emp_18' }));

      // Employee attempts to publish
      const res = await request(app.getHttpServer())
        .post('/cards/OB-7KQ2MX-E0018/publish')
        .set('x-tenant-id', TENANT_A).set('x-user-id', 'emp_18').set('x-user-role', 'employee');

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('pending_approval');
    });

    it('non-admin cannot approve a card', async () => {
      const res = await request(app.getHttpServer())
        .post('/cards/OB-7KQ2MX-E0018/approve')
        .set('x-tenant-id', TENANT_A).set('x-user-id', 'emp_18').set('x-user-role', 'employee');

      expect(res.status).toBe(403);
    });

    it('admin approves a card sitting in pending_approval and triggers publish', async () => {
      const callsBefore = revalidationNotifier.calls.length;

      const res = await request(app.getHttpServer())
        .post('/cards/OB-7KQ2MX-E0018/approve')
        .set('x-tenant-id', TENANT_A).set('x-user-id', 'admin_1').set('x-user-role', 'admin');

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('published');
      expect(res.body.publishedAt).toBeTruthy();
      expect(revalidationNotifier.calls.length).toBe(callsBefore + 1);
    });

    it('admin cannot approve a card that is not in pending_approval', async () => {
      const res = await request(app.getHttpServer())
        .post('/cards/OB-7KQ2MX-E0018/approve')
        .set('x-tenant-id', TENANT_A).set('x-user-id', 'admin_1').set('x-user-role', 'admin');

      expect(res.status).toBe(400);
      expect(res.body.detail).toMatch(/not pending approval/i);
    });
  });

  describe('Write endpoint idempotency (AGENTS.md Section 3)', () => {
    it('replaying publish with the same Idempotency-Key returns cached response without duplicate events', async () => {
      await eventBus.publish(seatCreatedEvent(TENANT_A, 'OB-7KQ2MX-E0019'));
      const callsBefore = revalidationNotifier.calls.length;

      const first = await request(app.getHttpServer())
        .post('/cards/OB-7KQ2MX-E0019/publish')
        .set('x-tenant-id', TENANT_A).set('x-user-id', 'p').set('x-user-role', 'owner')
        .set('idempotency-key', 'idem_pub_1');

      expect(first.status).toBe(201);
      expect(revalidationNotifier.calls.length).toBe(callsBefore + 1);

      // Replay identical request with same key
      const replay = await request(app.getHttpServer())
        .post('/cards/OB-7KQ2MX-E0019/publish')
        .set('x-tenant-id', TENANT_A).set('x-user-id', 'p').set('x-user-role', 'owner')
        .set('idempotency-key', 'idem_pub_1');

      expect(replay.status).toBe(201);
      expect(replay.body.id).toBe(first.body.id);
      expect(revalidationNotifier.calls.length).toBe(callsBefore + 1); // no second revalidation
    });
  });

  describe('org.branding_updated revalidates every published card for that tenant', () => {
    it('triggers a revalidation call for each already-published card', async () => {
      await eventBus.publish(seatCreatedEvent(TENANT_A, 'OB-7KQ2MX-E0011'));
      await request(app.getHttpServer())
        .post('/cards/OB-7KQ2MX-E0011/publish')
        .set('x-tenant-id', TENANT_A).set('x-user-id', 'p').set('x-user-role', 'owner');

      const callsBefore = revalidationNotifier.calls.length;

      await eventBus.publish({
        eventId: ulid(),
        type: 'org.branding_updated',
        version: '1.0.0',
        tenantId: TENANT_A,
        occurredAt: new Date().toISOString(),
        correlationId: 'corr_2',
        aggregateVersion: 3,
        payload: { orgId: TENANT_A, businessId: 'OB-7KQ2MX', logo: 'https://cdn/x.png', brandColours: { band: '#1F4E9A', text: '#FFFFFF' } },
      });

      expect(revalidationNotifier.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  describe('Cross-tenant isolation', () => {
    it('tenant B cannot read a card that belongs to tenant A', async () => {
      await eventBus.publish(orgCreatedEvent(TENANT_B, { businessId: 'OB-ZZZZZZ', slug: 'other-co' }));
      await eventBus.publish(seatCreatedEvent(TENANT_A, 'OB-7KQ2MX-E0012'));

      const res = await request(app.getHttpServer())
        .get('/cards/OB-7KQ2MX-E0012')
        .set('x-tenant-id', TENANT_B)
        .set('x-user-id', 'p')
        .set('x-user-role', 'owner');

      expect(res.status).toBe(404);
    });
  });

  it('lists the 8 card templates', async () => {
    const res = await request(app.getHttpServer()).get('/cards/templates');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(8);
  });
});
