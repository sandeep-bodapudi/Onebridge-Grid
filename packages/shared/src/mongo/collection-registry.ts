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
  org_read_models: {
    name: 'org_read_models',
    classification: 'tenant-scoped',
    description: 'Cards service denormalised copy of organization data (ADR-0003), never read from organizations directly',
  },
  seat_read_models: {
    name: 'seat_read_models',
    classification: 'tenant-scoped',
    description: 'Cards service denormalised copy of seat data (ADR-0003)',
  },
  branch_read_models: {
    name: 'branch_read_models',
    classification: 'tenant-scoped',
    description: 'Cards service denormalised copy of branch data (ADR-0003), used for the branch-map card section',
  },
  short_links: {
    name: 'short_links',
    classification: 'tenant-scoped',
    description: 'Immutable short link codes and QR targets (obg.in/<8 char>) per F11',
  },
  analytics_events: {
    name: 'analytics_events',
    classification: 'tenant-scoped',
    description: 'Buffered visitor telemetry and scan events awaiting Step 8 analytics ingestion pipeline',
  },
  company_profiles: {
    name: 'company_profiles',
    classification: 'tenant-scoped',
    description: 'Public company page settings (F26): catalogue, services, portfolio, documents, directory, enquiry routing, SEO',
  },
  invites: {
    name: 'invites',
    classification: 'tenant-scoped',
    description: 'Seat invites (F14): hashed single-use token, encrypted contact, channel, expiry, status',
  },
  member_profiles: {
    name: 'member_profiles',
    classification: 'global',
    description: 'N01 member profiles. Owned by the person, not a company; no contact details (D-CONTACT)',
  },
  work_history: {
    name: 'work_history',
    classification: 'global',
    description: 'N01 work history: verified entries from claimed seats, and self-added entries',
  },
  profile_org_refs: {
    name: 'profile_org_refs',
    classification: 'global',
    description: 'Profiles read model: company name and slug from org.* events (ADR-0003)',
  },
  profile_seat_refs: {
    name: 'profile_seat_refs',
    classification: 'global',
    description: 'Profiles read model: seat title and holder from seat.* events (ADR-0003)',
  },
  access_requests: {
    name: 'access_requests',
    classification: 'tenant-scoped',
    description: 'N02 requests to join an existing company (found by GSTIN); the requester chooses the name shown',
  },
  follows: {
    name: 'follows',
    classification: 'global',
    description: 'N04 follow edges between members and companies (IDs only)',
  },
  social_company_refs: {
    name: 'social_company_refs',
    classification: 'global',
    description: 'Social read model: public company name, slug, logo and verification from org events (ADR-0003)',
  },
  search_documents: {
    name: 'search_documents',
    classification: 'global',
    description: 'N03 search index: public company and member profile text only; never contact details',
  },
  conversations: {
    name: 'conversations',
    classification: 'global',
    description: 'N08 conversations between members and companies (participants are IDs; no message text)',
  },
  messages: {
    name: 'messages',
    classification: 'global',
    description: 'N08 chat messages; text encrypted at rest (company conversations with the tenant key, others per conversation)',
  },
  messaging_company_refs: {
    name: 'messaging_company_refs',
    classification: 'global',
    description: 'Messaging read model: public company name, slug, logo, plan and verification from org events (ADR-0003)',
  },
  messaging_seat_refs: {
    name: 'messaging_seat_refs',
    classification: 'global',
    description: 'Messaging read model: seat holder and status from seat events, for inbox assignment (IDs only)',
  },
  messaging_follow_refs: {
    name: 'messaging_follow_refs',
    classification: 'global',
    description: 'Messaging read model: follow edges from follow events, for the message request rule (IDs only)',
  },
  conversation_notes: {
    name: 'conversation_notes',
    classification: 'tenant-scoped',
    description: 'N08 internal notes on company conversations; never shown to the other side; text encrypted',
  },
  notice_acceptances: {
    name: 'notice_acceptances',
    classification: 'tenant-scoped',
    description: 'Seat-claim privacy notice acceptances (F14 AC-2): person, seat, notice version, timestamp',
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
