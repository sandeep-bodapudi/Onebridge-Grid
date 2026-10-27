export interface MemberSummary {
  personId: string;
  handle: string;
  name: string;
  headline?: string;
  photoUrl?: string;
  visibility: 'everyone' | 'members';
}

/** Reads public member summaries from the profiles service (its public API, ADR-0003). */
export interface ProfilesClient {
  summaries(personIds: string[]): Promise<MemberSummary[]>;
}

export class HttpProfilesClient implements ProfilesClient {
  constructor(
    private readonly baseUrl: string,
    private readonly serviceKey: string
  ) {}

  async summaries(personIds: string[]): Promise<MemberSummary[]> {
    const ids = Array.from(new Set(personIds)).filter(Boolean);
    if (!ids.length) return [];
    const res = await fetch(`${this.baseUrl.replace(/\/+$/, '')}/internal/members?ids=${ids.map(encodeURIComponent).join(',')}`, {
      headers: { 'x-service-key': this.serviceKey },
    });
    if (!res.ok) throw new Error(`Profiles service returned HTTP ${res.status}`);
    return ((await res.json()) as { items: MemberSummary[] }).items;
  }
}
