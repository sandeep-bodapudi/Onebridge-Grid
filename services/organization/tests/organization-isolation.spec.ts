import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectMongo, MongoConnectionHandle, TenantContext, TenantIsolationError } from '@onebridge/shared';
import { MongoOrganizationRepository } from '../src/infrastructure/mongo-organization.repository.js';
import { OrganizationProps } from '../src/domain/organization.js';

describe('Cross-Tenant Isolation Tests: Organization Repository (AGENTS.md Section 3)', () => {
  let mongod: MongoMemoryServer;
  let handle: MongoConnectionHandle;
  let orgRepo: MongoOrganizationRepository;

  const TENANT_A = '01JACTENANTA00000000000000';
  const TENANT_B = '01JACTENANTB00000000000000';

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    handle = await connectMongo(mongod.getUri(), 'test_org_isolation');
    orgRepo = new MongoOrganizationRepository(handle);
  }, 120000);

  afterAll(async () => {
    if (handle) await handle.close();
    if (mongod) await mongod.stop();
  });

  beforeEach(async () => {
    await handle._getInternalDb().collection('organizations').deleteMany({});
  });

  it('prevents any query without tenant context from executing', async () => {
    await expect(orgRepo.findById('any_id')).rejects.toThrow(TenantIsolationError);
  });

  it('strictly isolates findById between tenants', async () => {
    const orgA: OrganizationProps = {
      id: TENANT_A,
      tenantId: TENANT_A,
      businessId: 'OB-7KQ2MX',
      name: 'Alpha Corp',
      slug: 'alpha-corp',
      previousSlugs: [],
      industry: 'IT',
      size: '1-10',
      city: 'Delhi',
      plan: 'starter',
      verifiedBadge: false,
      onboardingStartedAt: new Date().toISOString(),
      aggregateVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save under Tenant A context
    await TenantContext.run(TENANT_A, async () => {
      await orgRepo.save(orgA);
      const fetched = await orgRepo.findById(TENANT_A);
      expect(fetched).not.toBeNull();
      expect(fetched?.name).toBe('Alpha Corp');
    });

    // Query under Tenant B context cannot see Tenant A's document
    await TenantContext.run(TENANT_B, async () => {
      const fetched = await orgRepo.findById(TENANT_A);
      expect(fetched).toBeNull();
    });
  });

  it('prevents cross-tenant update attempts', async () => {
    const orgA: OrganizationProps = {
      id: TENANT_A,
      tenantId: TENANT_A,
      businessId: 'OB-7KQ2MX',
      name: 'Alpha Corp',
      slug: 'alpha-corp',
      previousSlugs: [],
      industry: 'IT',
      size: '1-10',
      city: 'Delhi',
      plan: 'starter',
      verifiedBadge: false,
      onboardingStartedAt: new Date().toISOString(),
      aggregateVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await TenantContext.run(TENANT_A, async () => {
      await orgRepo.save(orgA);
    });

    // Tenant B attempts to update Tenant A's document
    await TenantContext.run(TENANT_B, async () => {
      const hijacked: OrganizationProps = {
        ...orgA,
        name: 'Hijacked by B',
      };
      await expect(orgRepo.save(hijacked)).rejects.toThrow(TenantIsolationError);
    });

    // Verify Tenant A data remains unchanged
    await TenantContext.run(TENANT_A, async () => {
      const verified = await orgRepo.findById(TENANT_A);
      expect(verified?.name).toBe('Alpha Corp');
    });
  });

  it('prevents cross-tenant writes with mismatched tenantId', async () => {
    await TenantContext.run(TENANT_B, async () => {
      const mismatched: OrganizationProps = {
        id: TENANT_B,
        tenantId: TENANT_A, // Attempting to write into Tenant A from Tenant B context
        businessId: 'OB-999999',
        name: 'Malicious Org',
        slug: 'malicious-org',
        previousSlugs: [],
        industry: 'IT',
        size: '1-10',
        city: 'Delhi',
        plan: 'starter',
        verifiedBadge: false,
        onboardingStartedAt: new Date().toISOString(),
        aggregateVersion: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await expect(orgRepo.save(mismatched)).rejects.toThrow(TenantIsolationError);
    });
  });
});
