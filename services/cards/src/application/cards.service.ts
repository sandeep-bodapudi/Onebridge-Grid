import { ulid } from 'ulid';
import { PublishableEventBus, Role, TenantContext } from '@onebridge/shared';
import {
  CardProps,
  CardSectionConfig,
  CardTemplateId,
  assertSectionsEditable,
  createDraftCard,
  isCardTemplateId,
} from '../domain/card.js';
import { MongoCardRepository } from '../infrastructure/mongo-card.repository.js';
import { MongoOrgReadModelRepository, MongoSeatReadModelRepository } from '../infrastructure/mongo-read-model.repositories.js';
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

export class CardsService {
  constructor(
    private readonly cardRepo: MongoCardRepository,
    private readonly orgReadModelRepo: MongoOrgReadModelRepository,
    private readonly seatReadModelRepo: MongoSeatReadModelRepository,
    private readonly eventBus: PublishableEventBus,
    private readonly revalidationNotifier: RevalidationNotifier
  ) {}

  /**
   * AC-1: "Each seat has one card." Invoked by ReadModelSyncService when a
   * seat.created event is consumed. Idempotent: a seat that already has a
   * card is left untouched. Caller must already be inside TenantContext.run.
   */
  async ensureDraftCardForSeat(tenantId: string, seatId: string): Promise<CardProps> {
    return TenantContext.run(tenantId, async () => {
      const existing = await this.cardRepo.findById(seatId);
      if (existing) return existing;

      const org = await this.orgReadModelRepo.findByTenantId(tenantId);
      const now = new Date().toISOString();
      const slug = `${org?.slug ?? tenantId}/${seatId.toLowerCase()}`;

      const card = createDraftCard(
        { tenantId, seatId, slug, verifiedBadge: org?.verifiedBadge ?? false },
        now
      );
      return this.cardRepo.save(card);
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
   * Returns true when the caller is an admin (owner/admin, may edit any card
   * and locked sections). Throws when the caller is neither an admin nor
   * the person actually assigned to the card's seat (checked against the
   * seat read model, not merely "any employee" — otherwise any employee in
   * the company could edit a colleague's card).
   */
  private async assertCanEditCard(tenantId: string, card: CardProps, caller: CallerContext): Promise<boolean> {
    const isAdmin = ADMIN_ROLES.includes(caller.role);
    if (isAdmin) return true;

    if (caller.role === 'employee') {
      const seat = await TenantContext.run(tenantId, () => this.seatReadModelRepo.findBySeatId(card.ownerId));
      if (seat && seat.personId && seat.personId === caller.personId) {
        return false;
      }
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
      assertSectionsEditable(existing.sections, dto.sections, isAdmin);
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
   * call. When the company requires approval (approvalRequired) and the
   * caller is not an admin, the card moves to pending_approval instead.
   */
  async publishCard(tenantId: string, cardId: string, caller: CallerContext, correlationId = 'unknown'): Promise<CardProps> {
    const existing = await this.getCard(tenantId, cardId);
    const isAdmin = await this.assertCanEditCard(tenantId, existing, caller);
    const now = new Date().toISOString();

    if (existing.approvalRequired && !isAdmin) {
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
