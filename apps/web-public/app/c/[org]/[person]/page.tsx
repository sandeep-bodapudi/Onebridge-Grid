import { cardsServiceUrl } from '../../../../lib/cards-service';
import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { type VisitorCardData, type VisitorCardProps } from '@onebridge/ui-kit';
import type { PublicCardResponse } from '@onebridge/api-contracts';
import { VisitorCardClient } from './VisitorCardClient';

export const revalidate = 86400;

interface PageProps {
  // Card slugs are always "<company-slug>/<person-slug>". A catch-all
  // ([...slug]) cannot be followed by /vcard in Next.js, which stopped the
  // whole app from routing, so the two segments are explicit.
  params: {
    org: string;
    person: string;
  };
  searchParams?: Record<string, string | string[] | undefined>;
}

async function fetchCardData(slug: string): Promise<PublicCardResponse | null> {
  try {
    const res = await fetch(`${cardsServiceUrl()}/public/c/${slug}`, {
      next: { tags: [`card-${slug}`] },
    });

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      throw new Error(`Failed to fetch card: ${res.statusText}`);
    }

    return await res.json();
  } catch {
    // If backend is unavailable, return null to show inactive / 404
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const slugPath = `${params.org}/${params.person}`;
  const card = await fetchCardData(slugPath);

  if (!card || card.status === 'inactive' || card.status === 'unactivated') {
    return {
      title: 'OneBridge Grid | Card Inactive',
      description: 'This business card is currently inactive or not yet activated.',
      robots: { index: false, follow: false },
    };
  }

  const personName = card.person?.name;
  const orgName = card.company?.name || 'OneBridge Grid';
  const designation = card.person?.designation;

  const title = personName ? `${personName} | ${orgName}` : orgName;
  const description = personName && designation
    ? `${personName}, ${designation} at ${orgName}. Save contact or connect instantly.`
    : `Verified digital identity for ${orgName}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      images: card.person?.photoUrl ? [{ url: card.person.photoUrl }] : undefined,
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: card.person?.photoUrl ? [card.person.photoUrl] : undefined,
    },
  };
}

export default async function VisitorCardPage({ params }: PageProps) {
  const slugPath = `${params.org}/${params.person}`;
  const card = await fetchCardData(slugPath);

  if (!card) {
    // If slug not found in system
    return (
      <main className="w-full">
        <Suspense fallback={null}>
          <VisitorCardClient
            state="not_found"
            companyName="OneBridge Grid"
          />
        </Suspense>
      </main>
    );
  }

  let structuredData: object | null = null;
  if (card.status === 'published' && card.person) {
    structuredData = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: card.person.name,
      jobTitle: card.person.designation,
      worksFor: {
        '@type': 'Organization',
        name: card.company?.name,
        identifier: card.company?.businessId,
      },
      telephone: card.person.phone,
      email: card.person.email,
      image: card.person.photoUrl,
    };
  }

  return (
    <main className="w-full">
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      )}
      <Suspense fallback={null}>
        <VisitorCardClient
          card={card as unknown as VisitorCardData}
          state={card.status === 'published' ? 'ready' : (card.status as VisitorCardProps['state'])}
          companyName={card.company?.name}
          offboardedDetails={card.offboardedDetails}
        />
      </Suspense>
    </main>
  );
}

