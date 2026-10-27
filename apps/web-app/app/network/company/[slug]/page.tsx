'use client';

import React, { useEffect, useState } from 'react';
import { CompanyProfilePage, FollowButton, type CompanyProfileData } from '@onebridge/ui-kit';
import type { FollowState } from '@onebridge/api-contracts';
import { apiClient } from '../../../../src/api-client';
import { MemberPageShell } from '../../../../src/features/profile';

function CompanyBody({ slug }: { slug: string }) {
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
        follow && data ? <FollowButton tone="band" following={follow.following} followerCount={follow.followerCount} onToggle={toggle} busy={busy} targetName={data.company.name} /> : null
      }
    />
  );
}

/** N04: a company page as a signed-in member sees it, with Follow. */
export default function NetworkCompanyPage({ params }: { params: { slug: string } }) {
  return <MemberPageShell light>{() => <CompanyBody slug={params.slug} />}</MemberPageShell>;
}
