import '../../../tests/setup-mongo.ts';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  connectMongo,
  MongoConnectionHandle,
  TenantContext,
  LocalKeyVaultProvider,
  InMemoryRateLimiter,
  InMemoryEventBus,
} from '@onebridge/shared';
import {
  createDraftCard,
  CompanyProfileService,
  SharebackService,
  MongoCardRepository,
  MongoLeadRepository,
  MongoAnalyticsEventRepository,
  MongoCompanyProfileRepository,
  MongoOrgReadModelRepository,
  MongoSeatReadModelRepository,
  MongoBranchReadModelRepository,
  ProblemError,
  validateCompanyProfile,
  embeddableVideoUrl,
  catalogueLimitFor,
  CatalogueLimitError,
  InvalidCompanyProfileError,
} from '../src/index.js';
import { FakeLeadNotifier } from '../src/domain/notifier.js';
import { BypassTurnstileValidator } from '../src/application/turnstile-validator.js';

const TENANT = '01JACTENANTA00000000000000';
const OTHER = '01JACTENANTB00000000000000';
const NOW = '2026-10-24T10:00:00.000Z';

describe('company profile rules (F26)', () => {
  it('allows 50 catalogue items on Starter and unlimited on Business', () => {
    expect(catalogueLimitFor('starter')).toBe(50);
    expect(catalogueLimitFor(undefined)).toBe(50);
    expect(catalogueLimitFor('business')).toBeNull();
    const items = Array.from({ length: 51 }, (_, i) => ({ id: `p${i}`, name: `Item ${i}` }));
    expect(() => validateCompanyProfile({ products: items }, 'starter')).toThrow(CatalogueLimitError);
    expect(validateCompanyProfile({ products: items }, 'business').products).toHaveLength(51);
  });

  it('embeds only YouTube and Vimeo videos', () => {
    expect(embeddableVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(embeddableVideoUrl('https://youtu.be/dQw4w9WgXcQ')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(embeddableVideoUrl('https://vimeo.com/76979871')).toBe('https://player.vimeo.com/video/76979871');
    expect(embeddableVideoUrl('https://example.com/video.mp4')).toBeNull();
    expect(() =>
      validateCompanyProfile({ portfolio: [{ id: 'w1', title: 'Warehouse', videoUrl: 'https://example.com/v.mp4' }] }, 'starter')
    ).toThrow(/YouTube or Vimeo/);
  });

  it('accepts https PDFs up to 25 MB only', () => {
    const doc = (url: string, sizeBytes?: number) => ({ documents: [{ id: 'd1', title: 'Brochure', url, sizeBytes }] });
    expect(validateCompanyProfile(doc('https://cdn.example.com/brochure.pdf', 2_000_000), 'starter').documents).toHaveLength(1);
    expect(() => validateCompanyProfile(doc('http://cdn.example.com/brochure.pdf'), 'starter')).toThrow(InvalidCompanyProfileError);
    expect(() => validateCompanyProfile(doc('https://cdn.example.com/brochure.docx'), 'starter')).toThrow(/PDF/);
    expect(() => validateCompanyProfile(doc('https://cdn.example.com/b.pdf', 30 * 1024 * 1024), 'starter')).toThrow(/25 MB/);
  });

  it('requires names and drops prices when the price is on request', () => {
    expect(() => validateCompanyProfile({ products: [{ id: 'p1', name: ' ' }] }, 'starter')).toThrow(/required/);
    const out = validateCompanyProfile({ products: [{ id: 'p1', name: 'TMT bars', price: '₹54,000', priceOnRequest: true }] }, 'starter');
    expect(out.products[0].price).toBeUndefined();
    expect(out.products[0].priceOnRequest).toBe(true);
  });
});

describe('CompanyProfileService (F26)', () => {
  let mongod: MongoMemoryServer;
  let handle: MongoConnectionHandle;
  let service: CompanyProfileService;
  let leadRepo: MongoLeadRepository;

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
    await Promise.all(
      ['cards', 'leads', 'analytics_events', 'company_profiles', 'org_read_models', 'seat_read_models', 'branch_read_models'].map((c) =>
        db.collection(c).deleteMany({})
      )
    );
    const cardRepo = new MongoCardRepository(handle);
    leadRepo = new MongoLeadRepository(handle);
    const orgRepo = new MongoOrgReadModelRepository(handle);
    const seatRepo = new MongoSeatReadModelRepository(handle);
    const branchRepo = new MongoBranchReadModelRepository(handle);
    const shareback = new SharebackService(
      cardRepo,
      leadRepo,
      new LocalKeyVaultProvider(),
      new InMemoryRateLimiter(),
      new BypassTurnstileValidator(true),
      new InMemoryEventBus(),
      new FakeLeadNotifier()
    );
    service = new CompanyProfileService(
      new MongoCompanyProfileRepository(handle),
      cardRepo,
      orgRepo,
      seatRepo,
      branchRepo,
      new MongoAnalyticsEventRepository(handle),
      shareback,
      'https://grid.example.test',
      () => new Date(NOW)
    );

    await TenantContext.run(TENANT, async () => {
      await orgRepo.upsertIfNewer({
        tenantId: TENANT,
        businessId: 'OB-7KQ2MX',
        name: 'Acme Steels',
        slug: 'acme-steels',
        verifiedBadge: true,
        plan: 'starter',
        about: 'Structural steel for builders.',
        aggregateVersion: 1,
        updatedAt: NOW,
      });
      await branchRepo.upsertIfNewer({ branchId: 'br_hyd', tenantId: TENANT, name: 'Hyderabad', address: 'Jubilee Hills', mapPin: { lat: 17.43, lng: 78.4 }, status: 'active', aggregateVersion: 1, updatedAt: NOW });
      await branchRepo.upsertIfNewer({ branchId: 'br_old', tenantId: TENANT, name: 'Old depot', status: 'archived', aggregateVersion: 1, updatedAt: NOW });
      const people = [
        { seat: 'OB-7KQ2MX-E0001', name: 'Sneha Reddy', branchId: 'br_hyd', status: 'active' },
        { seat: 'OB-7KQ2MX-E0002', name: 'Arjun Rao', branchId: undefined, status: 'active' },
        { seat: 'OB-7KQ2MX-E0003', name: 'Former Person', branchId: undefined, status: 'offboarded' },
      ];
      for (const p of people) {
        await seatRepo.upsertIfNewer({ seatId: p.seat, tenantId: TENANT, title: 'Sales', branchId: p.branchId, status: p.status, aggregateVersion: 1, updatedAt: NOW });
        const card = createDraftCard({ tenantId: TENANT, seatId: p.seat, slug: `acme-steels/${p.seat.toLowerCase()}`, verifiedBadge: true }, NOW);
        card.sections = card.sections.map((s) => (s.type === 'about' ? { ...s, content: { name: p.name, designation: 'Sales' } } : s));
        card.status = 'published';
        await cardRepo.save(card);
      }
    });
  });

  it('only owners and admins can change settings; over-limit catalogues are refused', async () => {
    await expect(service.updateSettings(TENANT, 'member', { products: [] })).rejects.toBeInstanceOf(ProblemError);
    const tooMany = Array.from({ length: 51 }, (_, i) => ({ id: `p${i}`, name: `Item ${i}` }));
    await expect(service.updateSettings(TENANT, 'admin', { products: tooMany })).rejects.toBeInstanceOf(CatalogueLimitError);
    const saved = await service.updateSettings(TENANT, 'owner', { products: [{ id: 'p1', name: 'TMT bars' }] });
    expect(saved.products).toHaveLength(1);
    expect(saved.limits?.maxProducts).toBe(50);
    expect((await service.getSettings(TENANT)).products[0].name).toBe('TMT bars');
  });

  it('keeps settings inside the company', async () => {
    await service.updateSettings(TENANT, 'owner', { products: [{ id: 'p1', name: 'TMT bars' }] });
    expect((await service.getSettings(OTHER)).products).toEqual([]);
  });

  it('assembles the public page: active branches with directions, current people, focused branch first', async () => {
    await service.updateSettings(TENANT, 'owner', {
      products: [{ id: 'p1', name: 'TMT bars' }],
      documents: [{ id: 'd1', title: 'Brochure', url: 'https://cdn.example.com/brochure.pdf' }],
    });
    const page = await service.getPublicProfile('acme-steels', 'br_hyd');
    expect(page.status).toBe('active');
    expect(page.company.about).toBe('Structural steel for builders.');
    expect(page.branches.map((b) => b.name)).toEqual(['Hyderabad']);
    expect(page.branches[0].directionsUrl).toContain('17.43,78.4');
    expect(page.people.map((p) => p.name)).toEqual(['Sneha Reddy', 'Arjun Rao']);
    expect(page.people[0].cardUrl).toBe('https://grid.example.test/c/acme-steels/ob-7kq2mx-e0001');
    expect(page.focusBranchId).toBe('br_hyd');
    expect(page.documents[0]).toMatchObject({ id: 'd1', title: 'Brochure', downloadUrl: '/acme-steels/documents/d1' });
    await expect(service.getPublicProfile('nobody')).rejects.toMatchObject({ status: 404 });
  });

  it('turns an enquiry into a lead on the routed person, tagged with the product', async () => {
    await service.updateSettings(TENANT, 'owner', {
      products: [{ id: 'p1', name: 'TMT bars' }],
      enquiryRouting: { defaultSeatId: 'OB-7KQ2MX-E0002', branchSeats: { br_hyd: 'OB-7KQ2MX-E0001' } },
    });
    const general = await service.submitEnquiry('acme-steels', { name: 'Rahul Mehta', phone: '9822012345', productId: 'p1', consent: true, message: 'Need 20 MT' });
    expect(general.status).toBe('created');
    expect(general.cardId).toBe('OB-7KQ2MX-E0002');
    const branch = await service.submitEnquiry('acme-steels', { name: 'Kiran Shah', phone: '9822054321', branchId: 'br_hyd', consent: true });
    expect(branch.cardId).toBe('OB-7KQ2MX-E0001');

    const leads = await TenantContext.run(TENANT, () => leadRepo.listByTenant());
    const first = leads.find((l) => l.id === general.leadId)!;
    expect(first.source).toBe('company_enquiry');
    expect(first.sourceTag).toBe('TMT bars');
    expect(JSON.stringify(first)).not.toContain('9822012345'); // stored encrypted
  });

  it('refuses enquiries without consent', async () => {
    await expect(service.submitEnquiry('acme-steels', { name: 'Rahul', phone: '9822012345', consent: false })).rejects.toThrow();
  });

  it('shows only the basic profile when the plan has lapsed', async () => {
    await service.updateSettings(TENANT, 'owner', { products: [{ id: 'p1', name: 'TMT bars' }] });
    const orgRepo = new MongoOrgReadModelRepository(handle);
    await TenantContext.run(TENANT, async () => {
      const org = await orgRepo.findByTenantId(TENANT);
      await orgRepo.upsertIfNewer({ ...org!, planStatus: 'lapsed', aggregateVersion: 2 });
    });
    const page = await service.getPublicProfile('acme-steels');
    expect(page.status).toBe('lapsed');
    expect(page.products).toEqual([]);
    expect(page.people).toEqual([]);
    expect(page.company.name).toBe('Acme Steels');
  });

  it('counts document downloads and redirects to the file', async () => {
    await service.updateSettings(TENANT, 'owner', { documents: [{ id: 'd1', title: 'Brochure', url: 'https://cdn.example.com/brochure.pdf' }] });
    expect(await service.documentUrl('acme-steels', 'd1')).toBe('https://cdn.example.com/brochure.pdf');
    await expect(service.documentUrl('acme-steels', 'missing')).rejects.toMatchObject({ status: 404 });
    const events = await handle._getInternalDb().collection('analytics_events').find({ eventType: 'document_downloaded' }).toArray();
    expect(events).toHaveLength(1);
    expect(events[0].tenantId).toBe(TENANT);
  });
});
