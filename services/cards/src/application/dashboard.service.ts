import { KeyVaultProvider, Role, TenantContext, decryptLeadPayload } from '@onebridge/shared';
import type { CardSummary, LeadSummary, OverviewStats } from '@onebridge/api-contracts';
import { CardProps } from '../domain/card.js';
import { MongoCardRepository } from '../infrastructure/mongo-card.repository.js';
import { MongoLeadRepository } from '../infrastructure/mongo-lead.repository.js';
import { MongoAnalyticsEventRepository } from '../infrastructure/mongo-analytics-event.repository.js';
import { ProblemError } from './cards.service.js';

const ADMIN_ROLES: Role[] = ['owner', 'admin'];

function aboutOf(card: CardProps): { name: string; designation: string } {
  const content = (card.sections.find((s) => s.type === 'about')?.content ?? {}) as Record<string, unknown>;
  return {
    name: typeof content.name === 'string' ? content.name : '',
    designation: typeof content.designation === 'string' ? content.designation : '',
  };
}

/**
 * Read-side queries for the admin dashboard: card summaries (names and public
 * URLs instead of raw IDs), overview numbers, and the prototype leads list.
 */
export class DashboardService {
  constructor(
    private readonly cardRepo: MongoCardRepository,
    private readonly leadRepo: MongoLeadRepository,
    private readonly analyticsRepo: MongoAnalyticsEventRepository,
    private readonly keyVault: KeyVaultProvider,
    /** apps/web-public origin (WEB_PUBLIC_URL); visitor pages live at /c/<slug>. */
    private readonly publicBaseUrl: string,
    /** Flag demo_leads_panel: the read-only leads list is a prototype feature, off by default. */
    private readonly leadsPanelEnabled = false
  ) {}

  private publicUrl(slug: string): string {
    return `${this.publicBaseUrl.replace(/\/+$/, '')}/c/${slug}`;
  }

  async listCardSummaries(tenantId: string): Promise<CardSummary[]> {
    const cards = await TenantContext.run(tenantId, () => this.cardRepo.listByTenant());
    return cards
      .map((card) => ({
        id: card.id,
        seatId: card.ownerId,
        slug: card.slug,
        status: card.status as CardSummary['status'],
        templateId: card.templateId,
        ...aboutOf(card),
        publicUrl: this.publicUrl(card.slug),
        updatedAt: card.updatedAt,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  async getOverviewStats(tenantId: string): Promise<OverviewStats> {
    return TenantContext.run(tenantId, async () => {
      const [cards, leads, metrics] = await Promise.all([
        this.cardRepo.listByTenant(),
        this.leadRepo.listByTenant(),
        this.analyticsRepo.getTenantOverviewMetrics(),
      ]);
      const count = (status: string) => cards.filter((c) => c.status === status).length;
      return {
        cards: {
          total: cards.length,
          published: count('published'),
          draft: count('draft'),
          pendingApproval: count('pending_approval'),
        },
        views: metrics.views,
        saves: metrics.saves,
        qrScans: metrics.qrScans,
        leads: leads.length,
      };
    });
  }

  async listLeads(tenantId: string, role: Role): Promise<LeadSummary[]> {
    if (!this.leadsPanelEnabled) {
      throw new ProblemError(404, 'Not Found', 'The leads panel is not enabled');
    }
    if (!ADMIN_ROLES.includes(role)) {
      throw new ProblemError(403, 'Forbidden', 'Only owners and admins can view leads');
    }
    return TenantContext.run(tenantId, async () => {
      const [leads, cards] = await Promise.all([this.leadRepo.listByTenant(), this.cardRepo.listByTenant()]);
      const ownerNames = new Map(cards.map((c) => [c.id, aboutOf(c).name]));
      const items: LeadSummary[] = [];
      for (const lead of leads) {
        const key = await this.keyVault.getKeyByKid(lead.encryptedPayload.kid);
        const data = decryptLeadPayload({ encrypted: lead.encryptedPayload, key, tenantId, leadId: lead.id });
        items.push({
          id: lead.id,
          cardId: lead.cardId,
          ownerName: ownerNames.get(lead.cardId) || undefined,
          source: lead.source,
          sourceTag: lead.sourceTag,
          name: data.name,
          phone: data.phone,
          email: data.email,
          company: data.company,
          note: data.note,
          createdAt: new Date(lead.createdAt).toISOString(),
        });
      }
      return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });
  }
}
