import React from 'react';
import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import type { PublicMemberProfile } from '@onebridge/api-contracts';
import { MemberProfileClient } from './MemberProfileClient';

// N01: public member profiles. Members-only profiles are not served here
// (the server has no viewer session); visitors are offered sign-in instead.
export const revalidate = 60;

const HANDLE = /^[a-z0-9][a-z0-9-]{2,39}$/;

function profilesUrl(): string {
  return process.env.PROFILES_SERVICE_URL || 'http://localhost:4004';
}

function siteUrl(): string {
  return (process.env.WEB_PUBLIC_URL || 'http://localhost:3003').replace(/\/+$/, '');
}

function appUrl(): string {
  return (process.env.APP_URL || '').replace(/\/+$/, '');
}

type Lookup = { kind: 'profile'; profile: PublicMemberProfile } | { kind: 'moved'; handle: string } | { kind: 'none' };

async function fetchMember(handle: string): Promise<Lookup> {
  if (!HANDLE.test(handle)) return { kind: 'none' };
  try {
    const res = await fetch(`${profilesUrl()}/members/${handle}`, { redirect: 'manual', next: { revalidate: 60, tags: [`member-${handle}`] } });
    if (res.status === 301) {
      const body = (await res.json().catch(() => ({}))) as { handle?: string };
      return body.handle ? { kind: 'moved', handle: body.handle } : { kind: 'none' };
    }
    if (!res.ok) return { kind: 'none' };
    return { kind: 'profile', profile: (await res.json()) as PublicMemberProfile };
  } catch {
    return { kind: 'none' };
  }
}

interface PageProps {
  params: { handle: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const result = await fetchMember(params.handle);
  if (result.kind !== 'profile') return { title: 'Profile | OneBridge Grid', robots: { index: false, follow: false } };
  const p = result.profile;
  const title = `${p.name}${p.headline ? ` | ${p.headline}` : ''}`;
  const description = p.about?.slice(0, 160) || `${p.name} on OneBridge Grid${p.city ? `, ${p.city}` : ''}.`;
  return {
    title,
    description,
    alternates: { canonical: `${siteUrl()}/in/${p.handle}` },
    // Individuals are not indexed unless they opt in (N01).
    robots: { index: p.indexable, follow: p.indexable },
    openGraph: { title, description, type: 'profile', images: p.photoUrl ? [{ url: p.photoUrl }] : undefined },
  };
}

export default async function MemberProfilePage({ params }: PageProps) {
  const result = await fetchMember(params.handle);
  if (result.kind === 'moved') permanentRedirect(`/in/${result.handle}`);
  if (result.kind === 'none') {
    // Members-only, private, or not found: the same page, so nothing leaks.
    return (
      <main className="min-h-screen w-full flex items-center justify-center bg-warm-paper p-6 text-charcoal">
        <div className="text-center max-w-sm space-y-3">
          <h1 className="text-xl font-bold">This profile is not public</h1>
          <p className="text-sm text-charcoal/70">It may be visible only to signed-in members, or it does not exist.</p>
          <a
            href={`${appUrl()}/network/in/${encodeURIComponent(params.handle)}`}
            className="inline-flex min-h-[48px] items-center px-5 rounded-[14px] bg-charcoal text-warm-paper text-sm font-bold"
          >
            Sign in to view
          </a>
        </div>
      </main>
    );
  }
  const p = result.profile;
  const current = p.workHistory.find((w) => !w.endDate);
  const ld = p.indexable
    ? JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: p.name,
        jobTitle: current?.title,
        worksFor: current ? { '@type': 'Organization', name: current.companyName } : undefined,
        address: p.city ? { '@type': 'PostalAddress', addressLocality: p.city } : undefined,
        url: `${siteUrl()}/in/${p.handle}`,
        knowsAbout: p.skills,
      }).replace(/</g, '\\u003c')
    : null;
  return (
    <main className="w-full">
      {ld ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld }} /> : null}
      <MemberProfileClient profile={p} />
    </main>
  );
}
