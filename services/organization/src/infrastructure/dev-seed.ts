import { ulid } from 'ulid';
import {
  MongoConnectionHandle,
  PublishableEventBus,
  TenantContext,
  generateBase32BusinessId,
  slugifyCompanyName,
} from '@onebridge/shared';
import { OrganizationProps } from '../domain/organization.js';
import { MongoOrganizationRepository } from './mongo-organization.repository.js';
import { MongoIssuedIdRepository } from './mongo-issued-id.repository.js';

export interface DevSeedTenant {
  /** Fixed tenant ID shared with identity's seeded memberships. */
  id: string;
  name: string;
  plan: 'starter' | 'business';
  industry?: string;
  size?: string;
  city?: string;
}

/**
 * Local development only. Creates well-formed Organization records for the
 * tenants that identity's dev seed gives memberships to, minting real
 * OB-XXXXXX Business IDs (ADR-0001), and publishes org.created so the cards
 * read model learns about them (ADR-0003). Idempotent: existing tenants are
 * skipped. Organization owns the organizations collection; identity's seed
 * no longer writes it.
 */
export async function seedDevOrganizations(
  handle: MongoConnectionHandle,
  eventBus: PublishableEventBus,
  tenants: DevSeedTenant[],
  nodeEnv: string
): Promise<{ created: string[]; skipped: string[] }> {
  if (nodeEnv === 'production') {
    throw new Error('Development seeding is forbidden in production');
  }

  const orgRepo = new MongoOrganizationRepository(handle);
  const issuedIdRepo = new MongoIssuedIdRepository(handle);
  const created: string[] = [];
  const skipped: string[] = [];

  for (const tenant of tenants) {
    const existing = await TenantContext.run(tenant.id, () => orgRepo.findById(tenant.id));
    if (existing) {
      skipped.push(tenant.id);
      continue;
    }

    let businessId = '';
    for (let attempt = 0; attempt < 5 && !businessId; attempt++) {
      const candidate = generateBase32BusinessId();
      if (await issuedIdRepo.claimId(candidate, tenant.id)) businessId = candidate;
    }
    if (!businessId) throw new Error(`Could not mint a Business ID for dev tenant ${tenant.id}`);

    const now = new Date().toISOString();
    const org: OrganizationProps = {
      id: tenant.id,
      tenantId: tenant.id,
      businessId,
      name: tenant.name,
      legalName: tenant.name,
      slug: slugifyCompanyName(tenant.name),
      previousSlugs: [],
      industry: tenant.industry ?? 'Technology',
      size: tenant.size ?? '51-200',
      city: tenant.city ?? 'Bengaluru',
      plan: tenant.plan,
      verifiedBadge: false,
      onboardingStartedAt: now,
      aggregateVersion: 1,
      createdAt: now,
      updatedAt: now,
    };
    const saved = await TenantContext.run(tenant.id, () => orgRepo.save(org));

    await eventBus.publish({
      eventId: ulid(),
      type: 'org.created',
      version: '1.0.0',
      tenantId: tenant.id,
      occurredAt: now,
      correlationId: 'dev-seed',
      aggregateVersion: saved.aggregateVersion,
      payload: { orgId: saved.id, businessId: saved.businessId, name: saved.name, slug: saved.slug },
    });
    created.push(tenant.id);
  }

  return { created, skipped };
}
