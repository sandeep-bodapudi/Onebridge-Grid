import { Role, TenantContext } from '@onebridge/shared';
import type { CompanyProfileSettings, PublicCompanyProfile } from '@onebridge/api-contracts';
import {
  CompanyProfileProps,
  catalogueLimitFor,
  emptyCompanyProfile,
  validateCompanyProfile,
} from '../domain/company-profile.js';
import { CardProps } from '../domain/card.js';
import { createAnalyticsEvent } from '../domain/analytics-event.js';
import { MongoCompanyProfileRepository } from '../infrastructure/mongo-company-profile.repository.js';
import { MongoCardRepository } from '../infrastructure/mongo-card.repository.js';
import { MongoAnalyticsEventRepository } from '../infrastructure/mongo-analytics-event.repository.js';
import {
  MongoOrgReadModelRepository,
  MongoSeatReadModelRepository,
  MongoBranchReadModelRepository,
} from '../infrastructure/mongo-read-model.repositories.js';
import { SharebackService, SubmitSharebackOutput } from './shareback.service.js';
import { ProblemError } from './cards.service.js';

const ADMIN_ROLES: Role[] = ['owner', 'admin'];
/** People whose seat is in one of these states are not listed on the company page. */
const HIDDEN_SEAT_STATUSES = ['inactive', 'offboarded', 'unactivated'];

export interface CompanyEnquiryInput {
  name: string;
  phone: string;
  email?: string;
  company?: string;
  message?: string;
  productId?: string;
  branchId?: string;
  consent: boolean;
  turnstileToken?: string;
  clientIp?: string;
}

