import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { PublicCompanyProfile } from '@onebridge/api-contracts';
import type { CompanyProfileData } from '@onebridge/ui-kit';
import { cardsServiceUrl } from './cards-service';
import { CompanyPageClient } from '../app/[company]/CompanyPageClient';

/** Company slugs are lowercase letters, digits and hyphens; anything else is not a company page. */
export const COMPANY_SLUG = /^[a-z0-9][a-z0-9-]{1,62}$/;

export async function fetchCompany(slug: string, branchId?: string): Promise<PublicCompanyProfile | null> {
  if (!COMPANY_SLUG.test(slug)) return null;
  try {
    const query = branchId ? `?branch=${encodeURIComponent(branchId)}` : '';
    const res = await fetch(`${cardsServiceUrl()}/public/o/${slug}${query}`, {
      next: { revalidate: 60, tags: [`company-${slug}`] },
    });
    if (!res.ok) return null;
    return (await res.json()) as PublicCompanyProfile;
  } catch {
    return null;
  }
}

function siteUrl(): string {
  return (process.env.WEB_PUBLIC_URL || 'http://localhost:3003').replace(/\/+$/, '');
}

export function companyMetadata(company: PublicCompanyProfile | null, path: string): Metadata {
  if (!company) {
    return { title: 'Company page not found | OneBridge Grid', robots: { index: false, follow: false } };
  }
  const { name, industry, city, about, logo } = company.company;
  const where = [industry, city].filter(Boolean).join(' in ');
  const title = `${name}${where ? ` | ${where}` : ''}`;
  const description =
    about?.slice(0, 160) || `${name}${where ? `, ${where}` : ''}. Products, team, branches and enquiries on OneBridge Grid.`;
  const indexable = company.seoIndexable && company.status === 'active';
  return {
    title,
    description,
    alternates: { canonical: `${siteUrl()}${path}` },
    robots: { index: indexable, follow: indexable },
    openGraph: { title, description, type: 'website', url: `${siteUrl()}${path}`, images: logo ? [{ url: logo }] : undefined },
    twitter: { card: 'summary', title, description, images: logo ? [logo] : undefined },
  };
}

/** schema.org Organization, with each branch as a LocalBusiness and the catalogue as an offer list. */
export function companyStructuredData(company: PublicCompanyProfile, path: string): Record<string, unknown> {
  const c = company.company;
  const sameAs = [c.website, ...Object.values(c.socialLinks ?? {})].filter(
    (v): v is string => typeof v === 'string' && /^https:\/\//.test(v)
  );
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: c.name,
    url: `${siteUrl()}${path}`,
    logo: c.logo,
    description: c.about,
    identifier: c.businessId,
    taxID: c.gstin,
    sameAs: sameAs.length ? sameAs : undefined,
    department: company.branches.map((b) => ({
      '@type': 'LocalBusiness',
      name: `${c.name}, ${b.name}`,
      address: b.address,
      hasMap: b.directionsUrl,
    })),
    hasOfferCatalog: company.products.length
      ? {
          '@type': 'OfferCatalog',
          name: 'Products',
          itemListElement: company.products.map((p) => ({
            '@type': 'Offer',
            itemOffered: { '@type': 'Product', name: p.name, description: p.description, image: p.imageUrl, category: p.category },
          })),
        }
      : undefined,
  };
}

export function CompanyPageView({ company, path, branchId }: { company: PublicCompanyProfile | null; path: string; branchId?: string }) {
  // Unknown companies get a real 404 (rendered by app/[company]/not-found.tsx).
  if (!company) notFound();
  // "<" is escaped so profile text can never close the script tag.
  const json = JSON.stringify(companyStructuredData(company, path)).replace(/</g, '\\u003c');
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
      <CompanyPageClient data={company as unknown as CompanyProfileData} branchId={branchId} appUrl={(process.env.APP_URL || '').replace(/\/+$/, '')} />
    </>
  );
}
