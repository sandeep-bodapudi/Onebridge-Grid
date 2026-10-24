import React from 'react';
import type { Metadata } from 'next';
import { CompanyPageView, companyMetadata, fetchCompany } from '../../lib/company-page';

// F26: public company page, rebuilt at most once a minute.
export const revalidate = 60;

interface PageProps {
  params: { company: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return companyMetadata(await fetchCompany(params.company), `/${params.company}`);
}

export default async function CompanyPage({ params }: PageProps) {
  const company = await fetchCompany(params.company);
  return <CompanyPageView company={company} path={`/${params.company}`} />;
}
