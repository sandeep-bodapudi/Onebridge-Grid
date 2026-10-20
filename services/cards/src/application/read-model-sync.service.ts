import { DomainEvent, SubscribableEventBus, TenantContext } from '@onebridge/shared';
import { MongoOrgReadModelRepository, MongoSeatReadModelRepository, MongoBranchReadModelRepository } from '../infrastructure/mongo-read-model.repositories.js';
import { OrgReadModel, SeatReadModel, BranchReadModel } from '../domain/read-models.js';
import { CardsService } from './cards.service.js';
import { RevalidationNotifier } from '../infrastructure/revalidation-notifier.js';

/**
 * ADR-0003 point 4: keeps the Cards service's denormalised copies of
 * organization, branch and seat data in sync by consuming domain events.
 *
 * Ordering note (logged in docs/decisions.md): org.*, org.branding_updated
 * events carry a correctly incrementing `aggregateVersion` (organization.service.ts
 * uses `saved.aggregateVersion`), so the org read model is written with a
 * proper "ignore stale events" check (ADR-0003 point 3). branch.*, department.*,
 * team.* and seat.* events currently publish a hardcoded `aggregateVersion: 1`
 * in services/organization (a pre-existing gap, not introduced here — see
 * docs/decisions.md D-F10-READMODEL-ORDERING), so out-of-order delivery of
 * those event types cannot yet be detected from the payload. Because the
 * only transport wired up so far is the synchronous, in-order InMemoryEventBus
 * (SNS/SQS is deferred to Step 12), this is safe today: this consumer applies
 * seat and branch events in arrival order and keeps its own local version
 * counter. It must not be trusted as out-of-order-safe once a real queue is
 * introduced until the organization-service aggregateVersion gap is fixed.
 */
export class ReadModelSyncService {
  constructor(
    private readonly orgReadModelRepo: MongoOrgReadModelRepository,
    private readonly seatReadModelRepo: MongoSeatReadModelRepository,
    private readonly branchReadModelRepo: MongoBranchReadModelRepository,
    private readonly cardsService: CardsService,
    private readonly revalidationNotifier: RevalidationNotifier
  ) {}

  registerSubscriptions(bus: SubscribableEventBus): void {
    bus.subscribe('org.created', (e) => this.handleOrgEvent(e));
    bus.subscribe('org.updated', (e) => this.handleOrgEvent(e));
    bus.subscribe('org.branding_updated', (e) => this.handleOrgBrandingUpdated(e));
    bus.subscribe('branch.created', (e) => this.handleBranchEvent(e));
    bus.subscribe('branch.updated', (e) => this.handleBranchEvent(e));
    bus.subscribe('branch.archived', (e) => this.handleBranchEvent(e, 'archived'));
    bus.subscribe('seat.created', (e) => this.handleSeatCreated(e));
    bus.subscribe('seat.updated', (e) => this.handleSeatEvent(e));
    bus.subscribe('seat.assigned', (e) => this.handleSeatEvent(e));
    bus.subscribe('seat.status_changed', (e) => this.handleSeatStatusChanged(e));
    bus.subscribe('kyb.status_changed', (e) => this.handleKybStatusChanged(e));
  }

