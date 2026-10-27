'use client';

import React from 'react';
import { FollowButton, MemberProfileView, type MemberProfileData } from '@onebridge/ui-kit';

/** Client wrapper: the ui-kit barrel is client-only. */
export function MemberProfileClient({ profile, appUrl = '' }: { profile: MemberProfileData; appUrl?: string }) {
  return (
    <MemberProfileView
      profile={profile}
      companyHref={(slug) => `/${slug}`}
      actions={<FollowButton following={false} href={`${appUrl}/network/in/${profile.handle}`} targetName={profile.name} />}
    />
  );
}
