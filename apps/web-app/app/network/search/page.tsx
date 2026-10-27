'use client';

import React, { useEffect, useState } from 'react';
import { SearchResultsList, Skeleton } from '@onebridge/ui-kit';
import type { Industry, SearchResults } from '@onebridge/api-contracts';
import { apiClient } from '../../../src/api-client';
import { MemberPageShell } from '../../../src/features/profile';

const field = 'w-full min-h-[48px] px-3 rounded-[12px] border border-sand-border bg-white text-charcoal text-base focus:outline-none focus:border-bridge-orange focus:ring-1 focus:ring-bridge-orange';

function NetworkSearch() {
  const [form, setForm] = useState({ q: '', type: '', industry: '', city: '', verified: false });
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (cursor?: string) => {
    setLoading(true);
    setError(null);
    try {
      const page = await apiClient.search({ ...form, cursor });
      setResults((prev) => (cursor && prev ? { ...page, items: [...prev.items, ...page.items] } : page));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search is not available right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    apiClient.industries().then(setIndustries).catch(() => setIndustries([]));
    void run();
  }, []);

  return (
    <main className="max-w-[860px] mx-auto px-4 sm:px-6 py-8 text-charcoal">
      <h1 className="text-2xl md:text-[28px] font-bold tracking-tight">Search</h1>
      <p className="text-sm text-charcoal/65 mt-1">Companies and people on OneBridge Grid, including profiles visible only to members.</p>
      <form
        role="search"
        className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <label htmlFor="ns-q" className="sr-only">
          Search
        </label>
        <input id="ns-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} placeholder="Product, service, skill or name" className={field} />
        <button type="submit" className="min-h-[48px] px-6 rounded-[12px] bg-bridge-orange text-[#241A10] font-extrabold">
          Search
        </button>
        <div className="sm:col-span-2 grid gap-3 sm:grid-cols-4">
          <div>
            <label htmlFor="ns-type" className="block text-xs font-semibold text-charcoal/70 mb-1">
              Show
            </label>
            <select id="ns-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={field}>
              <option value="">Companies and people</option>
              <option value="company">Companies</option>
              <option value="member">People</option>
            </select>
          </div>
          <div>
            <label htmlFor="ns-industry" className="block text-xs font-semibold text-charcoal/70 mb-1">
              Industry
            </label>
            <select id="ns-industry" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} className={field}>
              <option value="">Any industry</option>
              {industries.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ns-city" className="block text-xs font-semibold text-charcoal/70 mb-1">
              City
            </label>
            <input id="ns-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Hyderabad" className={field} />
          </div>
          <label className="flex items-center gap-2 text-sm min-h-[48px] sm:mt-5">
            <input type="checkbox" checked={form.verified} onChange={(e) => setForm({ ...form, verified: e.target.checked })} className="w-5 h-5 accent-bridge-orange" />
            Verified only
          </label>
        </div>
      </form>

      <div className="mt-6">
        {error ? (
          <p role="alert" className="rounded-2xl bg-white border border-sand-border p-5 text-sm">
            {error}
          </p>
        ) : !results ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <>
            <SearchResultsList
              items={results.items}
              total={results.total}
              hrefFor={(item) => (item.actor.type === 'company' ? `/network/company/${item.actor.handle}` : `/network/in/${item.actor.handle}`)}
            />
            {results.nextCursor ? (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => run(results.nextCursor)}
                  className="min-h-[48px] px-5 rounded-[12px] bg-white border border-sand-border font-bold text-sm disabled:opacity-60"
                >
                  More results
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}

/** N03: signed-in search (members-only profiles included). */
export default function NetworkSearchPage() {
  return <MemberPageShell light>{() => <NetworkSearch />}</MemberPageShell>;
}
