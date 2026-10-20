import { describe, it, expect } from 'vitest';
import {
  createDraftCard,
  assertSectionsEditable,
  validateCardSections,
  defaultCardSections,
  CARD_TEMPLATE_IDS,
  CARD_SECTION_TYPES,
  isCardTemplateId,
} from '../src/domain/card.js';
import { isNewerVersion } from '../src/domain/read-models.js';

describe('F10: Card domain', () => {
  describe('createDraftCard', () => {
    it('AC-1: creates one draft card per seat with default template, 9 sections and draft status', () => {
      const card = createDraftCard(
        { tenantId: 't1', seatId: 'OB-ABC123-E0001', slug: 'acme/sneha', verifiedBadge: true },
        '2026-01-01T00:00:00.000Z'
      );
      expect(card.id).toBe('OB-ABC123-E0001');
      expect(card.ownerId).toBe('OB-ABC123-E0001');
      expect(card.status).toBe('draft');
      expect(card.templateId).toBe(CARD_TEMPLATE_IDS[0]);
      expect(card.sections).toHaveLength(9);
      expect(card.verifiedBadge).toBe(true);
      expect(card.aggregateVersion).toBe(1);
      expect(card.language).toBe('en');
    });

    it('mirrors verifiedBadge=false when the org read model has no verified badge yet', () => {
      const card = createDraftCard(
        { tenantId: 't1', seatId: 'OB-ABC123-E0002', slug: 'acme/raj', verifiedBadge: false },
        '2026-01-01T00:00:00.000Z'
      );
      expect(card.verifiedBadge).toBe(false);
    });
  });

  it('AC-2: exactly 8 premium templates', () => {
    expect(CARD_TEMPLATE_IDS).toHaveLength(8);
  });

  it('AC-3: exactly 9 sections (About, Products, Services, Portfolio, Gallery, Documents, Social links, Company info, Branch map)', () => {
    expect(CARD_SECTION_TYPES).toEqual([
      'about',
      'products',
      'services',
      'portfolio',
      'gallery',
      'documents',
      'social_links',
      'company_info',
      'branch_map',
    ]);
  });

  describe('isCardTemplateId', () => {
    it('accepts a known template id', () => {
      expect(isCardTemplateId('classic-charcoal')).toBe(true);
    });
    it('rejects an unknown string', () => {
      expect(isCardTemplateId('not-a-template')).toBe(false);
    });
    it('rejects non-string values', () => {
      expect(isCardTemplateId(123)).toBe(false);
      expect(isCardTemplateId(undefined)).toBe(false);
    });
  });

  describe('assertSectionsEditable (AC-3: locked sections rejected server-side for non-admins)', () => {
    it('throws when a non-admin changes a locked section', () => {
      const sections = defaultCardSections();
      sections[0] = { ...sections[0], locked: true };
      const attempted = sections.map((s, i) => (i === 0 ? { ...s, enabled: false } : s));

      expect(() => assertSectionsEditable(sections, attempted, false)).toThrow(/locked/i);
    });

    it('allows an admin to change a locked section', () => {
      const sections = defaultCardSections();
      sections[0] = { ...sections[0], locked: true };
      const attempted = sections.map((s, i) => (i === 0 ? { ...s, enabled: false } : s));

      expect(() => assertSectionsEditable(sections, attempted, true)).not.toThrow();
    });

    it('allows a non-admin to change an unlocked section', () => {
      const sections = defaultCardSections();
      const attempted = sections.map((s, i) => (i === 1 ? { ...s, enabled: false } : s));

      expect(() => assertSectionsEditable(sections, attempted, false)).not.toThrow();
    });

    it('does not throw when the locked section content is unchanged', () => {
      const sections = defaultCardSections();
      sections[0] = { ...sections[0], locked: true };

      expect(() => assertSectionsEditable(sections, sections, false)).not.toThrow();
    });
  });

  describe('validateCardSections (AC-3: Documents PDF <= 25 MB)', () => {
    it('accepts documents within 25 MB and PDF format', () => {
      const sections = defaultCardSections();
      const docSection = sections.find((s) => s.type === 'documents')!;
      docSection.content = {
        items: [
          { name: 'brochure.pdf', size: 5 * 1024 * 1024, mimeType: 'application/pdf', url: 'https://cdn/b.pdf' },
        ],
      };
      expect(() => validateCardSections(sections)).not.toThrow();
    });

    it('rejects a document exceeding 25 MB', () => {
      const sections = defaultCardSections();
      const docSection = sections.find((s) => s.type === 'documents')!;
      docSection.content = {
        items: [
          { name: 'large.pdf', size: 26 * 1024 * 1024, mimeType: 'application/pdf', url: 'https://cdn/l.pdf' },
        ],
      };
      expect(() => validateCardSections(sections)).toThrow(/25 MB/i);
    });

    it('rejects a non-PDF document', () => {
      const sections = defaultCardSections();
      const docSection = sections.find((s) => s.type === 'documents')!;
      docSection.content = {
        items: [
          { name: 'doc.docx', size: 1024, mimeType: 'application/msword', url: 'https://cdn/d.docx' },
        ],
      };
      expect(() => validateCardSections(sections)).toThrow(/PDF/i);
    });
  });

  describe('isNewerVersion (ADR-0003 point 3: ignore stale events)', () => {
    it('applies when there is no stored record', () => {
      expect(isNewerVersion(undefined, 1)).toBe(true);
    });
    it('applies a strictly newer version', () => {
      expect(isNewerVersion(1, 2)).toBe(true);
    });
    it('ignores an older (stale) version', () => {
      expect(isNewerVersion(2, 1)).toBe(false);
    });
    it('ignores a duplicate (equal) version', () => {
      expect(isNewerVersion(2, 2)).toBe(false);
    });
    it('applies when the incoming event carries no version (best-effort legacy path)', () => {
      expect(isNewerVersion(5, undefined)).toBe(true);
    });
  });
});
