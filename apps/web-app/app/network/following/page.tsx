'use client';

import React, { useEffect, useState } from 'react';
import { Avatar, Skeleton } from '@onebridge/ui-kit';
import type { ActorSummary } from '@onebridge/api-contracts';
import { apiClient } from '../../../src/api-client';
import { MemberPageShell } from '../../../src/features/profile';

function FollowingList() {
  const [items, setItems] = useState<ActorSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .listFollowing()
      .then((page) => setItems(page.items))
      .catch((err: Error) => setError(err.message));
  }, []);

  const unfollow = async (a: ActorSummary) => {
    setBusy(a.id);
    try {
      await apiClient.unfollow(a.type, a.id);
      setItems((list) => (list ?? []).filter((x) => !(x.type === a.type && x.id === a.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not unfollow.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl md:text-[28px] font-bold tracking-tight">Following</h1>
      <p className="text-sm text-warm-paper/60 mt-1">Companies and people whose updates you follow.</p>
      {error ? (
        <p role="alert" className="mt-4 text-sm px-3 py-2.5 rounded-[10px] bg-error/15 border border-error/40">
          {error}
        </p>
      ) : null}
      {items === null && !error ? (
        <div className="mt-6 space-y-2" aria-busy="true">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : null}
      {items && items.length === 0 ? (
        <p className="mt-6 rounded-[14px] bg-charcoal border border-white/[0.08] p-5 text-sm text-warm-paper/70">
          You are not following anyone yet. Open a company page or a profile and tap Follow.
        </p>
      ) : null}
      {items && items.length ? (
        <ul className="mt-6 space-y-2">
          {items.map((a) => (
            <li key={`${a.type}-${a.id}`} className="rounded-[14px] bg-charcoal border border-white/[0.08] p-3.5 flex items-center gap-3">
              <Avatar name={a.name} />
              <a href={a.type === 'company' ? `/network/company/${a.handle}` : `/network/in/${a.handle}`} className="min-w-0 flex-1">
                <span className="block font-semibold truncate">{a.name}</span>
                <span className="block text-xs text-warm-paper/55 truncate">
                  {a.type === 'company' ? 'Company' : 'Member'}
                  {a.headline ? ` · ${a.headline}` : ''}
                  {a.verified ? ' · Verified' : ''}
                </span>
              </a>
              <button
                type="button"
                onClick={() => unfollow(a)}
                disabled={busy === a.id}
                aria-label={`Unfollow ${a.name}`}
                className="min-h-[44px] px-4 rounded-[10px] border border-white/15 text-sm font-bold hover:bg-white/10 disabled:opacity-60"
              >
                Unfollow
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}

/** N04: who I follow. */
export default function FollowingPage() {
  return <MemberPageShell>{() => <FollowingList />}</MemberPageShell>;
}
