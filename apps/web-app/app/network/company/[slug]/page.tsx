'use client';

import React, { useEffect, useState } from 'react';
import { CompanyProfilePage, FollowButton, type CompanyProfileData } from '@onebridge/ui-kit';
import type { FollowState } from '@onebridge/api-contracts';
import { apiClient } from '../../../../src/api-client';
import { MemberPageShell } from '../../../../src/features/profile';

function CompanyBody({ slug, ownCompanyId }: { slug: string; ownCompanyId?: string }) {
  const [data, setData] = useState<CompanyProfileData | null | undefined>(undefined);
  const [follow, setFollow] = useState<FollowState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiClient
      .getPublicCompany(slug)
      .then((company) => {
        setData((company as unknown as CompanyProfileData) ?? null);
        const id = company?.company.id;
        if (id) apiClient.getFollowState('company', id).then(setFollow).catch(() => setFollow(null));
      })
      .catch(() => setData(null));
  }, [slug]);

  const companyId = data?.company.id;
  const toggle = async () => {
    if (!follow || !companyId) return;
    setBusy(true);
    try {
      setFollow(follow.following ? await apiClient.unfollow('company', companyId) : await apiClient.follow('company', companyId, 'profile'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <CompanyProfilePage
      data={data ?? undefined}
      state={data === undefined ? 'loading' : data === null ? 'not_found' : 'ready'}
      heroActions={
        follow && data ? (
          <span className="flex flex-wrap items-center gap-2">
            <FollowButton tone="band" following={follow.following} followerCount={follow.followerCount} onToggle={toggle} busy={busy} targetName={data.company.name} />
            {companyId && companyId !== ownCompanyId ? (
              // N08 (D-CONTACT): message the company instead of calling a number.
              <a
                href={`/messages?to=company:${encodeURIComponent(companyId)}&name=${encodeURIComponent(data.company.name)}`}
                className="min-h-[48px] px-5 rounded-[14px] border border-white/40 text-sm font-bold inline-flex items-center hover:bg-white/10"
              >
                Message
              </a>
            ) : null}
          </span>
        ) : null
      }
    />
  );
}

/** N04: a company page as a signed-in member sees it, with Follow. */
export default function NetworkCompanyPage({ params }: { params: { slug: string } }) {
  return <MemberPageShell light>{(session) => <CompanyBody slug={params.slug} ownCompanyId={session.companyId} />}</MemberPageShell>;
}
