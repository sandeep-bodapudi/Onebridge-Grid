import React from 'react';
import type { Metadata } from 'next';
import { CompanyPageView, companyMetadata, fetchCompany } from '../../../../lib/company-page';

// Branch standee QR codes open the company page with that branch first.
export const revalidate = 60;

interface PageProps {
  params: { company: string; branchId: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  // Canonical is the company page, so branch links do not compete with it in search.
  return companyMetadata(await fetchCompany(params.company, params.branchId), `/${params.company}`);
}

export default async function CompanyBranchPage({ params }: PageProps) {
  const company = await fetchCompany(params.company, params.branchId);
  return <CompanyPageView company={company} path={`/${params.company}`} branchId={params.branchId} />;
}
