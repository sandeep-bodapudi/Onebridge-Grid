'use client';

import React, { useEffect, useState } from 'react';
import { MemberProfileView, Skeleton } from '@onebridge/ui-kit';
import type { PublicMemberProfile } from '@onebridge/api-contracts';
import { apiClient } from '../../../../src/api-client';
import { MemberPageShell } from '../../../../src/features/profile';

const WEB_PUBLIC_URL = process.env.NEXT_PUBLIC_WEB_PUBLIC_URL ?? '';

function ProfileBody({ handle }: { handle: string }) {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'missing' | 'error'; profile?: PublicMemberProfile; error?: string }>({ status: 'loading' });

  useEffect(() => {
    apiClient
      .getMemberProfile(handle)
      .then((profile) => setState(profile ? { status: 'ready', profile } : { status: 'missing' }))
      .catch((err: Error) => setState({ status: 'error', error: err.message }));
  }, [handle]);

  if (state.status === 'loading') {
    return (
      <div className="max-w-[760px] mx-auto px-4 py-10 space-y-3" aria-busy="true">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (state.status !== 'ready' || !state.profile) {
    return (
      <div className="max-w-[760px] mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-bold">{state.status === 'error' ? 'Could not load this profile' : 'Profile not found'}</h1>
        <p className="text-sm text-charcoal/70 mt-2">{state.error ?? 'Check the address, or the person may have hidden or deleted their profile.'}</p>
      </div>
    );
  }
  return <MemberProfileView profile={state.profile} companyHref={(slug) => `${WEB_PUBLIC_URL}/${slug}`} />;
}

/** N01: a member's profile as a signed-in member sees it (members-only profiles included). */
export default function NetworkProfilePage({ params }: { params: { handle: string } }) {
  return <MemberPageShell light>{() => <ProfileBody handle={params.handle} />}</MemberPageShell>;
}
