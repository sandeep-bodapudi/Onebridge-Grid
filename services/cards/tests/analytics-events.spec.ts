import '../../../tests/setup-mongo.ts';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectMongo, MongoConnectionHandle, TenantContext, TenantIsolationError } from '@onebridge/shared';
import {
  createAnalyticsEvent,
  MongoAnalyticsEventRepository,
  MongoCardRepository,
  AnalyticsStubController,
  CardProps,
} from '../src/index.js';

describe('Analytics Telemetry Buffering (Gate Condition 4 / Step 3 Closure)', () => {
  let mongod: MongoMemoryServer;
  let connectionHandle: MongoConnectionHandle;
  let analyticsRepo: MongoAnalyticsEventRepository;
  let cardRepo: MongoCardRepository;
  let controller: AnalyticsStubController;

  const TENANT_A = '01JACTENANTA00000000000000';
  const TENANT_B = '01JACTENANTB00000000000000';

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    connectionHandle = await connectMongo(mongod.getUri());
  }, 120000);

  afterAll(async () => {
    if (connectionHandle) await connectionHandle.close();
    if (mongod) await mongod.stop();
  });

  beforeEach(async () => {
    const internalDb = connectionHandle._getInternalDb();
    await internalDb.collection('analytics_events').deleteMany({});
    await internalDb.collection('cards').deleteMany({});

    analyticsRepo = new MongoAnalyticsEventRepository(connectionHandle);
    cardRepo = new MongoCardRepository(connectionHandle);
    controller = new AnalyticsStubController(analyticsRepo, cardRepo);

    await analyticsRepo.createIndexes();
    await cardRepo.createIndexes();
  });

  it('instantiates valid analytics events with timestamps and properties', () => {
    const event = createAnalyticsEvent({
      tenantId: TENANT_A,
      eventType: 'card_viewed',
      cardId: 'card-123',
      slug: 'acme/sneha',
      source: 'qr',
      sourceTag: 'standee-a',
    });

    expect(event.id).toMatch(/^evt_/);
    expect(event.tenantId).toBe(TENANT_A);
    expect(event.eventType).toBe('card_viewed');
    expect(event.cardId).toBe('card-123');
    expect(event.source).toBe('qr');
    expect(event.createdAt).toBeDefined();
  });

  it('persists analytics events within TenantContext and isolates between tenants', async () => {
    const eventA = createAnalyticsEvent({
      tenantId: TENANT_A,
      eventType: 'card_viewed',
      cardId: 'card-a',
    });
    const eventB = createAnalyticsEvent({
      tenantId: TENANT_B,
      eventType: 'card_viewed',
      cardId: 'card-b',
    });

    await TenantContext.run(TENANT_A, async () => {
      await analyticsRepo.save(eventA);
    });

    await TenantContext.run(TENANT_B, async () => {
      await analyticsRepo.save(eventB);
    });

    // Verify Tenant A sees only its own events
    await TenantContext.run(TENANT_A, async () => {
      const eventsA = await analyticsRepo.listByCard('card-a');
      expect(eventsA).toHaveLength(1);
      expect(eventsA[0].id).toBe(eventA.id);

      const eventsBFromA = await analyticsRepo.listByCard('card-b');
      expect(eventsBFromA).toHaveLength(0);

      const metricsA = await analyticsRepo.getTenantOverviewMetrics();
      expect(metricsA.views).toBe(1);
    });

    // Verify saving without context throws TenantIsolationError
    await expect(analyticsRepo.save(eventA)).rejects.toThrow(TenantIsolationError);
  });

  it('AnalyticsStubController ingests events with tenantId and buffers into MongoDB', async () => {
    const res = await controller.ingestEvents([
      {
        eventId: 'evt_scan_1',
        eventType: 'qr_scanned',
        tenantId: TENANT_A,
        timestamp: new Date().toISOString(),
        properties: { source: 'counter-standee' },
      },
      {
        eventId: 'evt_scan_2',
        eventType: 'qr_scanned',
        tenantId: TENANT_A,
        timestamp: new Date().toISOString(),
      },
    ]);

    expect(res.status).toBe('accepted');
    expect(res.count).toBe(2);
    expect(res.buffered).toBe(2);

    await TenantContext.run(TENANT_A, async () => {
      const scans = await analyticsRepo.countByTenantAndType('qr_scanned');
      expect(scans).toBe(2);
    });
  });

  it('AnalyticsStubController resolves missing tenantId using cardId or slug lookup', async () => {
    // Seed card under Tenant A
    await TenantContext.run(TENANT_A, async () => {
      await cardRepo.save({
        id: 'card-lookup-1',
        tenantId: TENANT_A,
        slug: 'sahyadri/sneha',
        status: 'published',
        templateId: 'classic-charcoal',
        language: 'en',
        ownerId: 'seat-1',
        sections: [],
        aggregateVersion: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as CardProps);
    });

    // Send telemetry from visitor client without explicit tenantId (only cardId or slug)
    const res = await controller.ingestEvents({
      type: 'contact_saved',
      cardId: 'card-lookup-1',
      metadata: { format: 'vcard' },
    });

    expect(res.status).toBe('accepted');
    expect(res.buffered).toBe(1);

    await TenantContext.run(TENANT_A, async () => {
      const metrics = await analyticsRepo.getCardOverviewMetrics('card-lookup-1');
      expect(metrics.saves).toBe(1);
    });
  });

  it('scrubs PII and credentials from properties before persistence', async () => {
    await controller.ingestEvents({
      eventType: 'custom_interaction',
      tenantId: TENANT_A,
      properties: {
        safeField: 'button_click',
        phone: '+919999999999',
        email: 'visitor@example.com',
        visitorName: 'John Doe',
        userPassword: 'plaintext-secret',
        authToken: 'jwt-12345',
        __proto__: { polluted: true },
      },
    });

    await TenantContext.run(TENANT_A, async () => {
      const docs = await analyticsRepo.find({ eventType: 'custom_interaction' });
      expect(docs).toHaveLength(1);
      const props = docs[0].properties!;
      expect(props.safeField).toBe('button_click');
      expect(props.phone).toBeUndefined();
      expect(props.email).toBeUndefined();
      expect(props.visitorName).toBeUndefined();
      expect(props.userPassword).toBeUndefined();
      expect(props.authToken).toBeUndefined();
      expect((props as Record<string, unknown>).polluted).toBeUndefined();
    });
  });

  it('enforces authoritative tenantId and rejects cross-tenant spoofing attempts', async () => {
    // Seed card belonging to Tenant A
    await TenantContext.run(TENANT_A, async () => {
      await cardRepo.save({
        id: 'card-tenant-a',
        tenantId: TENANT_A,
        slug: 'org-a/person-a',
        status: 'published',
        templateId: 'classic-charcoal',
        language: 'en',
        ownerId: 'seat-a',
        sections: [],
        aggregateVersion: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as CardProps);
    });

    // Attacker passes card-tenant-a but claims tenantId is TENANT_B
    await controller.ingestEvents({
      eventType: 'card_viewed',
      cardId: 'card-tenant-a',
      tenantId: TENANT_B, // Conflicting spoofed tenant
    });

    // Verify it was saved under Tenant A (the real owner of the card), NOT Tenant B
    await TenantContext.run(TENANT_B, async () => {
      const tenantBEvents = await analyticsRepo.listByCard('card-tenant-a');
      expect(tenantBEvents).toHaveLength(0);
    });

    await TenantContext.run(TENANT_A, async () => {
      const tenantAEvents = await analyticsRepo.listByCard('card-tenant-a');
      expect(tenantAEvents).toHaveLength(1);
      expect(tenantAEvents[0].tenantId).toBe(TENANT_A);
    });
  });

  it('caps large batches at 100 events to prevent DoS', async () => {
    const oversizedBatch = Array.from({ length: 150 }, (_, i) => ({
      eventType: 'batch_event',
      tenantId: TENANT_A,
      eventId: `evt_${i}`,
    }));

    const res = await controller.ingestEvents(oversizedBatch);
    expect(res.buffered).toBe(100);
  });
});