  private async withTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
    return TenantContext.run(tenantId, fn);
  }

  async handleOrgEvent(event: DomainEvent): Promise<void> {
    const payload = event.payload as Record<string, unknown>;
    const tenantId = event.tenantId;

    await this.withTenant(tenantId, async () => {
      const existing = await this.orgReadModelRepo.findByTenantId(tenantId);
      const updatedFields = payload.updatedFields as Record<string, unknown> | undefined;
      const merged: OrgReadModel = {
        tenantId,
        businessId: (payload.businessId as string) ?? existing?.businessId ?? '',
        name: (payload.name as string) ?? existing?.name ?? '',
        slug:
          (payload.slug as string) ??
          (updatedFields?.slug as string | undefined) ??
          existing?.slug ??
          '',
        logo: existing?.logo,
        brandColours: existing?.brandColours,
        verifiedBadge: existing?.verifiedBadge ?? false,
        cardApprovalRequired:
          (payload.cardApprovalRequired as boolean | undefined) ??
          (updatedFields?.cardApprovalRequired as boolean | undefined) ??
          existing?.cardApprovalRequired ??
          false,
        aggregateVersion: event.aggregateVersion ?? (existing?.aggregateVersion ?? 0) + 1,
        updatedAt: event.occurredAt,
      };

      // org.updated may patch display name via updatedFields without repeating it top-level.
      if (updatedFields?.name) merged.name = updatedFields.name as string;

      await this.orgReadModelRepo.upsertIfNewer(merged);
    });
  }

  async handleOrgBrandingUpdated(event: DomainEvent): Promise<void> {
    const payload = event.payload as Record<string, unknown>;
    const tenantId = event.tenantId;

    // Defensive note (docs/decisions.md D-F10-READMODEL-ORDERING): org.branding_updated
    // is emitted with two different payload shapes by two different call sites in
    // services/organization — organization.service.ts's updateOrganization() sends
    // top-level { logo, brandColours }, while brand-kit.service.ts's updateBrandKit()
    // sends { brandKit: { logo?, brandColours }, fieldLocks }. Both are accepted here.
    const nestedBrandKit = payload.brandKit as Record<string, unknown> | undefined;
    const incomingLogo = (payload.logo as string | undefined) ?? (nestedBrandKit?.logo as string | undefined);
    const incomingBrandColours =
      (payload.brandColours as OrgReadModel['brandColours'] | undefined) ??
      (nestedBrandKit?.brandColours as OrgReadModel['brandColours'] | undefined);

    await this.withTenant(tenantId, async () => {
      const existing = await this.orgReadModelRepo.findByTenantId(tenantId);
      const merged: OrgReadModel = {
        tenantId,
        businessId: (payload.businessId as string) ?? existing?.businessId ?? '',
        name: existing?.name ?? '',
        slug: existing?.slug ?? '',
        logo: incomingLogo ?? existing?.logo,
        brandColours: incomingBrandColours ?? existing?.brandColours,
        verifiedBadge: existing?.verifiedBadge ?? false,
        cardApprovalRequired: existing?.cardApprovalRequired ?? false,
        aggregateVersion: event.aggregateVersion ?? (existing?.aggregateVersion ?? 0) + 1,
        updatedAt: event.occurredAt,
      };

      const applied = await this.orgReadModelRepo.upsertIfNewer(merged);
      if (!applied) return;

      // AC-4 (F06) / AC-6 (F10): branding changes must reach every published
      // card within 60 seconds. Revalidate every currently published card.
      const publishedCards = await this.cardsService.listPublishedCardsForTenant(tenantId);
      for (const card of publishedCards) {
        await this.revalidationNotifier.revalidateCard({ cardId: card.id, slug: card.slug, tenantId });
      }
    });
  }

  /**
   * AC-1 / ADR-0003: kyb.status_changed updates the org read model's
   * verification badge and revalidates published cards.
   */
  async handleKybStatusChanged(event: DomainEvent): Promise<void> {
    const payload = event.payload as Record<string, unknown>;
    const tenantId = event.tenantId;
    const isVerified = payload.status === 'verified';

    await this.withTenant(tenantId, async () => {
      const existing = await this.orgReadModelRepo.findByTenantId(tenantId);
      if (!existing) return;

      const merged: OrgReadModel = {
        ...existing,
        verifiedBadge: isVerified,
        aggregateVersion: event.aggregateVersion ?? existing.aggregateVersion + 1,
        updatedAt: event.occurredAt,
      };

      const applied = await this.orgReadModelRepo.upsertIfNewer(merged);
      if (!applied) return;

      // Revalidate every currently published card when verification badge changes
      const publishedCards = await this.cardsService.listPublishedCardsForTenant(tenantId);
      for (const card of publishedCards) {
        await this.revalidationNotifier.revalidateCard({ cardId: card.id, slug: card.slug, tenantId });
      }
    });
  }

  async handleBranchEvent(event: DomainEvent, forceStatus?: string): Promise<void> {
    const payload = event.payload as Record<string, unknown>;
    const tenantId = event.tenantId;
    const branchId = payload.branchId as string;

    await this.withTenant(tenantId, async () => {
      const existing = await this.branchReadModelRepo.findByBranchId(branchId);
      const merged: BranchReadModel = {
        branchId,
        tenantId,
        name: (payload.name as string) ?? existing?.name ?? '',
        address: (payload.address as string | undefined) ?? existing?.address,
        mapPin: (payload.mapPin as BranchReadModel['mapPin']) ?? existing?.mapPin,
        status: forceStatus ?? (payload.status as string | undefined) ?? existing?.status ?? 'active',
        aggregateVersion: (existing?.aggregateVersion ?? 0) + 1,
        updatedAt: event.occurredAt,
      };
      await this.branchReadModelRepo.upsertIfNewer(merged);
    });
  }

  async handleSeatCreated(event: DomainEvent): Promise<void> {
    const payload = event.payload as Record<string, unknown>;
    const tenantId = event.tenantId;
    const seatId = payload.seatId as string;

    await this.withTenant(tenantId, async () => {
      const merged: SeatReadModel = {
        seatId,
        tenantId,
        title: (payload.title as string) ?? '',
        branchId: payload.branchId as string | undefined,
        departmentId: payload.departmentId as string | undefined,
        personId: payload.personId as string | undefined,
        status: (payload.status as string) ?? 'vacant',
        aggregateVersion: 1,
        updatedAt: event.occurredAt,
      };
      await this.seatReadModelRepo.upsertIfNewer(merged);

      // AC-1: "Each seat has one card."
      await this.cardsService.ensureDraftCardForSeat(tenantId, seatId);
    });
  }

  async handleSeatEvent(event: DomainEvent): Promise<void> {
    const payload = event.payload as Record<string, unknown>;
    const tenantId = event.tenantId;
    const seatId = payload.seatId as string;

    await this.withTenant(tenantId, async () => {
      const existing = await this.seatReadModelRepo.findBySeatId(seatId);
      const merged: SeatReadModel = {
        seatId,
        tenantId,
        title: (payload.title as string | undefined) ?? existing?.title ?? '',
        branchId: (payload.branchId as string | undefined) ?? existing?.branchId,
        departmentId: (payload.departmentId as string | undefined) ?? existing?.departmentId,
        personId: (payload.personId as string | undefined) ?? existing?.personId,
        status: (payload.status as string | undefined) ?? existing?.status ?? 'vacant',
        aggregateVersion: (existing?.aggregateVersion ?? 0) + 1,
        updatedAt: event.occurredAt,
      };
      await this.seatReadModelRepo.upsertIfNewer(merged);
    });
  }

  async handleSeatStatusChanged(event: DomainEvent): Promise<void> {
    const payload = event.payload as Record<string, unknown>;
    const tenantId = event.tenantId;
    const seatId = payload.seatId as string;
    const newStatus = payload.newStatus as string;

    await this.withTenant(tenantId, async () => {
      const existing = await this.seatReadModelRepo.findBySeatId(seatId);
      const merged: SeatReadModel = {
        seatId,
        tenantId,
        title: existing?.title ?? '',
        branchId: existing?.branchId,
        departmentId: existing?.departmentId,
        personId: existing?.personId,
        status: newStatus,
        aggregateVersion: (existing?.aggregateVersion ?? 0) + 1,
        updatedAt: event.occurredAt,
      };
      await this.seatReadModelRepo.upsertIfNewer(merged);

      // F10 out-of-scope note: redirecting/deactivating a card on offboarding
      // is F16 (Step 4). This consumer only keeps the read model accurate.
    });
  }
}
