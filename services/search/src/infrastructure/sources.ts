/** Public data the search service reads from other services' public APIs (ADR-0003). */

export interface CompanyPageSource {
  company: {
    id?: string;
    name: string;
    slug: string;
    verifiedBadge: boolean;
    logo?: string;
    industry?: string;
    city?: string;
    about?: string;
  };
  status: 'active' | 'lapsed';
  seoIndexable: boolean;
  products: Array<{ name: string; category?: string }>;
  services: Array<{ name: string }>;
  portfolio: Array<{ title: string }>;
}

export interface MemberSource {
  personId: string;
  handle: string;
  name: string;
  headline?: string;
  photoUrl?: string;
  visibility: 'everyone' | 'members';
  city?: string;
  about?: string;
  skills?: string[];
}

export interface Sources {
  companyPage(slug: string): Promise<CompanyPageSource | null>;
  members(personIds: string[]): Promise<MemberSource[]>;
}

export class HttpSources implements Sources {
  constructor(
    private readonly cardsUrl: string,
    private readonly profilesUrl: string,
    private readonly serviceKey: string
  ) {}

  async companyPage(slug: string): Promise<CompanyPageSource | null> {
    const res = await fetch(`${this.cardsUrl.replace(/\/+$/, '')}/public/o/${encodeURIComponent(slug)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Cards service returned HTTP ${res.status}`);
    return (await res.json()) as CompanyPageSource;
  }

  async members(personIds: string[]): Promise<MemberSource[]> {
    if (!personIds.length) return [];
    const res = await fetch(`${this.profilesUrl.replace(/\/+$/, '')}/internal/members?ids=${personIds.map(encodeURIComponent).join(',')}`, {
      headers: { 'x-service-key': this.serviceKey },
    });
    if (!res.ok) throw new Error(`Profiles service returned HTTP ${res.status}`);
    return ((await res.json()) as { items: MemberSource[] }).items;
  }
}
