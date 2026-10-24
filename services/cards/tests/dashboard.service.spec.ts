import '../../../tests/setup-mongo.ts';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  connectMongo,
  MongoConnectionHandle,
  TenantContext,
  LocalKeyVaultProvider,
  encryptLeadPayload,
} from '@onebridge/shared';
import {
  createDraftCard,
  createAnalyticsEvent,
  DashboardService,
  MongoAnalyticsEventRepository,
  MongoCardRepository,
  MongoLeadRepository,
  ProblemError,
} from '../src/index.js';

const TENANT_A = '01JACTENANTA00000000000000';
const TENANT_B = '01JACTENANTB00000000000000';
const NOW = '2026-10-24T10:00:00.000Z';

describe('DashboardService (card summaries, overview, prototype leads list)', () => {
  let mongod: MongoMemoryServer;
  let handle: MongoConnectionHandle;
  let cardRepo: MongoCardRepository;
  let leadRepo: MongoLeadRepository;
  let analyticsRepo: MongoAnalyticsEventRepository;
  let keyVault: LocalKeyVaultProvider;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    handle = await connectMongo(mongod.getUri());
  }, 120000);

  afterAll(async () => {
    if (handle) await handle.close();
    if (mongod) await mongod.stop();
  });

  beforeEach(async () => {
    const db = handle._getInternalDb();
    await Promise.all(['cards', 'leads', 'analytics_events'].map((c) => db.collection(c).deleteMany({})));
    cardRepo = new MongoCardRepository(handle);
    leadRepo = new MongoLeadRepository(handle);
    analyticsRepo = new MongoAnalyticsEventRepository(handle);
    keyVault = new LocalKeyVaultProvider();

    await TenantContext.run(TENANT_A, async () => {
      const priya = createDraftCard({ tenantId: TENANT_A, seatId: 'OB-AAAAAA-E0001', slug: 'acme/ob-aaaaaa-e0001', verifiedBadge: false }, NOW);
      priya.sections = priya.sections.map((s) =>
        s.type === 'about' ? { ...s, content: { name: 'Priya Kulkarni', designation: 'Founder' } } : s
      );
      priya.status = 'published';
      await cardRepo.save(priya);
      await cardRepo.save(createDraftCard({ tenantId: TENANT_A, seatId: 'OB-AAAAAA-E0002', slug: 'acme/ob-aaaaaa-e0002', verifiedBadge: false }, NOW));
      await analyticsRepo.save(createAnalyticsEvent({ tenantId: TENANT_A, eventType: 'card_viewed', cardId: priya.id }));
      await analyticsRepo.save(createAnalyticsEvent({ tenantId: TENANT_A, eventType: 'card_viewed', cardId: priya.id }));
      await analyticsRepo.save(createAnalyticsEvent({ tenantId: TENANT_A, eventType: 'contact_saved', cardId: priya.id }));

      const leadId = '01JLEAD0000000000000000001';
      const { kid, key } = await keyVault.getTenantKey(TENANT_A);
      await leadRepo.save({
        id: leadId,
        tenantId: TENANT_A,
        cardId: priya.id,
        ownerSeatId: priya.id,
        source: 'shareback',
        encryptedPayload: encryptLeadPayload({
          payload: { name: 'Rahul Mehta', phone: '+919822099999', company: 'Mehta Builders' },
          key,
          kid,
          tenantId: TENANT_A,
          leadId,
        }),
        phoneBlindIndex: 'blind',
        indexVersion: 1,
        consent: { granted: true, timestamp: NOW, noticeVersion: 'v1.0', cardId: priya.id },
        createdAt: new Date(NOW),
        updatedAt: new Date(NOW),
      });
    });
    await TenantContext.run(TENANT_B, () =>
      cardRepo.save(createDraftCard({ tenantId: TENANT_B, seatId: 'OB-BBBBBB-E0001', slug: 'other/ob-bbbbbb-e0001', verifiedBadge: false }, NOW))
    );
  });

  const service = (leadsPanel = true) =>
    new DashboardService(cardRepo, leadRepo, analyticsRepo, keyVault, 'https://cards.example/', leadsPanel);

  it('lists card summaries with names and public URLs, only for the caller company', async () => {
    const items = await service().listCardSummaries(TENANT_A);
    expect(items.map((c) => c.id)).toEqual(['OB-AAAAAA-E0001', 'OB-AAAAAA-E0002']);
    expect(items[0]).toMatchObject({
      name: 'Priya Kulkarni',
      designation: 'Founder',
      status: 'published',
      publicUrl: 'https://cards.example/c/acme/ob-aaaaaa-e0001',
    });
    expect(items[1].name).toBe('');
  });

  it('counts cards by status, buffered analytics events and leads', async () => {
    const stats = await service().getOverviewStats(TENANT_A);
    expect(stats).toEqual({
      cards: { total: 2, published: 1, draft: 1, pendingApproval: 0 },
      views: 2,
      saves: 1,
      qrScans: 0,
      leads: 1,
    });
    const other = await service().getOverviewStats(TENANT_B);
    expect(other.leads).toBe(0);
    expect(other.views).toBe(0);
  });

  it('decrypts leads for owners and admins when the panel is enabled', async () => {
    const leads = await service().listLeads(TENANT_A, 'owner');
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({ name: 'Rahul Mehta', phone: '+919822099999', company: 'Mehta Builders', ownerName: 'Priya Kulkarni' });
  });

  it('refuses leads to employees and when the panel flag is off', async () => {
    await expect(service().listLeads(TENANT_A, 'employee')).rejects.toMatchObject({ status: 403 });
    await expect(service(false).listLeads(TENANT_A, 'owner')).rejects.toBeInstanceOf(ProblemError);
    await expect(service(false).listLeads(TENANT_A, 'owner')).rejects.toMatchObject({ status: 404 });
  });
});
