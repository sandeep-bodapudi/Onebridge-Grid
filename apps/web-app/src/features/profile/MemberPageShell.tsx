'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SpanMark } from '@onebridge/ui-kit';
import { apiClient } from '../../api-client';

export interface MemberSession {
  personId: string;
  name?: string;
  hasCompany: boolean;
}

/**
 * Minimal signed-in frame for member pages (N01). Members do not need a
 * company, so these pages live outside the company dashboard.
 */
export const MemberPageShell: React.FC<{ children: (session: MemberSession) => React.ReactNode; light?: boolean }> = ({ children, light }) => {
  const router = useRouter();
  const [session, setSession] = useState<MemberSession | null>(null);

  useEffect(() => {
    (async () => {
      if (!apiClient.getAccessToken()) await apiClient.silentRefresh();
      const me = (await apiClient.getMe()) as { person?: { id?: string; name?: string }; activeTenant?: { tenantId?: string; id?: string } };
      setSession({ personId: me.person?.id ?? '', name: me.person?.name, hasCompany: Boolean(me.activeTenant?.tenantId || me.activeTenant?.id) });
    })().catch(() => router.push('/login'));
  }, [router]);

  const signOut = async () => {
    await apiClient.logout();
    router.push('/login');
  };

  return (
    <div className={`min-h-screen ${light ? 'light bg-warm-paper text-charcoal' : 'bg-charcoal-deep text-warm-paper'}`}>
      <header className="sticky top-0 z-30 bg-charcoal border-b border-white/[0.08] text-warm-paper">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <a href={session?.hasCompany ? '/dashboard' : '/profile'} className="flex items-center gap-2.5 font-bold min-h-[44px]">
            <SpanMark />
            OneBridge Grid
          </a>
          <nav aria-label="Account" className="flex items-center gap-1 text-sm font-semibold overflow-x-auto min-w-0">
            {session?.hasCompany ? (
              <a href="/dashboard" className="min-h-[44px] px-3 inline-flex items-center rounded-[10px] hover:bg-white/10">
                Company dashboard
              </a>
            ) : null}
            <a href="/network/following" className="min-h-[44px] px-3 inline-flex items-center rounded-[10px] hover:bg-white/10">
              Following
            </a>
            <a href="/profile" className="min-h-[44px] px-3 inline-flex items-center rounded-[10px] hover:bg-white/10">
              My profile
            </a>
            <button type="button" onClick={signOut} className="min-h-[44px] px-3 inline-flex items-center rounded-[10px] hover:bg-white/10">
              Sign out
            </button>
          </nav>
        </div>
      </header>
      {session ? children(session) : (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10" aria-busy="true">
          <div className="h-8 w-48 rounded bg-white/10 animate-pulse motion-reduce:animate-none" />
        </div>
      )}
    </div>
  );
};
