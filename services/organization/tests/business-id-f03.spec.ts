import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { FakeEventBus, TenantContext, connectMongo, MongoConnectionHandle } from '@onebridge/shared';
import { OrganizationService } from '../src/application/organization.service.js';
import { MongoOrganizationRepository } from '../src/infrastructure/mongo-organization.repository.js';
import { MongoIssuedIdRepository } from '../src/infrastructure/mongo-issued-id.repository.js';
import { MongoCounterRepository } from '../src/infrastructure/mongo-counter.repository.js';
import { CounterService } from '../src/application/counter.service.js';
import { IdentityInternalClient } from '../src/infrastructure/identity-internal.client.js';

describe('Feature F03: OneBridge Business ID & Derived IDs', () => {
  let mongod: MongoMemoryServer;
  let handle: MongoConnectionHandle;
  let orgRepo: MongoOrganizationRepository;
  let issuedIdRepo: MongoIssuedIdRepository;
  let counterRepo: MongoCounterRepository;
  let counterService: CounterService;
  let orgService: OrganizationService;
  let fakeEventBus: FakeEventBus;
  let mockIdentityClient: IdentityInternalClient;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    handle = await connectMongo(mongod.getUri(), 'onebridge_f03_test');

    orgRepo = new MongoOrganizationRepository(handle);
    issuedIdRepo = new MongoIssuedIdRepository(handle);
    counterRepo = new MongoCounterRepository(handle);

    await orgRepo.createIndexes();
    await issuedIdRepo.createIndexes();
    await counterRepo.createIndexes();
  }, 120000);

  afterAll(async () => {
    if (handle) await handle.close();
    if (mongod) await mongod.stop();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    await handle._getInternalDb().collection('organizations').deleteMany({});
    await handle._getInternalDb().collection('issued_id_registries').deleteMany({});
    await handle._getInternalDb().collection('counters').deleteMany({});

    fakeEventBus = new FakeEventBus();
    mockIdentityClient = {
      createMembership: vi.fn().mockResolvedValue({ id: 'mem_1', role: 'owner' }),
    } as unknown as IdentityInternalClient;

    counterService = new CounterService(counterRepo, orgRepo);
    orgService = new OrganizationService(
      orgRepo,
      issuedIdRepo,
      mockIdentityClient,
      fakeEventBus,
      counterService
    );
  });

  describe('AC-1: Business ID Format, Uniqueness, Immutability & Non-Reuse', () => {
    it('asserts Business ID uniqueness across concurrent creations (AC-1)', async () => {
      const concurrency = 20;
      const promises = Array.from({ length: concurrency }).map((_, idx) =>
        orgService.createOrganization({
          name: `Concurrent Company ${idx}`,
          industry: 'Technology',
          size: '1-10',
          city: 'Hyderabad',
          creatorPersonId: `user_${idx}`,
          slug: `concurrent-company-${idx}`,
        })
      );

      const results = await Promise.all(promises);
      const businessIds = results.map((r) => r.businessId);
      const uniqueIds = new Set(businessIds);

      expect(uniqueIds.size).toBe(concurrency);
      for (const id of businessIds) {
        expect(id).toMatch(/^OB-[0-9A-HJKMNP-TV-Z]{6}$/);
      }
    });

    it('asserts Business ID is immutable and cannot be updated via PATCH /orgs/:id (AC-1)', async () => {
      const org = await orgService.createOrganization({
        name: 'Immutable Org',
        industry: 'Logistics',
        size: '11-50',
        city: 'Mumbai',
        creatorPersonId: 'person_immut',
      });

      const originalBusinessId = org.businessId;

      // Caller attempts to patch businessId
      const updated = await TenantContext.run(org.id, () =>
        orgService.updateOrganization(
          org.id,
          {
            name: 'Immutable Org Renamed',
            // @ts-expect-error simulating malicious uncontracted payload
            businessId: 'OB-HACK01',
          },
          { role: 'owner', personId: 'person_immut' }
        )
      );

      expect(updated.businessId).toBe(originalBusinessId);
      expect(updated.businessId).not.toBe('OB-HACK01');

      const reloaded = await TenantContext.run(org.id, () => orgRepo.findById(org.id));
      expect(reloaded?.businessId).toBe(originalBusinessId);
    });

    it('asserts Business ID is never reused even after organization deletion (AC-1)', async () => {
      const org = await orgService.createOrganization({
        name: 'Transient Org',
        industry: 'Retail',
        size: '1-10',
        city: 'Delhi',
        creatorPersonId: 'person_del',
      });

      const issuedBusinessId = org.businessId;

      // Simulate soft-deletion or deletion of organization
      await handle._getInternalDb().collection('organizations').deleteOne({ id: org.id });

      // Registry must STILL contain the issued ID
      const registryEntry = await handle
        ._getInternalDb()
        .collection('issued_id_registries')
        .findOne({ businessId: issuedBusinessId });

      expect(registryEntry).not.toBeNull();
      expect(registryEntry?.businessId).toBe(issuedBusinessId);
      expect(registryEntry?.status).toBe('issued');

      // Attempting to claim the exact same ID for a new tenant must fail with collision
      const claimResult = await issuedIdRepo.claimId(issuedBusinessId, 'tenant_other');
      expect(claimResult).toBe(false);
    });
  });

  describe('AC-2: Minting & Safe Collision Retry', () => {
    it('retries safely up to 5 times when candidate Business ID collides (AC-2)', async () => {
      let attempts = 0;
      const originalClaim = issuedIdRepo.claimId.bind(issuedIdRepo);

      // Force first 2 attempts to collide
      vi.spyOn(issuedIdRepo, 'claimId').mockImplementation(async (id, tenantId) => {
        attempts++;
        if (attempts <= 2) {
          return false; // Collision
        }
        return originalClaim(id, tenantId);
      });

      const org = await orgService.createOrganization({
        name: 'Collision Retry Org',
        industry: 'Education',
        size: '1-10',
        city: 'Pune',
        creatorPersonId: 'person_col',
      });

      expect(attempts).toBe(3);
      expect(org.businessId).toMatch(/^OB-[0-9A-HJKMNP-TV-Z]{6}$/);
    });

    it('throws 503 Service Unavailable when 5 collision retries are exhausted (AC-2)', async () => {
      vi.spyOn(issuedIdRepo, 'claimId').mockResolvedValue(false); // Always collide

      await expect(
        orgService.createOrganization({
          name: 'Unlucky Org',
          industry: 'Finance',
          size: '1-10',
          city: 'Chennai',
          creatorPersonId: 'person_unlucky',
        })
      ).rejects.toThrowError(/exhausted collision retry budget/);
    });
  });

  describe('AC-4: Derived IDs and Monotonic Counter Documents', () => {
    it('generates derived IDs with -B01, -D01, -E0001 format and monotonic increment (AC-4)', async () => {
      const org = await orgService.createOrganization({
        name: 'Structure Org',
        industry: 'Consulting',
        size: '50-100',
        city: 'Bengaluru',
        creatorPersonId: 'person_struct',
      });

      const branch1 = await counterService.generateDerivedId(org.id, 'branch');
      const branch2 = await counterService.generateDerivedId(org.id, 'branch');
      const branch3 = await counterService.generateDerivedId(org.id, 'branch');

      expect(branch1).toBe(`${org.businessId}-B01`);
      expect(branch2).toBe(`${org.businessId}-B02`);
      expect(branch3).toBe(`${org.businessId}-B03`);

      const dept1 = await counterService.generateDerivedId(org.id, 'department');
      const dept2 = await counterService.generateDerivedId(org.id, 'department');
      expect(dept1).toBe(`${org.businessId}-D01`);
      expect(dept2).toBe(`${org.businessId}-D02`);

      const seat1 = await counterService.generateDerivedId(org.id, 'seat');
      const seat2 = await counterService.generateDerivedId(org.id, 'seat');
      expect(seat1).toBe(`${org.businessId}-E0001`);
      expect(seat2).toBe(`${org.businessId}-E0002`);
    });

    it('counters never reuse a number even if an entity is deleted or skipped (AC-4)', async () => {
      const org = await orgService.createOrganization({
        name: 'No Reuse Org',
        industry: 'Manufacturing',
        size: '10-20',
        city: 'Ahmedabad',
        creatorPersonId: 'person_noreuse',
      });

      const branch1 = await counterService.generateDerivedId(org.id, 'branch');
      expect(branch1).toBe(`${org.businessId}-B01`);

      // Branch 1 is "deleted" or discarded
      // Generating next branch MUST return -B02, NEVER reusing -B01
      const branch2 = await counterService.generateDerivedId(org.id, 'branch');
      expect(branch2).toBe(`${org.businessId}-B02`);
      expect(branch2).not.toBe(branch1);
    });

    it('generates unique derived IDs under high concurrency (AC-4)', async () => {
      const org = await orgService.createOrganization({
        name: 'Concurrent Seat Org',
        industry: 'Tech',
        size: '100+',
        city: 'Hyderabad',
        creatorPersonId: 'person_seats',
      });

      const promises = Array.from({ length: 30 }).map(() =>
        counterService.generateDerivedId(org.id, 'seat')
      );

      const seatIds = await Promise.all(promises);
      const uniqueSeats = new Set(seatIds);

      expect(uniqueSeats.size).toBe(30);
      for (let i = 1; i <= 30; i++) {
        const expected = `${org.businessId}-E${String(i).padStart(4, '0')}`;
        expect(uniqueSeats.has(expected)).toBe(true);
      }
    });

    it('cross-tenant isolation: counters for tenant A do not leak into tenant B (AC-4)', async () => {
      const orgA = await orgService.createOrganization({
        name: 'Company Alpha',
        industry: 'Tech',
        size: '1-10',
        city: 'Noida',
        creatorPersonId: 'person_alpha',
        slug: 'company-alpha',
      });

      const orgB = await orgService.createOrganization({
        name: 'Company Beta',
        industry: 'Tech',
        size: '1-10',
        city: 'Gurugram',
        creatorPersonId: 'person_beta',
        slug: 'company-beta',
      });

      // Advance Company Alpha to 5 branches
      for (let i = 0; i < 5; i++) {
        await counterService.generateDerivedId(orgA.id, 'branch');
      }

      // Company Beta's first branch MUST be -B01, not affected by Company Alpha
      const betaBranch1 = await counterService.generateDerivedId(orgB.id, 'branch');
      expect(betaBranch1).toBe(`${orgB.businessId}-B01`);

      // Company Alpha's 6th branch is -B06
      const alphaBranch6 = await counterService.generateDerivedId(orgA.id, 'branch');
      expect(alphaBranch6).toBe(`${orgA.businessId}-B06`);
    });

    it('verifies unique compound index on counters collection enforces { tenantId: 1, type: 1 } uniqueness', async () => {
      const db = handle._getInternalDb();
      const indexes = await db.collection('counters').indexes();
      const uniqueCompoundIndex = indexes.find(
        (idx) => idx.key && idx.key.tenantId === 1 && idx.key.type === 1 && idx.unique === true
      );
      expect(uniqueCompoundIndex).toBeDefined();

      // Test unique constraint rejection on direct duplicate insert
      await db.collection('counters').insertOne({
        id: 'c1',
        tenantId: 'tenant_idx_test',
        type: 'branch',
        seq: 1,
        updatedAt: new Date().toISOString(),
      });

      await expect(
        db.collection('counters').insertOne({
          id: 'c2',
          tenantId: 'tenant_idx_test',
          type: 'branch',
          seq: 2,
          updatedAt: new Date().toISOString(),
        })
      ).rejects.toThrow(/duplicate key/);
    });
  });
});
