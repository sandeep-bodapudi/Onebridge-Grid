import type { DirectoryPage, Industry, SearchResults } from '@onebridge/api-contracts';

export function searchServiceUrl(): string {
  return process.env.SEARCH_SERVICE_URL || 'http://localhost:4006';
}

export async function fetchTaxonomy(): Promise<Industry[]> {
  try {
    const res = await fetch(`${searchServiceUrl()}/taxonomy/industries`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    return ((await res.json()) as { items: Industry[] }).items;
  } catch {
    return [];
  }
}

export type SearchOutcome = { kind: 'ok'; results: SearchResults } | { kind: 'rate_limited' } | { kind: 'error' };

/** Anonymous search; the visitor's IP is passed on so the service can rate-limit fairly. */
export async function fetchSearch(params: URLSearchParams, clientIp?: string): Promise<SearchOutcome> {
  try {
    const res = await fetch(`${searchServiceUrl()}/search?${params.toString()}`, {
      cache: 'no-store',
      headers: clientIp ? { 'x-forwarded-for': clientIp } : undefined,
    });
    if (res.status === 429) return { kind: 'rate_limited' };
    if (!res.ok) return { kind: 'error' };
    return { kind: 'ok', results: (await res.json()) as SearchResults };
  } catch {
    return { kind: 'error' };
  }
}

export async function fetchDirectory(city: string, industry: string, subCategory?: string): Promise<DirectoryPage | null> {
  const slug = /^[a-z0-9-]{2,60}$/;
  if (!slug.test(city) || !slug.test(industry) || (subCategory && !slug.test(subCategory))) return null;
  try {
    const q = subCategory ? `?subCategory=${subCategory}` : '';
    const res = await fetch(`${searchServiceUrl()}/directory/${city}/${industry}${q}`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return (await res.json()) as DirectoryPage;
  } catch {
    return null;
  }
}
