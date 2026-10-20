import { ulid } from 'ulid';
import { PublishableEventBus, Role, TenantContext, generateVCard } from '@onebridge/shared';
import type { PublicCardResponse } from '@onebridge/api-contracts';
import {
  CardProps,
  CardSectionConfig,
  CardTemplateId,
  assertSectionsEditable,
  validateCardSections,
  createDraftCard,
  isCardTemplateId,
} from '../domain/card.js';
import { MongoCardRepository } from '../infrastructure/mongo-card.repository.js';
import {
  MongoOrgReadModelRepository,
  MongoSeatReadModelRepository,
  MongoBranchReadModelRepository,
} from '../infrastructure/mongo-read-model.repositories.js';
import { RevalidationNotifier } from '../infrastructure/revalidation-notifier.js';

export class ProblemError extends Error {
  constructor(
    public readonly status: number,
    public readonly title: string,
    detail: string
  ) {
    super(detail);
  }
}

export interface CallerContext {
  personId: string;
  role: Role;
  correlationId?: string;
}

const ADMIN_ROLES: Role[] = ['owner', 'admin'];

export interface UpdateCardDto {
  templateId?: CardTemplateId;
  language?: 'en' | 'hi';
  sections?: CardSectionConfig[];
}

import type { ShortLinkService } from './short-link.service.js';

export class CardsService {
  constructor(
    private readonly cardRepo: MongoCardRepository,
    private readonly orgReadModelRepo: MongoOrgReadModelRepository,
    private readonly seatReadModelRepo: MongoSeatReadModelRepository,
    private readonly eventBus: PublishableEventBus,
    private readonly revalidationNotifier: RevalidationNotifier,
    private readonly shortLinkService?: ShortLinkService,
    private readonly branchReadModelRepo?: MongoBranchReadModelRepository
  ) {}

  /**
   * AC-1: "Each seat has one card." Invoked by ReadModelSyncService when a
   * seat.created event is consumed. Idempotent: a seat that already has a
   * card is left untouched. Caller must already be inside TenantContext.run.
   */
  async ensureDraftCardForSeat(tenantId: string, seatId: string): Promise<CardProps> {
    return TenantContext.run(tenantId, async () => {
      const existing = await this.cardRepo.findById(seatId);
      if (existing) {
        if (this.shortLinkService) {
          await this.shortLinkService.ensureDefaultCardShortLink(tenantId, existing.id, existing.slug);
        }
        return existing;
      }

      const org = await this.orgReadModelRepo.findByTenantId(tenantId);
      const now = new Date().toISOString();
      const slug = `${org?.slug ?? tenantId}/${seatId.toLowerCase()}`;

      const card = createDraftCard(
        { tenantId, seatId, slug, verifiedBadge: org?.verifiedBadge ?? false },
        now
      );
      const saved = await this.cardRepo.save(card);

      if (this.shortLinkService) {
        await this.shortLinkService.ensureDefaultCardShortLink(tenantId, saved.id, saved.slug);
      }

      return saved;
    });
  }

  async listPublishedCardsForTenant(tenantId: string): Promise<CardProps[]> {
    return TenantContext.run(tenantId, () => this.cardRepo.listPublishedByTenant());
  }

  async getCard(tenantId: string, cardId: string): Promise<CardProps> {
    const card = await TenantContext.run(tenantId, () => this.cardRepo.findById(cardId));
    if (!card) {
      throw new ProblemError(404, 'Not Found', `Card "${cardId}" not found`);
    }
    return card;
  }

  async getPublicCardBySlug(slug: string, tenantId: string): Promise<CardProps | null> {
    return TenantContext.run(tenantId, () => this.cardRepo.findBySlug(slug));
  }

