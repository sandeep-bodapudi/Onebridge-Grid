import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectMongo, MongoConnectionHandle, InMemoryEventBus, TenantContext } from '@onebridge/shared';
import { createApp } from '../src/app.js';
import { CardsEnvConfig } from '../src/config/env.js';
import { FakeRevalidationNotifier } from '../src/infrastructure/revalidation-notifier.js';
import { MongoCardRepository } from '../src/infrastructure/mongo-card.repository.js';
import { MongoOrgReadModelRepository, MongoSeatReadModelRepository, MongoBranchReadModelRepository } from '../src/infrastructure/mongo-read-model.repositories.js';

describe('F12: Public Cards HTTP API (GET /public/c/:slug and vCard)', () => {
  let mongod: MongoMemoryServer;
  let connectionHandle: MongoConnectionHandle;
  let app: INestApplication;
  let eventBus: InMemoryEventBus;
  let revalidationNotifier: FakeRevalidationNotifier;
  let cardRepo: MongoCardRepository;
  let orgRepo: MongoOrgReadModelRepository;
  let seatRepo: MongoSeatReadModelRepository;
  let branchRepo: MongoBranchReadModelRepository;

  const TENANT_A = '01JACTENANTA00000000000000';
  const TENANT_B = '01JACTENANTB00000000000000';

  const testConfig: CardsEnvConfig = {
    nodeEnv: 'test',
    port: 4015,
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
    revalidationNotifier = new FakeRevalidationNotifier();

    cardRepo = new MongoCardRepository(connectionHandle);
    orgRepo = new MongoOrgReadModelRepository(connectionHandle);
    seatRepo = new MongoSeatReadModelRepository(connectionHandle);
    branchRepo = new MongoBranchReadModelRepository(connectionHandle);
    app = await createApp({
      envConfig: testConfig,
      connectionHandle,
      eventBus,
      revalidationNotifier,
    });
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
    if (connectionHandle) await connectionHandle.close();
    if (mongod) await mongod.stop();
  });

  it('provisions published card with org, seat, and branch read models and resolves GET /public/c/:slug', async () => {
    const seatId = 'OB-7KQ2MX-E0001';
    const slug = 'acme-steels/sneha-reddy';

    // 1. Ingest Org Read Model
    await TenantContext.run(TENANT_A, async () => {
      await orgRepo.upsertIfNewer({
        tenantId: TENANT_A,
        businessId: 'OB-7KQ2MX',
        name: 'Acme Steels',
        slug: 'acme-steels',
        logo: 'https://cdn.onebridge.in/logos/acme.png',
        brandColours: { band: '#1B2A4A', accent: '#F68713', text: '#FFFFFF' },
        verifiedBadge: true,
        aggregateVersion: 1,
        updatedAt: new Date().toISOString(),
      });

      // 2. Ingest Branch Read Model
      await branchRepo.upsertIfNewer({
        branchId: 'branch_jubilee',
        tenantId: TENANT_A,
        name: 'Jubilee Hills Branch',
        address: 'Road No. 36, Jubilee Hills, Hyderabad',
        mapPin: { lat: 17.432, lng: 78.407 },
        status: 'active',
        aggregateVersion: 1,
        updatedAt: new Date().toISOString(),
      });

      // 3. Ingest Seat Read Model
      await seatRepo.upsertIfNewer({
        seatId,
        tenantId: TENANT_A,
        title: 'Senior Sales Executive',
        branchId: 'branch_jubilee',
        personId: 'person_sneha',
        status: 'active',
        aggregateVersion: 1,
        updatedAt: new Date().toISOString(),
      });

      // 4. Save Published Card
      await cardRepo.save({
        id: seatId,
        tenantId: TENANT_A,
        ownerType: 'seat',
        ownerId: seatId,
        slug,
        templateId: 'classic-charcoal',
        status: 'published',
        language: 'en',
        verifiedBadge: true,
        approvalRequired: false,
        sections: [
          {
            type: 'about',
            enabled: true,
            order: 0,
            locked: false,
            visibility: 'public',
            content: {
              name: 'Sneha Reddy',
              designation: 'Senior Sales Executive',
              phone: '+919876543210',
              email: 'sneha@acmesteels.com',
              photoUrl: 'https://cdn.onebridge.in/photos/sneha.jpg',
              bio: 'TMT bar specialist',
            },
          },
          {
            type: 'products',
            enabled: true,
            order: 1,
            locked: false,
            visibility: 'public',
            content: { items: [{ name: 'Fe-550D TMT Bars' }] },
          },
          {
            type: 'social_links',
            enabled: true,
            order: 2,
            locked: false,
            visibility: 'internal', // internal section should be filtered out from public view
            content: { internalSlack: '#sales-hyderabad' },
          },
        ],
        aggregateVersion: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    // Request public card
    const res = await request(app.getHttpServer()).get(`/public/c/${slug}`);
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe(slug);
    expect(res.body.status).toBe('published');
    expect(res.body.verifiedBadge).toBe(true);

    // Person details
    expect(res.body.person.name).toBe('Sneha Reddy');
    expect(res.body.person.designation).toBe('Senior Sales Executive');
    expect(res.body.person.phone).toBe('+919876543210');
    expect(res.body.person.email).toBe('sneha@acmesteels.com');
    expect(res.body.person.photoUrl).toBe('https://cdn.onebridge.in/photos/sneha.jpg');

    // Company & branch
    expect(res.body.company.name).toBe('Acme Steels');
    expect(res.body.company.businessId).toBe('OB-7KQ2MX');
    expect(res.body.branch.name).toBe('Jubilee Hills Branch');

    // Sections: public included, internal omitted
    const sectionTypes = res.body.sections.map((s: { type: string }) => s.type);
    expect(sectionTypes).toContain('about');
    expect(sectionTypes).toContain('products');
    expect(sectionTypes).not.toContain('social_links');

    // Action links
    expect(res.body.actions.saveContactUrl).toBe(`/c/${slug}/vcard`);
    expect(res.body.actions.whatsappUrl).toContain('wa.me/919876543210');
    expect(res.body.actions.callUrl).toBe('tel:+919876543210');
    expect(res.body.actions.emailUrl).toBe('mailto:sneha@acmesteels.com');
  });

  it('downloads standard vCard 3.0 via GET /public/c/:slug/vcard with card URL in notes', async () => {
    const slug = 'acme-steels/sneha-reddy';
    const res = await request(app.getHttpServer()).get(`/public/c/${slug}/vcard`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/vcard');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain('.vcf');
    expect(res.text).toContain('BEGIN:VCARD');
    expect(res.text).toContain('FN:Sneha Reddy');
    expect(res.text).toContain('ORG:Acme Steels');
    expect(res.text).toContain('TEL;TYPE=CELL,VOICE:+919876543210');
    expect(res.text).toContain('URL:http://localhost:3001/c/acme-steels/sneha-reddy');
    expect(res.text.replace(/\r\n /g, '')).toContain('NOTE:TMT bar specialist\\n\\nCard: http://localhost:3001/c/acme-steels/sneha-reddy');
    expect(res.text).toContain('END:VCARD');
  });

  it('sanitizes response and leaks zero personal data when card is inactive', async () => {
    const seatId = 'OB-7KQ2MX-E0002';
    const slug = 'acme-steels/inactive-employee';

    await TenantContext.run(TENANT_A, async () => {
      await cardRepo.save({
        id: seatId,
        tenantId: TENANT_A,
        ownerType: 'seat',
        ownerId: seatId,
        slug,
        templateId: 'classic-charcoal',
        status: 'draft', // Not published!
        language: 'en',
        verifiedBadge: false,
        approvalRequired: false,
        sections: [
          {
            type: 'about',
            enabled: true,
            order: 0,
            locked: false,
            visibility: 'public',
            content: { name: 'Private Person', phone: '+919999999999', email: 'secret@acme.com' },
          },
        ],
        aggregateVersion: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    const res = await request(app.getHttpServer()).get(`/public/c/${slug}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('inactive');
    expect(res.body.person).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('Private Person');
    expect(JSON.stringify(res.body)).not.toContain('+919999999999');
    expect(JSON.stringify(res.body)).not.toContain('secret@acme.com');
  });

  it('renders offboarded employee state when seat status is offboarded', async () => {
    const seatId = 'OB-7KQ2MX-E0003';
    const slug = 'acme-steels/rajesh-iyer';

    await TenantContext.run(TENANT_A, async () => {
      await seatRepo.upsertIfNewer({
        seatId,
        tenantId: TENANT_A,
        title: 'Regional Manager',
        status: 'offboarded',
        aggregateVersion: 1,
        updatedAt: new Date().toISOString(),
      });

      await cardRepo.save({
        id: seatId,
        tenantId: TENANT_A,
        ownerType: 'seat',
        ownerId: seatId,
        slug,
        templateId: 'classic-charcoal',
        status: 'published',
        language: 'en',
        verifiedBadge: true,
        approvalRequired: false,
        sections: [
          {
            type: 'about',
            enabled: true,
            order: 0,
            locked: false,
            visibility: 'public',
            content: { name: 'Rajesh Iyer' },
          },
        ],
        aggregateVersion: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    const res = await request(app.getHttpServer()).get(`/public/c/${slug}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('offboarded');
    expect(res.body.offboardedDetails.personName).toBe('Rajesh Iyer');
  });

  it('returns 404 Problem Details when slug does not exist', async () => {
    const res = await request(app.getHttpServer()).get('/public/c/non-existent-company/random-card');
    expect(res.status).toBe(404);
    expect(res.body.type).toBe('https://tools.ietf.org/html/rfc7807');
    expect(res.body.title).toBe('Not Found');
  });

  it('cross-tenant isolation: card lookup is strictly read-only and isolated per tenant internally', async () => {
    const seatIdB = 'OB-8ZZZZZ-E0001';
    const slugB = 'beta-corp/tarun-sharma';

    await TenantContext.run(TENANT_B, async () => {
      await orgRepo.upsertIfNewer({
        tenantId: TENANT_B,
        businessId: 'OB-8ZZZZZ',
        name: 'Beta Corp',
        slug: 'beta-corp',
        verifiedBadge: false,
        aggregateVersion: 1,
        updatedAt: new Date().toISOString(),
      });

      await cardRepo.save({
        id: seatIdB,
        tenantId: TENANT_B,
        ownerType: 'seat',
        ownerId: seatIdB,
        slug: slugB,
        templateId: 'paper-light',
        status: 'published',
        language: 'en',
        verifiedBadge: false,
        approvalRequired: false,
        sections: [
          {
            type: 'about',
            enabled: true,
            order: 0,
            locked: false,
            visibility: 'public',
            content: { name: 'Tarun Sharma' },
          },
        ],
        aggregateVersion: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    // Public lookup for Tenant B's card returns Tenant B's company
    const resB = await request(app.getHttpServer()).get(`/public/c/${slugB}`);
    expect(resB.status).toBe(200);
    expect(resB.body.company.name).toBe('Beta Corp');

    // Private authenticated endpoint for Tenant A cannot read Tenant B's card
    const privateRes = await request(app.getHttpServer())
      .get(`/cards/${seatIdB}`)
      .set('X-Tenant-Id', TENANT_A);
    expect(privateRes.status).toBe(404);
  });
});
