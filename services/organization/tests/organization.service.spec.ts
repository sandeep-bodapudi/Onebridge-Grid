import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrganizationService } from '../src/application/organization.service.js';
import { FakeEventBus } from '@onebridge/shared';
import { OrganizationProps } from '../src/domain/organization.js';
import { MongoOrganizationRepository } from '../src/infrastructure/mongo-organization.repository.js';
import { MongoIssuedIdRepository } from '../src/infrastructure/mongo-issued-id.repository.js';
import { IdentityInternalClient } from '../src/infrastructure/identity-internal.client.js';

describe('OrganizationService (F06 Unit Tests)', () => {
  let orgService: OrganizationService;
  let fakeEventBus: FakeEventBus;
  let mockIdentityClient: {
    createMembership: ReturnType<typeof vi.fn>;
  };
  let mockOrgRepo: {
    save: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findBySlug: ReturnType<typeof vi.fn>;
    findByAnySlug: ReturnType<typeof vi.fn>;
  };
  let mockIssuedIdRepo: {
    claimId: ReturnType<typeof vi.fn>;
    voidId: ReturnType<typeof vi.fn>;
    isClaimed: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    fakeEventBus = new FakeEventBus();
    mockIdentityClient = {
      createMembership: vi.fn().mockResolvedValue({ id: 'mem_1', role: 'owner' }),
    };
    mockOrgRepo = {
      save: vi.fn().mockImplementation(async (org: OrganizationProps) => org),
      findById: vi.fn(),
      findBySlug: vi.fn(),
      findByAnySlug: vi.fn(),
    };
    mockIssuedIdRepo = {
      claimId: vi.fn().mockResolvedValue(true),
      voidId: vi.fn().mockResolvedValue(true),
      isClaimed: vi.fn().mockResolvedValue(false),
    };

    orgService = new OrganizationService(
      mockOrgRepo as unknown as MongoOrganizationRepository,
      mockIssuedIdRepo as unknown as MongoIssuedIdRepository,
      mockIdentityClient as unknown as IdentityInternalClient,
      fakeEventBus
    );
  });

  describe('AC-1: Minting IDs & Synchronous Owner Membership Creation', () => {
    it('creates company, mints tenantId (ULID) and businessId (OB-XXXXXX), and creates Owner membership in Identity', async () => {
      const result = await orgService.createOrganization({
        name: 'Acme Corp',
        creatorPersonId: 'person_123',
        industry: 'IT & Software',
        size: '11-50',
        city: 'Bengaluru',
      });

      expect(result.id).toBeDefined();
      expect(result.id.length).toBe(26); // ULID
      expect(result.businessId).toMatch(/^OB-[0-9A-HJKMNP-TV-Z]{6}$/);
      expect(result.name).toBe('Acme Corp');
      expect(result.slug).toBe('acme-corp');
      expect(result.plan).toBe('starter');

      // Assert synchronous call to Identity's internal API
      expect(mockIdentityClient.createMembership).toHaveBeenCalledWith({
        personId: 'person_123',
        orgId: result.id,
        role: 'owner',
      });

      // Assert event emitted
      const createdCall = fakeEventBus.calls.find(
        (c) => (c.args as { event?: { type?: string } } | undefined)?.event?.type === 'org.created'
      );
      expect(createdCall).toBeDefined();
      const createdPayload = (
        createdCall?.args as { event?: { payload?: { orgId?: string; businessId?: string } } } | undefined
      )?.event?.payload;
      expect(createdPayload?.orgId).toBe(result.id);
      expect(createdPayload?.businessId).toBe(result.businessId);
    });

    it('rolls back and fails with 503 if synchronous call to Identity fails', async () => {
      mockIdentityClient.createMembership.mockRejectedValueOnce(new Error('Identity service offline'));

      await expect(
        orgService.createOrganization({
          name: 'Fail Corp',
          creatorPersonId: 'person_999',
          industry: 'Retail',
          size: '1-10',
          city: 'Mumbai',
        })
      ).rejects.toThrow(/Service Unavailable/i);

      expect(mockIssuedIdRepo.voidId).toHaveBeenCalled();
    });

    it('retries on Business ID collision up to 5 times', async () => {
      // First 2 collisions, then success
      mockIssuedIdRepo.claimId
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const result = await orgService.createOrganization({
        name: 'Retry Corp',
        creatorPersonId: 'person_123',
        industry: 'Manufacturing',
        size: '51-200',
        city: 'Pune',
      });

      expect(mockIssuedIdRepo.claimId).toHaveBeenCalledTimes(3);
      expect(result.businessId).toBeDefined();
    });

    it('fails with 503 if Business ID collisions exhaust 5 retries', async () => {
      mockIssuedIdRepo.claimId.mockResolvedValue(false);

      await expect(
        orgService.createOrganization({
          name: 'Collision Corp',
          creatorPersonId: 'person_123',
          industry: 'Manufacturing',
          size: '51-200',
          city: 'Pune',
        })
      ).rejects.toThrow(/exhausted/i);
    });
  });

  describe('AC-2 & AC-3: Profile Fields, GSTIN Validation, and Edits', () => {
    it('accepts optional GSTIN at signup if valid', async () => {
      const result = await orgService.createOrganization({
        name: 'Valid GSTIN Corp',
        creatorPersonId: 'person_123',
        industry: 'Healthcare',
        size: '1-10',
        city: 'Hyderabad',
        gstin: '29ABCDE1234F1Z5',
      });

      expect(result.gstin).toBe('29ABCDE1234F1Z5');
      expect(result.verifiedBadge).toBe(false); // KYB review in F25 required
    });

    it('rejects invalid GSTIN format with an error', async () => {
      await expect(
        orgService.createOrganization({
          name: 'Bad GSTIN Corp',
          creatorPersonId: 'person_123',
          industry: 'Healthcare',
          size: '1-10',
          city: 'Hyderabad',
          gstin: '29INVALIDPAN1Z5',
        })
      ).rejects.toThrow(/Invalid GSTIN format/i);
    });

    it('updates all profile fields (display name, legal name, about, logo, cover, website, addresses, social links)', async () => {
      const existingOrg: OrganizationProps = {
        id: 'org_123',
        businessId: 'OB-7KQ2MX',
        name: 'Old Name',
        slug: 'old-name',
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
      mockOrgRepo.findById.mockResolvedValue(existingOrg);

      const updated = await orgService.updateOrganization('org_123', {
        name: 'New Name',
        legalName: 'New Name Private Limited',
        about: 'Leading technology provider',
        website: 'https://newname.com',
        logo: 'https://cdn.onebridge.in/logo.png',
        cover: 'https://cdn.onebridge.in/cover.png',
        brandColours: { primary: '#1B2A4A', secondary: '#F68713' },
        addresses: [{ line1: '123 MG Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001', isPrimary: true }],
        socialLinks: { linkedin: 'https://linkedin.com/company/newname' },
      }, { role: 'owner' });

      expect(updated.name).toBe('New Name');
      expect(updated.legalName).toBe('New Name Private Limited');
      expect(updated.about).toBe('Leading technology provider');
      expect(updated.website).toBe('https://newname.com');
      expect(updated.brandColours?.primary).toBe('#1B2A4A');
      expect(updated.addresses?.[0].city).toBe('Bengaluru');
    });

    it('enforces role scope: forbids Employee or Viewer from updating profile', async () => {
      await expect(
        orgService.updateOrganization('org_123', { name: 'Unauthorized Change' }, { role: 'employee' })
      ).rejects.toThrow(/Forbidden/i);

      await expect(
        orgService.updateOrganization('org_123', { name: 'Unauthorized Change' }, { role: 'viewer' })
      ).rejects.toThrow(/Forbidden/i);
    });
  });

  describe('AC-4: Branding Propagation Event (org.branding_updated)', () => {
    it('emits org.branding_updated when brandColours, logo, or cover change', async () => {
      const existingOrg: OrganizationProps = {
        id: 'org_123',
        businessId: 'OB-7KQ2MX',
        name: 'Brand Corp',
        slug: 'brand-corp',
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
      mockOrgRepo.findById.mockResolvedValue(existingOrg);

      await orgService.updateOrganization('org_123', {
        brandColours: { primary: '#0A2540', secondary: '#F68713' },
        logo: 'https://cdn.onebridge.in/new-logo.png',
      }, { role: 'admin' });

      const brandingCall = fakeEventBus.calls.find(
        (c) => (c.args as { event?: { type?: string } } | undefined)?.event?.type === 'org.branding_updated'
      );
      expect(brandingCall).toBeDefined();
      const brandingPayload = (
        brandingCall?.args as { event?: { payload?: { brandColours?: { primary?: string }; logo?: string } } } | undefined
      )?.event?.payload;
      expect(brandingPayload?.brandColours?.primary).toBe('#0A2540');
      expect(brandingPayload?.logo).toBe('https://cdn.onebridge.in/new-logo.png');
    });
  });

  describe('AC-6: Slug Uniqueness and Permanent 301 Redirect', () => {
    it('prevents registration with an existing active slug or historical slug', async () => {
      mockOrgRepo.findByAnySlug.mockResolvedValue({ id: 'existing_org' } as unknown as OrganizationProps);

      await expect(
        orgService.createOrganization({
          name: 'Duplicate Corp',
          creatorPersonId: 'person_123',
          industry: 'IT',
          size: '1-10',
          city: 'Noida',
          slug: 'duplicate-corp',
        })
      ).rejects.toThrow(/Slug "duplicate-corp" is already taken/i);
    });

    it('keeps previous slugs in previousSlugs array and resolves with 301 redirect', async () => {
      const existingOrg: OrganizationProps = {
        id: 'org_123',
        businessId: 'OB-7KQ2MX',
        name: 'Old Slug Corp',
        slug: 'old-slug',
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
      mockOrgRepo.findById.mockResolvedValue(existingOrg);
      mockOrgRepo.findByAnySlug.mockResolvedValue(null);

      const updated = await orgService.updateOrganization('org_123', {
        slug: 'new-slug',
      }, { role: 'owner' });

      expect(updated.slug).toBe('new-slug');
      expect(updated.previousSlugs).toContain('old-slug');
    });

    it('resolves slug query: returns 200 for current slug, 301 redirect for previous slug', async () => {
      const org: OrganizationProps = {
        id: 'org_123',
        businessId: 'OB-7KQ2MX',
        name: 'Redirect Corp',
        slug: 'active-slug',
        previousSlugs: ['historical-slug-1', 'historical-slug-2'],
        industry: 'IT',
        size: '1-10',
        city: 'Delhi',
        plan: 'starter',
        verifiedBadge: false,
        onboardingStartedAt: new Date().toISOString(),
        aggregateVersion: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockOrgRepo.findBySlug.mockImplementation(async (slug: string) => {
        return slug === 'active-slug' ? org : null;
      });
      mockOrgRepo.findByAnySlug.mockImplementation(async (slug: string) => {
        if (slug === 'active-slug' || org.previousSlugs.includes(slug)) return org;
        return null;
      });

      // Active slug -> direct match
      const direct = await orgService.resolveSlug('active-slug');
      expect(direct.status).toBe(200);
      expect(direct.organization?.slug).toBe('active-slug');

      // Historical slug -> 301 redirect
      const redirected = await orgService.resolveSlug('historical-slug-1');
      expect(redirected.status).toBe(301);
      expect(redirected.redirectToSlug).toBe('active-slug');

      // Unknown slug -> 404
      const notFound = await orgService.resolveSlug('unknown-slug');
      expect(notFound.status).toBe(404);
    });
  });

  describe('AC-7: Target Metric tracking (time_to_first_card)', () => {
    it('records first card creation timestamp and calculates duration in seconds', async () => {
      const startTime = new Date(Date.now() - 120 * 1000).toISOString(); // 2 minutes ago
      const existingOrg: OrganizationProps = {
        id: 'org_123',
        businessId: 'OB-7KQ2MX',
        name: 'Speedy Corp',
        slug: 'speedy-corp',
        previousSlugs: [],
        industry: 'IT',
        size: '1-10',
        city: 'Delhi',
        plan: 'starter',
        verifiedBadge: false,
        onboardingStartedAt: startTime,
        aggregateVersion: 1,
        createdAt: startTime,
        updatedAt: startTime,
      };
      mockOrgRepo.findById.mockResolvedValue(existingOrg);

      const tracked = await orgService.recordFirstCardPublished('org_123');
      expect(tracked.firstCardCreatedAt).toBeDefined();
      expect(tracked.timeToFirstCardSeconds).toBeGreaterThanOrEqual(119);
    });
  });
});