  /**
   * F12 AC-1, AC-3, AC-7: Assembles public card view model for visitor page.
   * Strips all personal data if card is inactive or unactivated.
   */
  async getPublicCardView(slug: string): Promise<PublicCardResponse> {
    const card = await this.cardRepo.findBySlugGlobal(slug);
    if (!card) {
      throw new ProblemError(404, 'Not Found', `Card with slug "${slug}" not found`);
    }

    return TenantContext.run(card.tenantId, async () => {
      const org = await this.orgReadModelRepo.findByTenantId(card.tenantId);
      const seat = await this.seatReadModelRepo.findBySeatId(card.ownerId);
      const branch =
        seat?.branchId && this.branchReadModelRepo
          ? await this.branchReadModelRepo.findByBranchId(seat.branchId)
          : null;

      const aboutSection = card.sections.find((s) => s.type === 'about')?.content as
        | Record<string, unknown>
        | undefined;

      // Check if employee is offboarded
      if (seat?.status === 'offboarded') {
        const personName = (aboutSection?.name as string) || 'Employee';
        return {
          cardId: card.id,
          slug: card.slug,
          status: 'offboarded',
          templateId: card.templateId,
          language: card.language,
          verifiedBadge: card.verifiedBadge,
          company: {
            id: org?.tenantId || card.tenantId,
            businessId: org?.businessId || '',
            name: org?.name || 'OneBridge',
            logoUrl: org?.logo,
            brandColours: org?.brandColours,
          },
          branch: branch
            ? {
                id: branch.branchId,
                name: branch.name,
                address: branch.address,
                mapPin: branch.mapPin,
              }
            : undefined,
          sections: [],
          actions: {
            saveContactUrl: `/c/${card.slug}/vcard`,
          },
          offboardedDetails: {
            personName,
            successorName: (aboutSection?.successorName as string) || undefined,
            successorMessageUrl: (aboutSection?.successorMessageUrl as string) || undefined,
            redirectUrl: (aboutSection?.redirectUrl as string) || undefined,
          },
        };
      }

      // Check if inactive or unactivated (Zero personal data)
      if (
        card.status !== 'published' ||
        seat?.status === 'inactive' ||
        seat?.status === 'unactivated'
      ) {
        const isUnactivated = seat?.status === 'unactivated';
        return {
          cardId: card.id,
          slug: card.slug,
          status: isUnactivated ? 'unactivated' : 'inactive',
          templateId: card.templateId,
          language: card.language,
          verifiedBadge: false,
          company: {
            id: org?.tenantId || card.tenantId,
            businessId: org?.businessId || '',
            name: org?.name || 'OneBridge',
          },
          sections: [],
          actions: {
            saveContactUrl: `/c/${card.slug}/vcard`,
          },
        };
      }

      // Published card view
      const personName = (aboutSection?.name as string) || 'Cardholder';
      const designation = (aboutSection?.designation as string) || seat?.title || '';
      const photoUrl = aboutSection?.photoUrl as string | undefined;
      const phone = aboutSection?.phone as string | undefined;
      const email = aboutSection?.email as string | undefined;
      const bio =
        (aboutSection?.bio as string | undefined) ||
        (aboutSection?.text as string | undefined);

      const publicSections = card.sections
        .filter((s) => s.enabled !== false && s.visibility !== 'internal')
        .map((s) => ({
          type: s.type,
          order: s.order,
          content: s.content,
        }));

      let cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : undefined;
      if (cleanPhone) {
        if (cleanPhone.length === 10) {
          cleanPhone = `91${cleanPhone}`;
        } else if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) {
          cleanPhone = `91${cleanPhone.slice(1)}`;
        }
      }
      const whatsappUrl = cleanPhone
        ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
            `Hi ${personName}, I came across your digital card`
          )}`
        : undefined;

      const directionsUrl = branch?.mapPin
        ? `https://www.google.com/maps/search/?api=1&query=${branch.mapPin.lat},${branch.mapPin.lng}`
        : branch?.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(branch.address)}`
        : undefined;

      return {
        cardId: card.id,
        slug: card.slug,
        status: 'published',
        templateId: card.templateId,
        language: card.language,
        verifiedBadge: card.verifiedBadge,
        person: {
          name: personName,
          designation,
          photoUrl,
          phone,
          email,
          bio,
        },
        company: {
          id: org?.tenantId || card.tenantId,
          businessId: org?.businessId || '',
          name: org?.name || 'OneBridge',
          logoUrl: org?.logo,
          brandColours: org?.brandColours,
        },
        branch: branch
          ? {
              id: branch.branchId,
              name: branch.name,
              address: branch.address,
              mapPin: branch.mapPin,
            }
          : undefined,
        sections: publicSections,
        actions: {
          saveContactUrl: `/c/${card.slug}/vcard`,
          whatsappUrl,
          callUrl: phone ? `tel:${phone}` : undefined,
          emailUrl: email ? `mailto:${email}` : undefined,
          directionsUrl,
        },
      };
    });
  }

  /**
   * F12 AC-2: Generates standard vCard 3.0 / 4.0 file for public contact download.
   */
  async getPublicCardVCard(slug: string): Promise<{ vcard: string; filename: string }> {
    const cardView = await this.getPublicCardView(slug);
    if (cardView.status !== 'published' || !cardView.person || !cardView.person.name) {
      throw new ProblemError(
        404,
        'Not Found',
        'Cannot download vCard for inactive or non-published card'
      );
    }

    const personName = cardView.person.name;
    const nameParts = personName.trim().split(/\s+/);
    const firstName = nameParts[0] || 'Contact';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
    const cardUrl = `https://grid.onebridge.in/c/${cardView.slug}`;
    const vcardNote = [cardView.person.bio, `Card: ${cardUrl}`].filter(Boolean).join('\n\n');

    const vcard = generateVCard({
      firstName,
      lastName,
      company: cardView.company.name,
      branch: cardView.branch?.name,
      title: cardView.person.designation,
      phone: cardView.person.phone,
      email: cardView.person.email,
      url: cardUrl,
      photoUrl: cardView.person.photoUrl,
      address: cardView.branch?.address ? { street: cardView.branch.address } : undefined,
      note: vcardNote,
    });

    const safeFilename = `${personName.replace(/[^a-zA-Z0-9_-]/g, '_')}.vcf`;
    return { vcard, filename: safeFilename };
  }

  /**
   * Returns true when the caller is an admin (owner/admin, may edit any card
   * and locked sections). Throws when the caller is neither an admin nor
   * the person actually assigned to the card's seat (checked against the
   * seat read model, not merely "any employee" — otherwise any employee in
   * the company could edit a colleague's card).
   */
  private async assertCanEditCard(tenantId: string, card: CardProps, caller: CallerContext): Promise<boolean> {
    const isAdmin = ADMIN_ROLES.includes(caller.role);
    if (isAdmin) return true;

    const seat = await TenantContext.run(tenantId, () => this.seatReadModelRepo.findBySeatId(card.ownerId));
    if (seat && seat.personId && seat.personId === caller.personId) {
      return false;
    }

    throw new ProblemError(403, 'Forbidden', 'Only the company owner, an admin, or the seat holder may edit this card');
  }

  /** AC-2, AC-3: update template/sections/language. Template switch keeps all content. Locked sections rejected for non-admins. */
  async updateCard(tenantId: string, cardId: string, dto: UpdateCardDto, caller: CallerContext): Promise<CardProps> {
    const existing = await this.getCard(tenantId, cardId);
    const isAdmin = await this.assertCanEditCard(tenantId, existing, caller);

    if (dto.templateId !== undefined && !isCardTemplateId(dto.templateId)) {
      throw new ProblemError(400, 'Bad Request', `Unknown card template "${dto.templateId}"`);
    }

    if (dto.sections !== undefined) {
      try {
        validateCardSections(dto.sections);
        assertSectionsEditable(existing.sections, dto.sections, isAdmin);
      } catch (err: unknown) {
        if (err instanceof Error) {
          throw new ProblemError(400, 'Bad Request', err.message);
        }
        throw err;
      }
    }

    const now = new Date().toISOString();
    const updated: CardProps = {
      ...existing,
      // AC-2: changing templateId never touches sections/content.
      templateId: dto.templateId ?? existing.templateId,
      language: dto.language ?? existing.language,
      sections: dto.sections ?? existing.sections,
      aggregateVersion: existing.aggregateVersion + 1,
      updatedAt: now,
    };

    return TenantContext.run(tenantId, () => this.cardRepo.save(updated));
  }

  /**
   * AC-2: "Applies to selected cards in bulk." Template switch only; every
   * other field (sections, content, language) is left untouched per card.
   */
  async bulkSetTemplate(
    tenantId: string,
    cardIds: string[],
    templateId: CardTemplateId,
    caller: CallerContext
  ): Promise<CardProps[]> {
    if (!isCardTemplateId(templateId)) {
      throw new ProblemError(400, 'Bad Request', `Unknown card template "${templateId}"`);
    }
    if (!ADMIN_ROLES.includes(caller.role)) {
      throw new ProblemError(403, 'Forbidden', 'Only the company owner or an admin may bulk-apply a template');
    }

    return TenantContext.run(tenantId, async () => {
      const cards = await this.cardRepo.findByIds(cardIds);
      const now = new Date().toISOString();
      const updated: CardProps[] = [];
      for (const card of cards) {
        const saved = await this.cardRepo.save({
          ...card,
          templateId,
          aggregateVersion: card.aggregateVersion + 1,
          updatedAt: now,
        });
        updated.push(saved);
      }
      return updated;
    });
  }

  /**
   * AC-6: publish fires card.published and triggers the outbox revalidate
   * call. When the company requires approval (approvalRequired or company
   * setting cardApprovalRequired) and caller is not an admin, the card
   * moves to pending_approval instead.
   */
  async publishCard(tenantId: string, cardId: string, caller: CallerContext, correlationId = 'unknown'): Promise<CardProps> {
    const existing = await this.getCard(tenantId, cardId);
    const isAdmin = await this.assertCanEditCard(tenantId, existing, caller);
    const now = new Date().toISOString();

    const org = await TenantContext.run(tenantId, () => this.orgReadModelRepo.findByTenantId(tenantId));
    const requiresApproval = existing.approvalRequired || (org?.cardApprovalRequired ?? false);

    if (requiresApproval && !isAdmin) {
      const pending: CardProps = {
        ...existing,
        status: 'pending_approval',
        aggregateVersion: existing.aggregateVersion + 1,
        updatedAt: now,
      };
      return TenantContext.run(tenantId, () => this.cardRepo.save(pending));
    }

    return this.doPublish(tenantId, existing, now, correlationId);
  }

  /** Admin approves a card sitting in pending_approval. */
  async approveCard(tenantId: string, cardId: string, caller: CallerContext, correlationId = 'unknown'): Promise<CardProps> {
    if (!ADMIN_ROLES.includes(caller.role)) {
      throw new ProblemError(403, 'Forbidden', 'Only the company owner or an admin may approve a card');
    }
    const existing = await this.getCard(tenantId, cardId);
    if (existing.status !== 'pending_approval') {
      throw new ProblemError(400, 'Bad Request', `Card "${cardId}" is not pending approval`);
    }
    const now = new Date().toISOString();
    return this.doPublish(tenantId, existing, now, correlationId);
  }

  private async doPublish(tenantId: string, card: CardProps, now: string, correlationId: string): Promise<CardProps> {
    const published: CardProps = {
      ...card,
      status: 'published',
      publishedAt: card.publishedAt ?? now,
      aggregateVersion: card.aggregateVersion + 1,
      updatedAt: now,
    };
    const saved = await TenantContext.run(tenantId, () => this.cardRepo.save(published));

    await this.eventBus.publish({
      eventId: ulid(),
      type: 'card.published',
      version: '1.0.0',
      tenantId: saved.tenantId,
      occurredAt: now,
      correlationId,
      aggregateVersion: saved.aggregateVersion,
      payload: { cardId: saved.id, tenantId: saved.tenantId, slug: saved.slug },
    });

    // ADR-0003 point 5: outbox call to web-public's revalidate endpoint.
    await this.revalidationNotifier.revalidateCard({
      cardId: saved.id,
      slug: saved.slug,
      tenantId: saved.tenantId,
    });

    return saved;
  }
}
