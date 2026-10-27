import { NotFoundException } from '@nestjs/common';
import type { DirectoryPage, Industry as IndustryDto, SearchHit, SearchResults } from '@onebridge/api-contracts';
import { INDUSTRIES, citySlug, industriesFor } from '../domain/taxonomy.js';
import { SearchDoc, score, tokens } from '../domain/search-doc.js';
import { SearchIndex } from '../infrastructure/search-index.js';
import { Sources } from '../infrastructure/sources.js';

const PAGE = 20;
const CANDIDATES = 500;

export interface SearchParams {
  q?: string;
  type?: string;
  industry?: string;
  city?: string;
  verified?: boolean;
  size?: string;
  hasCatalogue?: boolean;
  cursor?: string;
}

interface DomainEvent {
  type: string;
  tenantId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

const decodeCursor = (c?: string) => {
  const n = c ? parseInt(Buffer.from(c, 'base64url').toString('utf8'), 10) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const encodeCursor = (n: number) => Buffer.from(String(n), 'utf8').toString('base64url');

function toHit(doc: SearchDoc, snippet?: string): SearchHit {
  return {
    actor: {
      type: doc.kind,
      id: doc.actorId,
      handle: doc.handle,
      name: doc.name,
      headline: doc.headline,
      photoUrl: doc.photoUrl,
      verified: doc.verified,
    },
    city: doc.city,
    industries: doc.industries,
    snippet,
    // Paid placement (add-on) is not sold yet; when it is, it is always labelled.
    featured: false,
  };
}

/**
 * N03: directory and search over companies and members. The index is
 * kept fresh from events (company, KYB, company page, member profile).
 */
export class SearchService {
  constructor(
    private readonly index: SearchIndex,
    private readonly sources: Sources,
    private readonly now: () => Date = () => new Date()
  ) {}

  // ---------------------------------------------------------------- indexing
  private async refreshCompanyPage(doc: SearchDoc): Promise<SearchDoc> {
    if (!doc.handle) return doc;
    const page = await this.sources.companyPage(doc.handle).catch(() => null);
    if (!page) return doc;
    const lapsed = page.status === 'lapsed';
    const tags = lapsed
      ? []
      : [
          ...page.products.map((p) => p.name),
          ...Array.from(new Set(page.products.map((p) => p.category).filter((c): c is string => Boolean(c)))),
          ...page.services.map((s) => s.name),
        ];
    const body = [page.company.about, ...(lapsed ? [] : page.portfolio.map((w) => w.title))].filter(Boolean).join(' · ');
    const filled = [page.company.about, page.company.logo, page.products.length > 0, page.company.city].filter(Boolean).length;
    return {
      ...doc,
      name: page.company.name,
      photoUrl: page.company.logo ?? doc.photoUrl,
      verified: page.company.verifiedBadge,
      tags: tags.slice(0, 300),
      body: body.slice(0, 4000) || undefined,
      hasCatalogue: !lapsed && page.products.length > 0,
      completeness: filled / 4,
      indexable: page.seoIndexable && !lapsed,
    };
  }

  async onOrgEvent(event: DomainEvent): Promise<void> {
    const p = event.payload;
    const tenantId = (p.orgId as string) || event.tenantId;
    if (!tenantId || tenantId === 'global') return;
    const id = `company:${tenantId}`;
    const existing = await this.index.get(id);
    const updated = (p.updatedFields ?? {}) as Record<string, unknown>;
    const pick = (k: string) => (updated[k] as string | undefined) ?? (p[k] as string | undefined);
    const name = pick('name') ?? existing?.name;
    if (!name) return;
    const industry = pick('industry');
    const city = pick('city') ?? existing?.city;
    const base: SearchDoc = {
      id,
      kind: 'company',
      actorId: tenantId,
      name,
      handle: pick('slug') ?? existing?.handle,
      headline: [industry ?? existing?.headline?.split(' · ')[0], city].filter(Boolean).join(' · ') || undefined,
      photoUrl: (p.logo as string | undefined) ?? existing?.photoUrl,
      city,
      citySlug: citySlug(city),
      industries: industry ? industriesFor(industry) : existing?.industries ?? [],
      tags: existing?.tags ?? [],
      body: existing?.body,
      verified: event.type === 'kyb.status_changed' ? p.status === 'verified' : existing?.verified ?? false,
      plan: pick('plan') ?? existing?.plan,
      hasCatalogue: existing?.hasCatalogue ?? false,
      completeness: existing?.completeness ?? 0,
      visibility: 'everyone',
      indexable: existing?.indexable ?? true,
      sizeBand: pick('size') ?? existing?.sizeBand,
      lastActiveAt: event.occurredAt,
      updatedAt: event.occurredAt,
    };
    await this.index.upsert(await this.refreshCompanyPage(base));
  }

  /** company_profile.updated: catalogue, services or work changed. */
  async onCompanyProfileUpdated(event: DomainEvent): Promise<void> {
    const tenantId = (event.payload.orgId as string) || event.tenantId;
    const doc = await this.index.get(`company:${tenantId}`);
    if (!doc) return;
    await this.index.upsert(await this.refreshCompanyPage({ ...doc, lastActiveAt: event.occurredAt, updatedAt: event.occurredAt }));
  }

  /** member.registered, member.profile_updated, member.work_history_changed, member.privacy_changed. */
  async onMemberEvent(event: DomainEvent): Promise<void> {
    const personId = event.payload.personId as string;
    if (!personId) return;
    const [m] = await this.sources.members([personId]).catch(() => []);
    if (!m) {
      await this.index.remove(`member:${personId}`);
      return;
    }
    const filled = [m.photoUrl, m.headline, m.city, m.about, (m.skills ?? []).length > 0].filter(Boolean).length;
    await this.index.upsert({
      id: `member:${personId}`,
      kind: 'member',
      actorId: personId,
      name: m.name,
      handle: m.handle,
      headline: m.headline,
      photoUrl: m.photoUrl,
      city: m.city,
      citySlug: citySlug(m.city),
      industries: [],
      tags: (m.skills ?? []).slice(0, 30),
      body: m.about?.slice(0, 2000),
      verified: false,
      hasCatalogue: false,
      completeness: filled / 5,
      visibility: m.visibility,
      indexable: false,
      lastActiveAt: event.occurredAt,
      updatedAt: event.occurredAt,
    });
  }

  /** member.deleted (N10) and moderation removals (N09). */
  async onRemoved(event: DomainEvent): Promise<void> {
    const p = event.payload;
    if (event.type === 'member.deleted' && p.personId) await this.index.remove(`member:${p.personId as string}`);
  }

  // ---------------------------------------------------------------- queries
  private async ranked(params: SearchParams, signedIn: boolean, indexableOnly = false) {
    const words = tokens(params.q ?? '').slice(0, 8);
    const type = params.type === 'company' || params.type === 'member' ? params.type : undefined;
    const docs = await this.index.candidates(
      {
        kind: type,
        industry: params.industry || undefined,
        citySlug: params.city ? citySlug(params.city) : undefined,
        verified: params.verified || undefined,
        hasCatalogue: params.hasCatalogue || undefined,
        sizeBand: params.size || undefined,
        includeMembersOnly: signedIn,
        indexableOnly,
        words,
      },
      CANDIDATES
    );
    const now = this.now();
    return docs
      .map((doc) => ({ doc, ...score(doc, words, now) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || a.doc.name.localeCompare(b.doc.name));
  }

  async search(params: SearchParams, signedIn: boolean): Promise<SearchResults> {
    const ranked = await this.ranked(params, signedIn);
    const offset = decodeCursor(params.cursor);
    const page = ranked.slice(offset, offset + PAGE);
    return {
      items: page.map((r) => toHit(r.doc, r.snippet)),
      total: ranked.length,
      ...(offset + PAGE < ranked.length ? { nextCursor: encodeCursor(offset + PAGE) } : {}),
    };
  }

  async suggest(q: string, signedIn: boolean) {
    const words = tokens(q);
    if (!words.length || q.trim().length < 2) return { items: [] };
    const ranked = (await this.ranked({ q }, signedIn)).slice(0, 6);
    const items: Array<{ kind: 'company' | 'member' | 'industry' | 'product'; label: string; handle?: string }> = ranked.map((r) => ({
      kind: r.doc.kind,
      label: r.doc.name,
      handle: r.doc.handle,
    }));
    const products = Array.from(new Set(ranked.map((r) => r.snippet).filter((s): s is string => Boolean(s)))).slice(0, 3);
    items.push(...products.map((label) => ({ kind: 'product' as const, label })));
    const needle = words.join(' ');
    INDUSTRIES.filter((i) => i.name.toLowerCase().includes(needle)).slice(0, 2).forEach((i) => items.push({ kind: 'industry', label: i.name, handle: i.id }));
    return { items: items.slice(0, 10) };
  }

  /** SEO directory pages: companies only, and only those whose page allows search engines. */
  async directory(city: string, industryId: string, subCategory?: string, cursor?: string): Promise<DirectoryPage> {
    const industry = INDUSTRIES.find((i) => i.id === industryId);
    if (!industry) throw new NotFoundException({ type: 'https://tools.ietf.org/html/rfc7807', title: 'Not Found', status: 404, detail: 'Unknown industry.' });
    if (subCategory && !industry.subCategories.some((s) => s.id === subCategory)) {
      throw new NotFoundException({ type: 'https://tools.ietf.org/html/rfc7807', title: 'Not Found', status: 404, detail: 'Unknown sub-category.' });
    }
    const ranked = await this.ranked({ type: 'company', industry: industryId, city }, false, true);
    const offset = decodeCursor(cursor);
    const page = ranked.slice(offset, offset + PAGE);
    const cityName = ranked[0]?.doc.city ?? city.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      city: cityName,
      industry: this.industryDto(industry),
      items: page.map((r) => toHit(r.doc, r.snippet)),
      total: ranked.length,
      ...(offset + PAGE < ranked.length ? { nextCursor: encodeCursor(offset + PAGE) } : {}),
    };
  }

  private industryDto(i: (typeof INDUSTRIES)[number]): IndustryDto {
    return { id: i.id, name: i.name, nameHi: i.nameHi, subCategories: i.subCategories };
  }

  taxonomy(): { items: IndustryDto[] } {
    return { items: INDUSTRIES.map((i) => this.industryDto(i)) };
  }
}