function aboutOf(card: CardProps): Record<string, unknown> {
  return (card.sections.find((s) => s.type === 'about')?.content ?? {}) as Record<string, unknown>;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * F26: the public company page. Admins manage catalogue, services,
 * portfolio, clients, documents, the people directory and enquiry routing;
 * visitors read the assembled page and send enquiries, which become leads
 * on the routed person's card (source company_enquiry).
 */
export class CompanyProfileService {
  constructor(
    private readonly profileRepo: MongoCompanyProfileRepository,
    private readonly cardRepo: MongoCardRepository,
    private readonly orgRepo: MongoOrgReadModelRepository,
    private readonly seatRepo: MongoSeatReadModelRepository,
    private readonly branchRepo: MongoBranchReadModelRepository,
    private readonly analyticsRepo: MongoAnalyticsEventRepository,
    private readonly sharebackService: SharebackService,
    /** apps/web-public origin; cards live at /c/<slug>, company pages at /<company>. */
    private readonly publicBaseUrl: string,
    private readonly now: () => Date = () => new Date()
  ) {}

  private base(): string {
    return this.publicBaseUrl.replace(/\/+$/, '');
  }

  private async load(tenantId: string): Promise<CompanyProfileProps> {
    return (await this.profileRepo.findForTenant()) ?? emptyCompanyProfile(tenantId, this.now().toISOString());
  }

  private toSettings(profile: CompanyProfileProps, plan: string | undefined): CompanyProfileSettings {
    const { tenantId: _t, updatedAt: _u, ...rest } = profile;
    return { ...rest, limits: { maxProducts: catalogueLimitFor(plan) } } as CompanyProfileSettings;
  }

  async getSettings(tenantId: string): Promise<CompanyProfileSettings> {
    return TenantContext.run(tenantId, async () => {
      const [profile, org] = await Promise.all([this.load(tenantId), this.orgRepo.findByTenantId(tenantId)]);
      return this.toSettings(profile, org?.plan);
    });
  }

  async updateSettings(tenantId: string, role: Role, input: Partial<CompanyProfileSettings>): Promise<CompanyProfileSettings> {
    if (!ADMIN_ROLES.includes(role)) {
      throw new ProblemError(403, 'Forbidden', 'Only owners and admins can change the company page');
    }
    return TenantContext.run(tenantId, async () => {
      const org = await this.orgRepo.findByTenantId(tenantId);
      const valid = validateCompanyProfile(input as Parameters<typeof validateCompanyProfile>[0], org?.plan);
      const saved = await this.profileRepo.save({ ...valid, tenantId, updatedAt: this.now().toISOString() });
      return this.toSettings(saved, org?.plan);
    });
  }

  private async resolve(slug: string) {
    const org = await this.orgRepo.findBySlugGlobal(slug);
    if (!org) throw new ProblemError(404, 'Not Found', 'No company with this address');
    return org;
  }

  async getPublicProfile(slug: string, focusBranchId?: string): Promise<PublicCompanyProfile> {
    const org = await this.resolve(slug);
    return TenantContext.run(org.tenantId, async () => {
      const [profile, cards, seats, branches] = await Promise.all([
        this.load(org.tenantId),
        this.cardRepo.listPublishedByTenant(),
        this.seatRepo.listByTenant(),
        this.branchRepo.listByTenant(),
      ]);
      const lapsed = org.planStatus === 'lapsed';
      const activeBranches = branches.filter((b) => b.status !== 'archived');
      const branchName = new Map(activeBranches.map((b) => [b.branchId, b.name]));
      const seatById = new Map(seats.map((s) => [s.seatId, s]));

      const shown = profile.directory.seatIds.length ? new Set(profile.directory.seatIds) : null;
      const people =
        lapsed || !profile.directory.enabled
          ? []
          : cards
              .filter((c) => !HIDDEN_SEAT_STATUSES.includes(seatById.get(c.ownerId)?.status ?? 'active'))
              .filter((c) => !shown || shown.has(c.ownerId))
              .map((c) => {
                const about = aboutOf(c);
                const seat = seatById.get(c.ownerId);
                return {
                  name: str(about.name) ?? '',
                  designation: str(about.designation) ?? seat?.title ?? '',
                  branchName: seat?.branchId ? branchName.get(seat.branchId) : undefined,
                  photoUrl: str(about.photoUrl),
                  cardUrl: `${this.base()}/c/${c.slug}`,
                  branchId: seat?.branchId,
                };
              })
              .filter((p) => p.name)
              // People at the focused branch first (branch standee QR).
              .sort((a, b) => Number(b.branchId === focusBranchId) - Number(a.branchId === focusBranchId))
              .map(({ branchId: _b, ...p }) => p);

      const focus = focusBranchId && branchName.has(focusBranchId) ? focusBranchId : undefined;
      return {
        status: lapsed ? 'lapsed' : 'active',
        company: {
          id: org.tenantId,
          name: org.name,
          slug: org.slug,
          businessId: org.businessId,
          verifiedBadge: org.verifiedBadge,
          logo: org.logo,
          brandColours: org.brandColours,
          industry: org.industry,
          city: org.city,
          about: org.about,
          website: org.website,
          gstin: org.gstin,
          socialLinks: lapsed ? undefined : org.socialLinks,
        },
        seoIndexable: profile.seoIndexable,
        // Enquiries are routed to a published card; until chat and call requests (N08, N11) a company without one cannot receive them.
        acceptsEnquiries: !lapsed && cards.length > 0,
        focusBranchId: focus,
        branches: activeBranches.map((b) => ({
          id: b.branchId,
          name: b.name,
          address: b.address,
          directionsUrl: b.mapPin
            ? `https://www.google.com/maps/dir/?api=1&destination=${b.mapPin.lat},${b.mapPin.lng}`
            : b.address
              ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(b.address)}`
              : undefined,
        })),
        people,
        products: lapsed ? [] : profile.products,
        services: lapsed ? [] : profile.services,
        portfolio: lapsed ? [] : profile.portfolio,
        clientLogos: lapsed ? [] : profile.clientLogos,
        documents: lapsed
          ? []
          : profile.documents.map((d) => ({
              id: d.id,
              title: d.title,
              sizeBytes: d.sizeBytes,
              downloadUrl: `/${org.slug}/documents/${d.id}`,
            })),
      } as PublicCompanyProfile;
    });
  }

  /**
   * Routes the enquiry to a person (branch contact, then the default
   * contact, then the first published card) and stores it as a lead on
   * that card through the shareback pipeline (encryption, rate limit,
   * Turnstile, duplicate detection).
   */
  async submitEnquiry(slug: string, input: CompanyEnquiryInput): Promise<SubmitSharebackOutput> {
    const org = await this.resolve(slug);
    const { card, sourceTag, note } = await TenantContext.run(org.tenantId, async () => {
      const [profile, cards, branches] = await Promise.all([
        this.load(org.tenantId),
        this.cardRepo.listPublishedByTenant(),
        this.branchRepo.listByTenant(),
      ]);
      if (!cards.length) throw new ProblemError(404, 'Not Found', 'This company is not taking enquiries yet');
      const bySeat = new Map(cards.map((c) => [c.ownerId, c]));
      const routed =
        (input.branchId && bySeat.get(profile.enquiryRouting.branchSeats[input.branchId] ?? '')) ||
        (profile.enquiryRouting.defaultSeatId && bySeat.get(profile.enquiryRouting.defaultSeatId)) ||
        cards[0];
      const product = input.productId ? profile.products.find((p) => p.id === input.productId) : undefined;
      const branch = input.branchId ? branches.find((b) => b.branchId === input.branchId) : undefined;
      const message = str(input.message)?.slice(0, 1000);
      return {
        card: routed,
        sourceTag: (product?.name ?? branch?.name ?? 'Company page').slice(0, 64),
        note: [product ? `Enquiry about: ${product.name}` : 'Enquiry from the company page', message].filter(Boolean).join('\n'),
      };
    });

    return this.sharebackService.submitShareback({
      slug: card.slug,
      name: input.name,
      phone: input.phone,
      email: input.email,
      company: input.company,
      note,
      consent: input.consent,
      source: 'company_enquiry',
      sourceTag,
      turnstileToken: input.turnstileToken,
      clientIp: input.clientIp,
    });
  }

  /** Counts the download (no visitor data) and returns the file to redirect to. */
  async documentUrl(slug: string, documentId: string): Promise<string> {
    const org = await this.resolve(slug);
    return TenantContext.run(org.tenantId, async () => {
      const profile = await this.load(org.tenantId);
      const doc = org.planStatus === 'lapsed' ? undefined : profile.documents.find((d) => d.id === documentId);
      if (!doc) throw new ProblemError(404, 'Not Found', 'Unknown document');
      await this.record(org.tenantId, 'document_downloaded', { documentId: doc.id });
      return doc.url;
    });
  }

  /** company_page_viewed, counted server-side so the tenant comes from the slug, not the visitor. */
  async recordView(slug: string, branchId?: string): Promise<void> {
    const org = await this.resolve(slug);
    await TenantContext.run(org.tenantId, () =>
      this.record(org.tenantId, 'company_page_viewed', branchId ? { branchId: branchId.slice(0, 64) } : undefined)
    );
  }

  private async record(tenantId: string, eventType: string, properties?: Record<string, unknown>): Promise<void> {
    try {
      await this.analyticsRepo.save(createAnalyticsEvent({ tenantId, eventType, source: 'company_page', properties }));
    } catch {
      // Analytics must never break the visitor's request.
    }
  }
}
