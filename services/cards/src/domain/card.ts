/**
 * F10: Cards and templates.
 * Source: P1-CARD-01, P1-CARD-04, P1-CARD-05 (8 templates only).
 */

export const CARD_TEMPLATE_IDS = [
  'classic-charcoal',
  'bridge-orange',
  'arch-minimal',
  'keystone-dark',
  'paper-light',
  'enterprise-blue',
  'grid-mono',
  'sand-warm',
] as const;
export type CardTemplateId = (typeof CARD_TEMPLATE_IDS)[number];

export function isCardTemplateId(value: unknown): value is CardTemplateId {
  return typeof value === 'string' && (CARD_TEMPLATE_IDS as readonly string[]).includes(value);
}

export type CardStatus = 'draft' | 'pending_approval' | 'published';

export type CardLanguage = 'en' | 'hi';

export type FieldVisibility = 'public' | 'internal';

/** AC-3: About, Products, Services, Portfolio, Gallery, Documents, Social links, Company info, Branch map. */
export const CARD_SECTION_TYPES = [
  'about',
  'products',
  'services',
  'portfolio',
  'gallery',
  'documents',
  'social_links',
  'company_info',
  'branch_map',
] as const;
export type CardSectionType = (typeof CARD_SECTION_TYPES)[number];

export interface CardSectionConfig {
  type: CardSectionType;
  enabled: boolean;
  order: number;
  /** Set by the admin (AC-3). A locked section is rejected server-side if an employee tries to change it. */
  locked: boolean;
  visibility: FieldVisibility;
  content: Record<string, unknown>;
}

export function defaultCardSections(): CardSectionConfig[] {
  return CARD_SECTION_TYPES.map((type, index) => ({
    type,
    enabled: true,
    order: index,
    locked: false,
    visibility: 'public',
    content: {},
  }));
}

export interface CardProps {
  id: string; // cardId, same value as the owning seatId (one card per seat, AC-1)
  tenantId: string;
  ownerType: 'seat';
  ownerId: string; // seatId
  slug: string; // company-slug/person-slug public path segment
  templateId: CardTemplateId;
  status: CardStatus;
  language: CardLanguage;
  sections: CardSectionConfig[];
  /** Mirrors the company's verifiedBadge at the time the read model last updated it (AC-1). */
  verifiedBadge: boolean;
  approvalRequired: boolean;
  publishedAt?: string;
  aggregateVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDraftCardInput {
  tenantId: string;
  seatId: string;
  slug: string;
  verifiedBadge: boolean;
}

export function createDraftCard(input: CreateDraftCardInput, now: string): CardProps {
  return {
    id: input.seatId,
    tenantId: input.tenantId,
    ownerType: 'seat',
    ownerId: input.seatId,
    slug: input.slug,
    templateId: CARD_TEMPLATE_IDS[0],
    status: 'draft',
    language: 'en',
    sections: defaultCardSections(),
    verifiedBadge: input.verifiedBadge,
    approvalRequired: false,
    aggregateVersion: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export class LockedSectionError extends Error {
  constructor(sectionType: string) {
    super(`Section "${sectionType}" is locked by the company and cannot be edited`);
    this.name = 'LockedSectionError';
  }
}

export class InvalidSectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSectionError';
  }
}

export const MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB (AC-3)

export function validateCardSections(sections: CardSectionConfig[]): void {
  for (const section of sections) {
    if (section.type === 'documents' && section.content) {
      const items = Array.isArray(section.content.items)
        ? section.content.items
        : Array.isArray(section.content.documents)
        ? section.content.documents
        : Array.isArray(section.content.files)
        ? section.content.files
        : null;

      if (items) {
        for (const item of items as Array<Record<string, unknown>>) {
          if (typeof item.size === 'number' && item.size > MAX_DOCUMENT_SIZE_BYTES) {
            throw new InvalidSectionError(`Document "${item.name || 'file'}" exceeds 25 MB size limit`);
          }
          const mime = (item.mimeType || item.contentType) as string | undefined;
          const name = (item.name || item.filename || item.url) as string | undefined;
          if (mime && mime !== 'application/pdf') {
            throw new InvalidSectionError(`Document "${name || 'file'}" must be a PDF`);
          }
          if (name && typeof name === 'string' && !name.toLowerCase().endsWith('.pdf') && !mime) {
            throw new InvalidSectionError(`Document "${name}" must be a PDF`);
          }
        }
      }
    }
  }
}

/**
 * AC-3: locked sections are rejected server-side if an employee tries to edit them.
 * `isAdmin` callers (owner/admin) may edit locked sections; everyone else may not.
 */
export function assertSectionsEditable(
  existingSections: CardSectionConfig[],
  incomingSections: CardSectionConfig[],
  isAdmin: boolean
): void {
  if (isAdmin) return;
  const existingByType = new Map(existingSections.map((s) => [s.type, s]));
  for (const incoming of incomingSections) {
    const existing = existingByType.get(incoming.type);
    if (!existing || !existing.locked) continue;
    const changed =
      existing.enabled !== incoming.enabled ||
      existing.order !== incoming.order ||
      existing.visibility !== incoming.visibility ||
      JSON.stringify(existing.content) !== JSON.stringify(incoming.content);
    if (changed) {
      throw new LockedSectionError(incoming.type);
    }
  }
}

