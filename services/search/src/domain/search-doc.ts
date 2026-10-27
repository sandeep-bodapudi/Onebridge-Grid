/**
 * N03: one searchable company or member. Built only from public profile
 * data; contact details are never indexed (D-CONTACT).
 */
export interface SearchDoc {
  /** company:<tenantId> or member:<personId> */
  id: string;
  kind: 'company' | 'member';
  actorId: string;
  name: string;
  /** Company slug or member handle. */
  handle?: string;
  headline?: string;
  photoUrl?: string;
  city?: string;
  citySlug?: string;
  industries: string[];
  /** Products, services and catalogue items (companies) or skills (members), for matching and snippets. */
  tags: string[];
  /** Longer public text (about, portfolio titles). */
  body?: string;
  verified: boolean;
  plan?: string;
  hasCatalogue: boolean;
  /** 0 to 1: how filled-in the profile is. */
  completeness: number;
  /** Members-only profiles are found by signed-in members only. */
  visibility: 'everyone' | 'members';
  /** Company page allows search engines (F26); directory SEO pages list only these. */
  indexable: boolean;
  sizeBand?: string;
  lastActiveAt: string;
  updatedAt: string;
}

export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 2);
}

const DAY = 86_400_000;

/**
 * Relevance first, then boosts (N03): verified, completeness, activity in
 * the last 30 days and Business or Enterprise plans ("priority in search").
 * Returns 0 when a non-empty query does not match.
 */
export function score(doc: SearchDoc, queryTokens: string[], now: Date): { score: number; snippet?: string } {
  let relevance = 0;
  let snippet: string | undefined;
  if (queryTokens.length) {
    const nameTokens = tokens(doc.name);
    const headlineTokens = tokens(doc.headline ?? '');
    const bodyTokens = tokens(doc.body ?? '');
    for (const q of queryTokens) {
      // Word starts match fully; words of 4+ letters also match inside longer words
      // ("bars" in "rebars"), at a lower weight.
      const hitWeight = (list: string[]) =>
        list.some((t) => t === q || t.startsWith(q)) ? 1 : q.length >= 4 && list.some((t) => t.includes(q)) ? 0.6 : 0;
      let best = 0;
      best = Math.max(best, 10 * hitWeight(nameTokens));
      for (const tag of doc.tags) {
        const w = hitWeight(tokens(tag));
        if (w && 7 * w > best) {
          best = 7 * w;
          snippet = tag;
        } else if (w && !snippet) {
          snippet = tag;
        }
      }
      best = Math.max(best, 5 * hitWeight(headlineTokens));
      if (doc.city) best = Math.max(best, 3 * hitWeight(tokens(doc.city)));
      best = Math.max(best, 2 * hitWeight(bodyTokens));
      if (best === 0) return { score: 0 }; // every word must match somewhere
      relevance += best;
    }
  } else {
    relevance = 1;
  }
  const activeRecently = now.getTime() - new Date(doc.lastActiveAt).getTime() < 30 * DAY;
  const boost =
    (doc.verified ? 3 : 0) +
    doc.completeness * 2 +
    (activeRecently ? 1 : 0) +
    (doc.plan === 'business' || doc.plan === 'enterprise' ? 2 : 0);
  return { score: relevance * 10 + boost, snippet };
}
