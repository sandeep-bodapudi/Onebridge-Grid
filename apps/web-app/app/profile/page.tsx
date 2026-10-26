'use client';

import React from 'react';
import { MemberPageShell, ProfileFeature } from '../../src/features/profile';

/** N01: create and edit my member profile (no company needed). */
export default function MyProfilePage() {
  return (
    <MemberPageShell>
      {(session) => (
        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <ProfileFeature suggestedName={session.name} />
        </main>
      )}
    </MemberPageShell>
  );
}
