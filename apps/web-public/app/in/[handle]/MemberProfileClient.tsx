'use client';

import React from 'react';
import { MemberProfileView, type MemberProfileData } from '@onebridge/ui-kit';

/** Client wrapper: the ui-kit barrel is client-only. */
export function MemberProfileClient({ profile }: { profile: MemberProfileData }) {
  return <MemberProfileView profile={profile} companyHref={(slug) => `/${slug}`} />;
}
