'use client';

import React, { useEffect } from 'react';
import { CompanyProfilePage, type CompanyProfileData, type CompanyEnquiryData } from '@onebridge/ui-kit';

export interface CompanyPageClientProps {
  data?: CompanyProfileData;
  state?: 'ready' | 'not_found';
  branchId?: string;
}

export function CompanyPageClient({ data, state = 'ready', branchId }: CompanyPageClientProps) {
  const slug = data?.company.slug;

  useEffect(() => {
    if (!slug) return;
    fetch('/api/company-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, branchId }),
      keepalive: true,
    }).catch(() => {
      // Non-blocking telemetry
    });
  }, [slug, branchId]);

  const handleEnquiry = async (enquiry: CompanyEnquiryData) => {
    try {
      const res = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, ...enquiry }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, message: err.detail || err.message || 'Could not send your enquiry. Try again.' };
      }
      return { success: true };
    } catch {
      return { success: false, message: 'Network error. Try again.' };
    }
  };

  return <CompanyProfilePage data={data} state={data ? state : 'not_found'} onEnquirySubmit={handleEnquiry} />;
}
