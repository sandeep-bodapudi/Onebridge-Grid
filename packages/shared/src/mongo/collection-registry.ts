export type CollectionClassification = 'tenant-scoped' | 'global';

export interface CollectionMetadata {
  name: string;
  classification: CollectionClassification;
  description: string;
}

export const KNOWN_COLLECTIONS: Record<string, CollectionMetadata> = {
  // Global collections (strictly allowlisted platform entities)
  persons: {
    name: 'persons',
    classification: 'global',
    description: 'Human identity records spanning across multiple organizations',
  },
  sessions: {
    name: 'sessions',
    classification: 'global',
    description: 'User login sessions and refresh token families',
  },
  otp_challenges: {
    name: 'otp_challenges',
    classification: 'global',
    description: 'Transient OTP validation challenges with TTL',
  },
  issued_id_registries: {
    name: 'issued_id_registries',
    classification: 'global',
    description: 'Central registry of globally unique issued IDs and Business IDs',
  },
  rate_limits: {
    name: 'rate_limits',
    classification: 'global',
    description: 'Global rate-limiting counters with TTL index',
  },

  // Tenant-scoped collections (business data strictly isolated by tenantId)
  organizations: {
    name: 'organizations',
    classification: 'tenant-scoped',
    description: 'Tenants / Companies owning identity, seats, and cards',
  },
  memberships: {
    name: 'memberships',
    classification: 'tenant-scoped',
    description: 'Association between person and tenant including roles and scopes',
  },
  branches: {
    name: 'branches',
    classification: 'tenant-scoped',
    description: 'Company branch locations',
  },
  departments: {
    name: 'departments',
    classification: 'tenant-scoped',
    description: 'Company departments',
  },
  teams: {
    name: 'teams',
    classification: 'tenant-scoped',
    description: 'Company teams',
  },
  seats: {
    name: 'seats',
    classification: 'tenant-scoped',
    description: 'Company seat allocations and entitlements',
  },
  cards: {
    name: 'cards',
    classification: 'tenant-scoped',
    description: 'Digital business identity cards',
  },
  leads: {
    name: 'leads',
    classification: 'tenant-scoped',
    description: 'Visitor contacts captured via card share-back',
  },
  audit_logs: {
    name: 'audit_logs',
    classification: 'tenant-scoped',
    description: 'Immutable tenant-scoped audit trails',
  },
  counters: {
    name: 'counters',
    classification: 'tenant-scoped',
    description: 'Tenant-scoped monotonic sequence counters for derived IDs (branches, departments, seats)',
  },
};

export const ALLOWLISTED_GLOBAL_COLLECTIONS = Object.values(KNOWN_COLLECTIONS)
  .filter((c) => c.classification === 'global')
  .map((c) => c.name);

export function getCollectionClassification(collectionName: string): CollectionClassification {
  const metadata = KNOWN_COLLECTIONS[collectionName];
  if (!metadata) {
    throw new Error(
      `Unclassified collection: "${collectionName}". Every collection must be explicitly registered in collection-registry.ts`
    );
  }
  return metadata.classification;
}
