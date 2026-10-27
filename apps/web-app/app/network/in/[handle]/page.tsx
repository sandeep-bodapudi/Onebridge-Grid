'use client';

import React, { useEffect, useState } from 'react';
import { FollowButton, MemberProfileView, Skeleton } from '@onebridge/ui-kit';
import type { FollowState, PublicMemberProfile } from '@onebridge/api-contracts';
import { apiClient } from '../../../../src/api-client';
import { MemberPageShell, type MemberSession } from '../../../../src/features/profile';

function ProfileBody({ handle, session }: { handle: string; session: MemberSession }) {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'missing' | 'error'; profile?: PublicMemberProfile; error?: string }>({ status: 'loading' });
  const [follow, setFollow] = useState<FollowState | null>(null);
  const [busy, setBusy] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .getMemberProfile(handle)
      .then((profile) => {
        setState(profile ? { status: 'ready', profile } : { status: 'missing' });
        if (profile && profile.personId !== session.personId) {
          apiClient.getFollowState('member', profile.personId).then(setFollow).catch(() => setFollow(null));
        }
      })
      .catch((err: Error) => setState({ status: 'error', error: err.message }));
  }, [handle, session.personId]);

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
  const profile = state.profile;
  const toggle = async () => {
    if (!follow) return;
    setBusy(true);
    setFollowError(null);
    try {
      setFollow(follow.following ? await apiClient.unfollow('member', profile.personId) : await apiClient.follow('member', profile.personId, 'profile'));
    } catch (err) {
      setFollowError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <MemberProfileView
      profile={profile}
      companyHref={(slug) => `/network/company/${slug}`}
      actions={
        follow ? (
          <span className="flex flex-col gap-1">
            <FollowButton following={follow.following} followerCount={follow.followerCount} onToggle={toggle} busy={busy} targetName={profile.name} />
            {followError ? (
              <span role="alert" className="text-sm text-error">
                {followError}
              </span>
            ) : null}
          </span>
        ) : profile.personId === session.personId ? (
          <a href="/profile" className="min-h-[48px] px-5 rounded-[14px] border border-sand-border bg-white text-sm font-bold inline-flex items-center">
            Edit my profile
          </a>
        ) : null
      }
    />
  );
}

/** N01, N04: a member's profile as a signed-in member sees it, with Follow. */
export default function NetworkProfilePage({ params }: { params: { handle: string } }) {
  return <MemberPageShell light>{(session) => <ProfileBody handle={params.handle} session={session} />}</MemberPageShell>;
}
