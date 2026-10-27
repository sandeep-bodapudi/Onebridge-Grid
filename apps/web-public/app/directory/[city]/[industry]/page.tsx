import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchDirectory } from '../../../../lib/search-service';
import { SearchResultsClient } from '../../../search/SearchResultsClient';

// N03 SEO directory pages: rebuilt every 5 minutes.
export const revalidate = 300;

interface PageProps {
  params: { city: string; industry: string };
  searchParams: { sub?: string };
}

function siteUrl(): string {
  return (process.env.WEB_PUBLIC_URL || 'http://localhost:3003').replace(/\/+$/, '');
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const page = await fetchDirectory(params.city, params.industry, searchParams.sub);
  if (!page) return { title: 'Directory | OneBridge Grid', robots: { index: false, follow: false } };
  const sub = page.industry.subCategories.find((s) => s.id === searchParams.sub);
  const title = `${sub?.name ?? page.industry.name} companies in ${page.city}`;
  const description = `${page.total ?? page.items.length} verified and listed ${(sub?.name ?? page.industry.name).toLowerCase()} companies in ${page.city} on OneBridge Grid.`;
  const path = `/directory/${params.city}/${params.industry}${sub ? `?sub=${sub.id}` : ''}`;
  return {
    title,
    description,
    alternates: { canonical: `${siteUrl()}${path}` },
    // An empty directory page has nothing for search engines yet.
    robots: { index: page.items.length > 0, follow: true },
    openGraph: { title, description, type: 'website', url: `${siteUrl()}${path}` },
  };
}

export default async function DirectoryPageView({ params, searchParams }: PageProps) {
  const page = await fetchDirectory(params.city, params.industry, searchParams.sub);
  if (!page) notFound();
  const sub = page.industry.subCategories.find((s) => s.id === searchParams.sub);
  const heading = `${sub?.name ?? page.industry.name} companies in ${page.city}`;
  const ld = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: heading,
    itemListElement: page.items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${siteUrl()}/${item.actor.handle}`,
      name: item.actor.name,
    })),
  }).replace(/</g, '\\u003c');

  return (
    <main className="w-full min-h-screen bg-warm-paper text-charcoal">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld }} />
      <div className="bg-charcoal text-warm-paper">
        <div className="max-w-[860px] mx-auto px-4 sm:px-5 pt-6 pb-8">
          <nav aria-label="Breadcrumb" className="text-sm opacity-80">
            <ol className="flex flex-wrap gap-1.5">
              <li>
                <a href="/search" className="underline-offset-2 hover:underline">
                  Directory
                </a>
                <span aria-hidden="true"> /</span>
              </li>
              <li>
                <a href={`/directory/${params.city}/${params.industry}`} className="underline-offset-2 hover:underline">
                  {page.industry.name}
                </a>
                {sub ? <span aria-hidden="true"> /</span> : null}
              </li>
              {sub ? <li aria-current="page">{sub.name}</li> : null}
            </ol>
          </nav>
          <h1 className="mt-3 text-[28px] sm:text-[34px] font-bold tracking-[-0.03em] leading-tight">{heading}</h1>
          {page.industry.subCategories.length ? (
            <ul className="mt-5 flex flex-wrap gap-2" aria-label="Narrow by speciality">
              {page.industry.subCategories.map((s) => (
                <li key={s.id}>
                  <a
                    href={`/directory/${params.city}/${params.industry}?sub=${s.id}`}
                    aria-current={s.id === sub?.id ? 'page' : undefined}
                    className={`inline-flex min-h-[40px] items-center px-4 rounded-full text-sm font-bold border ${s.id === sub?.id ? 'bg-bridge-orange text-[#241A10] border-bridge-orange' : 'border-white/25 hover:bg-white/10'}`}
                  >
                    {s.name}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <span aria-hidden="true" className="block h-[5px] bg-bridge-orange" />
      </div>
      <div className="max-w-[860px] mx-auto px-4 sm:px-5 py-6">
        <SearchResultsClient
          items={page.items}
          total={page.total}
          emptyHint={`Be the first ${page.industry.name.toLowerCase()} company in ${page.city} on OneBridge Grid.`}
        />
      </div>
    </main>
  );
}
