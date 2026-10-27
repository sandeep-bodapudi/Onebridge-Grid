import React from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { fetchSearch, fetchTaxonomy } from '../../lib/search-service';
import { SearchResultsClient } from './SearchResultsClient';

export const dynamic = 'force-dynamic';

// Search result pages are not for search engines; directory pages are (N03).
export const metadata: Metadata = {
  title: 'Search companies and people | OneBridge Grid',
  description: 'Find verified companies and professionals by product, industry and city.',
  robots: { index: false, follow: true },
};

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

const field = 'w-full min-h-[48px] px-3 rounded-[12px] border border-sand-border bg-white text-charcoal text-base focus:outline-none focus:border-bridge-orange focus:ring-1 focus:ring-bridge-orange';

/** N03: public search. Works without JavaScript (a plain GET form). */
export default async function SearchPage({ searchParams }: { searchParams: SP }) {
  const q = one(searchParams.q).slice(0, 100);
  const type = one(searchParams.type);
  const industry = one(searchParams.industry);
  const city = one(searchParams.city).slice(0, 60);
  const verified = one(searchParams.verified) === 'true';
  const cursor = one(searchParams.cursor);

  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (type === 'company' || type === 'member') params.set('type', type);
  if (industry) params.set('industry', industry);
  if (city) params.set('city', city);
  if (verified) params.set('verified', 'true');
  if (cursor) params.set('cursor', cursor);

  const h = headers();
  const clientIp = h.get('cf-connecting-ip') || h.get('x-forwarded-for')?.split(',')[0].trim() || undefined;
  const [industries, outcome] = await Promise.all([fetchTaxonomy(), fetchSearch(params, clientIp)]);
  const nextParams = new URLSearchParams(params);
  if (outcome.kind === 'ok' && outcome.results.nextCursor) nextParams.set('cursor', outcome.results.nextCursor);

  return (
    <main className="w-full min-h-screen bg-warm-paper text-charcoal">
      <div className="bg-charcoal text-warm-paper">
        <div className="max-w-[860px] mx-auto px-4 sm:px-5 pt-6 pb-8">
          <a href="/" className="text-sm font-bold opacity-80">
            OneBridge Grid
          </a>
          <h1 className="mt-4 text-[28px] sm:text-[34px] font-bold tracking-[-0.03em] leading-tight">Find companies and people</h1>
          <p className="mt-1 text-sm opacity-75">Search by product, service, skill, industry or city.</p>
          <form method="get" action="/search" role="search" className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
            <label htmlFor="q" className="sr-only">
              Search
            </label>
            <input id="q" name="q" defaultValue={q} placeholder="For example: CNC machining, TMT bars, procurement" className={field} />
            <button type="submit" className="min-h-[48px] px-6 rounded-[12px] bg-bridge-orange text-[#241A10] font-extrabold">
              Search
            </button>
            <div className="sm:col-span-2 grid gap-3 sm:grid-cols-4">
              <div>
                <label htmlFor="type" className="block text-xs font-semibold opacity-80 mb-1">
                  Show
                </label>
                <select id="type" name="type" defaultValue={type} className={field}>
                  <option value="">Companies and people</option>
                  <option value="company">Companies</option>
                  <option value="member">People</option>
                </select>
              </div>
              <div>
                <label htmlFor="industry" className="block text-xs font-semibold opacity-80 mb-1">
                  Industry
                </label>
                <select id="industry" name="industry" defaultValue={industry} className={field}>
                  <option value="">Any industry</option>
                  {industries.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="city" className="block text-xs font-semibold opacity-80 mb-1">
                  City
                </label>
                <input id="city" name="city" defaultValue={city} placeholder="Hyderabad" className={field} />
              </div>
              <label className="flex items-center gap-2 text-sm min-h-[48px] sm:mt-5">
                <input type="checkbox" name="verified" value="true" defaultChecked={verified} className="w-5 h-5 accent-bridge-orange" />
                Verified only
              </label>
            </div>
          </form>
        </div>
        <span aria-hidden="true" className="block h-[5px] bg-bridge-orange" />
      </div>

      <div className="max-w-[860px] mx-auto px-4 sm:px-5 py-6">
        {outcome.kind === 'rate_limited' ? (
          <p role="alert" className="rounded-2xl bg-white border border-sand-border p-5 text-sm">
            Too many searches from your network. Wait a minute and try again, or sign in.
          </p>
        ) : outcome.kind === 'error' ? (
          <p role="alert" className="rounded-2xl bg-white border border-sand-border p-5 text-sm">
            Search is not available right now. Try again in a moment.
          </p>
        ) : (
          <>
            <SearchResultsClient
              items={outcome.results.items}
              total={outcome.results.total}
              emptyHint={q ? `Nothing matched “${q}”. Try fewer words, or remove a filter.` : 'No companies or people yet.'}
            />
            {outcome.results.nextCursor ? (
              <div className="mt-4 text-center">
                <a href={`/search?${nextParams.toString()}`} className="inline-flex min-h-[48px] items-center px-5 rounded-[12px] bg-white border border-sand-border font-bold text-sm">
                  More results
                </a>
              </div>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
