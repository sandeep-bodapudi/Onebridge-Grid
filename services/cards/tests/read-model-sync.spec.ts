import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ulid } from 'ulid';
import { connectMongo, MongoConnectionHandle, InMemoryEventBus, DomainEvent, TenantContext } from '@onebridge/shared';
import { MongoCardRepository } from '../src/infrastructure/mongo-card.repository.js';
import {
  MongoOrgReadModelRepository,
  MongoSeatReadModelRepository,
  MongoBranchReadModelRepository,
} from '../src/infrastructure/mongo-read-model.repositories.js';
import { CardsService } from '../src/application/cards.service.js';
import { ReadModelSyncService } from '../src/application/read-model-sync.service.js';
import { FakeRevalidationNotifier } from '../src/infrastructure/revalidation-notifier.js';

describe('ADR-0003: Cards read-model sync (direct, no HTTP)', () => {
  let mongod: MongoMemoryServer;
  let connectionHandle: MongoConnectionHandle;
  let orgRepo: MongoOrgReadModelRepository;
  let seatRepo: MongoSeatReadModelRepository;
  let branchRepo: MongoBranchReadModelRepository;
  let cardRepo: MongoCardRepository;
  let cardsService: CardsService;
  let sync: ReadModelSyncService;
  let bus: InMemoryEventBus;
  let revalidationNotifier: FakeRevalidationNotifier;

  const TENANT = '01JBCTENANTC00000000000000';

  function evt(type: string, payload: Record<string, unknown>, aggregateVersion = 1): DomainEvent {
    return {
      eventId: ulid(),
      type,
      version: '1.0.0',
      tenantId: TENANT,
      occurredAt: new Date().toISOString(),
      correlationId: 'corr',
      aggregateVersion,
      payload,
    };
  }

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    connectionHandle = await connectMongo(mongod.getUri());

    orgRepo = new MongoOrgReadModelRepository(connectionHandle);
    seatRepo = new MongoSeatReadModelRepository(connectionHandle);
    branchRepo = new MongoBranchReadModelRepository(connectionHandle);
    cardRepo = new MongoCardRepository(connectionHandle);
    revalidationNotifier = new FakeRevalidationNotifier();

    cardsService = new CardsService(cardRepo, orgRepo, seatRepo, { publish: async () => {} }, revalidationNotifier);
    sync = new ReadModelSyncService(orgRepo, seatRepo, branchRepo, cardsService, revalidationNotifier);

    bus = new InMemoryEventBus();
    sync.registerSubscriptions(bus);
  }, 120000);

  afterAll(async () => {
    if (mongod) await mongod.stop();
  });

  it('org.created seeds the org read model', async () => {
    await bus.publish(evt('org.created', { orgId: TENANT, businessId: 'OB-AAAAAA', name: 'Initial Name', slug: 'initial-slug' }, 1));

    const model = await TenantContext.run(TENANT, () => orgRepo.findByTenantId(TENANT));
    expect(model?.name).toBe('Initial Name');
    expect(model?.slug).toBe('initial-slug');
  });

  it('org.updated with a higher aggregateVersion patches the name via updatedFields', async () => {
    await bus.publish(evt('org.updated', { orgId: TENANT, businessId: 'OB-AAAAAA', updatedFields: { name: 'Renamed Co' } }, 2));

    const model = await TenantContext.run(TENANT, () => orgRepo.findByTenantId(TENANT));
    expect(model?.name).toBe('Renamed Co');
    expect(model?.slug).toBe('initial-slug'); // untouched
  });

  it('a stale org event (lower or equal aggregateVersion) is ignored', async () => {
    await bus.publish(evt('org.updated', { orgId: TENANT, updatedFields: { name: 'Should Not Apply' } }, 1)); // stale: version 1 < stored 2

    const model = await TenantContext.run(TENANT, () => orgRepo.findByTenantId(TENANT));
    expect(model?.name).toBe('Renamed Co');
  });

  it('org.branding_updated patches logo/brandColours without touching name/slug', async () => {
    await bus.publish(
      evt(
        'org.branding_updated',
        { orgId: TENANT, businessId: 'OB-AAAAAA', logo: 'https://cdn/logo.png', brandColours: { band: '#1F4E9A', text: '#FFFFFF' } },
        3
      )
    );

    const model = await TenantContext.run(TENANT, () => orgRepo.findByTenantId(TENANT));
    expect(model?.logo).toBe('https://cdn/logo.png');
    expect(model?.brandColours?.band).toBe('#1F4E9A');
    expect(model?.name).toBe('Renamed Co');
  });

  it('branch.created then branch.archived updates the branch read model status', async () => {
    await bus.publish(evt('branch.created', { orgId: TENANT, branchId: 'OB-AAAAAA-B01', name: 'HQ' }));
    let branch = await TenantContext.run(TENANT, () => branchRepo.findByBranchId('OB-AAAAAA-B01'));
    expect(branch?.name).toBe('HQ');
    expect(branch?.status).toBe('active');

    await bus.publish(evt('branch.archived', { orgId: TENANT, branchId: 'OB-AAAAAA-B01' }));
    branch = await TenantContext.run(TENANT, () => branchRepo.findByBranchId('OB-AAAAAA-B01'));
    expect(branch?.status).toBe('archived');
  });

  it('seat.created provisions the seat read model and a draft card in one consumer pass', async () => {
    await bus.publish(evt('seat.created', { orgId: TENANT, seatId: 'OB-AAAAAA-E0001', title: 'Owner', personId: 'person_x', status: 'active' }));

    const seat = await TenantContext.run(TENANT, () => seatRepo.findBySeatId('OB-AAAAAA-E0001'));
    expect(seat?.personId).toBe('person_x');

    const card = await cardsService.getCard(TENANT, 'OB-AAAAAA-E0001');
    expect(card.status).toBe('draft');
  });

  it('seat.status_changed (offboarding) updates the seat read model status', async () => {
    await bus.publish(evt('seat.status_changed', { orgId: TENANT, seatId: 'OB-AAAAAA-E0001', previousStatus: 'active', newStatus: 'offboarded' }));

    const seat = await TenantContext.run(TENANT, () => seatRepo.findBySeatId('OB-AAAAAA-E0001'));
    expect(seat?.status).toBe('offboarded');

    // The card itself is untouched by this consumer; redirect/deactivate on
    // offboarding is F16 (Step 4), out of scope for F10.
    const card = await cardsService.getCard(TENANT, 'OB-AAAAAA-E0001');
    expect(card.status).toBe('draft');
  });

  it('kyb.status_changed updates org read model verifiedBadge and revalidates published cards', async () => {
    // First, publish a card for this tenant so revalidation has a target
    await cardsService.publishCard(TENANT, 'OB-AAAAAA-E0001', { personId: 'person_x', role: 'owner' });
    const callsBefore = revalidationNotifier.calls.length;

    await bus.publish(evt('kyb.status_changed', { orgId: TENANT, status: 'verified' }, 4));

    const model = await TenantContext.run(TENANT, () => orgRepo.findByTenantId(TENANT));
    expect(model?.verifiedBadge).toBe(true);
    expect(revalidationNotifier.calls.length).toBeGreaterThan(callsBefore);
  });

  it('org.updated syncs cardApprovalRequired company setting', async () => {
    await bus.publish(evt('org.updated', { orgId: TENANT, updatedFields: { cardApprovalRequired: true } }, 5));

    const model = await TenantContext.run(TENANT, () => orgRepo.findByTenantId(TENANT));
    expect(model?.cardApprovalRequired).toBe(true);
  });
});
