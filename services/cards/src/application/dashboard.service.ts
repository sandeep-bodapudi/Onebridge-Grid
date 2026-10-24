import { KeyVaultProvider, Role, TenantContext, decryptLeadPayload } from '@onebridge/shared';
import type { CardSummary, DailyCount, LeadSummary, OverviewStats } from '@onebridge/api-contracts';
import { CardProps } from '../domain/card.js';
import { LeadProps } from '../domain/lead.js';
import { MongoCardRepository } from '../infrastructure/mongo-card.repository.js';
import { MongoLeadRepository } from '../infrastructure/mongo-lead.repository.js';
import { MongoAnalyticsEventRepository } from '../infrastructure/mongo-analytics-event.repository.js';
import { ProblemError } from './cards.service.js';

const ADMIN_ROLES: Role[] = ['owner', 'admin'];
const PERIOD_DAYS = 14;
const DAY_MS = 86_400_000;

function aboutOf(card: CardProps): { name: string; designation: string } {
  const content = (card.sections.find((s) => s.type === 'about')?.content ?? {}) as Record<string, unknown>;
  return {
    name: typeof content.name === 'string' ? content.name : '',
    designation: typeof content.designation === 'string' ? content.designation : '',
  };
}

/** Start of the UTC day `n` days before `now`. */
function dayStart(now: Date, daysAgo: number): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return new Date(d.getTime() - daysAgo * DAY_MS);
}

interface Engagement {
  eventType: string;
  cardId?: string;
  timestamp: string;
}

/**
 * Read-side queries for the admin dashboard: card summaries (names, public
 * URLs and per-card results instead of raw IDs), overview numbers with a
 * 14-day trend, and the prototype leads list.
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
    private readonly leadsPanelEnabled = false,
    private readonly now: () => Date = () => new Date()
  ) {}

  private publicUrl(slug: string): string {
    return `${this.publicBaseUrl.replace(/\/+$/, '')}/c/${slug}`;
  }

  /** Engagement in the current period (and the one before it, for comparisons). */
  private async loadPeriod(): Promise<{ start: Date; previousStart: Date; events: Engagement[]; leads: LeadProps[] }> {
    const now = this.now();
    const start = dayStart(now, PERIOD_DAYS - 1);
    const previousStart = new Date(start.getTime() - PERIOD_DAYS * DAY_MS);
    const [events, leads] = await Promise.all([
      this.analyticsRepo.listEngagementSince(previousStart.toISOString()),
      this.leadRepo.listByTenant(),
    ]);
    return { start, previousStart, events: events as Engagement[], leads };
  }

  async listCardSummaries(tenantId: string): Promise<CardSummary[]> {
    return TenantContext.run(tenantId, async () => {
      const [cards, period] = await Promise.all([this.cardRepo.listByTenant(), this.loadPeriod()]);
      const startMs = period.start.getTime();
      const byCard = new Map<string, { views: number; saves: number; leads: number; daily: number[] }>();
      const statsFor = (id: string) => {
        let s = byCard.get(id);
        if (!s) {
          s = { views: 0, saves: 0, leads: 0, daily: new Array(PERIOD_DAYS).fill(0) };
          byCard.set(id, s);
        }
        return s;
      };
      for (const e of period.events) {
        const t = Date.parse(e.timestamp);
        if (!e.cardId || Number.isNaN(t) || t < startMs) continue;
        const s = statsFor(e.cardId);
        if (e.eventType === 'card_viewed') {
          s.views++;
          const day = Math.floor((t - startMs) / DAY_MS);
          if (day >= 0 && day < PERIOD_DAYS) s.daily[day]++;
        } else if (e.eventType === 'contact_saved') {
          s.saves++;
        }
      }
      for (const lead of period.leads) {
        if (new Date(lead.createdAt).getTime() >= startMs) statsFor(lead.cardId).leads++;
      }

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
          stats: byCard.get(card.id) ?? { views: 0, saves: 0, leads: 0, daily: new Array(PERIOD_DAYS).fill(0) },
        }))
        .sort((a, b) => a.id.localeCompare(b.id));
    });
  }

  async getOverviewStats(tenantId: string): Promise<OverviewStats> {
    return TenantContext.run(tenantId, async () => {
      const [cards, leads, metrics, period] = await Promise.all([
        this.cardRepo.listByTenant(),
        this.leadRepo.listByTenant(),
        this.analyticsRepo.getTenantOverviewMetrics(),
        this.loadPeriod(),
      ]);
      const count = (status: string) => cards.filter((c) => c.status === status).length;
      const startMs = period.start.getTime();
      const prevMs = period.previousStart.getTime();

      const daily: DailyCount[] = Array.from({ length: PERIOD_DAYS }, (_, i) => ({
        date: new Date(startMs + i * DAY_MS).toISOString().slice(0, 10),
        views: 0,
        saves: 0,
      }));
      const totals = { views: 0, saves: 0, previousViews: 0, previousSaves: 0 };
      const viewsByCard = new Map<string, number>();
      for (const e of period.events) {
        const t = Date.parse(e.timestamp);
        if (Number.isNaN(t) || t < prevMs) continue;
        const isView = e.eventType === 'card_viewed';
        if (t < startMs) {
          if (isView) totals.previousViews++;
          else totals.previousSaves++;
          continue;
        }
        const day = Math.min(PERIOD_DAYS - 1, Math.floor((t - startMs) / DAY_MS));
        if (isView) {
          totals.views++;
          daily[day].views++;
          if (e.cardId) viewsByCard.set(e.cardId, (viewsByCard.get(e.cardId) ?? 0) + 1);
        } else {
          totals.saves++;
          daily[day].saves++;
        }
      }
      const leadTimes = leads.map((l) => new Date(l.createdAt).getTime());

      const topCards = cards
        .map((c) => ({ id: c.id, ...aboutOf(c), views: viewsByCard.get(c.id) ?? 0 }))
        .filter((c) => c.views > 0)
        .sort((a, b) => b.views - a.views)
        .slice(0, 5);

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
        period: {
          days: PERIOD_DAYS,
          views: totals.views,
          saves: totals.saves,
          leads: leadTimes.filter((t) => t >= startMs).length,
          previousViews: totals.previousViews,
          previousSaves: totals.previousSaves,
          previousLeads: leadTimes.filter((t) => t >= prevMs && t < startMs).length,
        },
        daily,
        topCards,
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
