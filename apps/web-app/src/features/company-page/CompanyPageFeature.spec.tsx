// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import type { CompanyProfileSettings, Organization } from '@onebridge/api-contracts';
import { CompanyPageFeature } from './CompanyPageFeature';
import { apiClient } from '../../api-client';

const tenantId = '01JACTENANTA00000000000000';
const org = { id: tenantId, businessId: 'OB-7KQ2MX', name: 'Acme Steels', slug: 'acme-steels', about: 'Steel.', website: '' } as unknown as Organization;

const settings = (products = 0): CompanyProfileSettings => ({
  seoIndexable: true,
  products: Array.from({ length: products }, (_, i) => ({ id: `p${i}`, name: `Item ${i}` })),
  services: [],
  portfolio: [],
  clientLogos: [],
  documents: [],
  directory: { enabled: true, seatIds: [] },
  enquiryRouting: { branchSeats: {} },
  limits: { maxProducts: 50 },
});

describe('CompanyPageFeature (F26)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(apiClient, 'listCardSummaries').mockResolvedValue([
      {
        id: 'OB-7KQ2MX-E0001',
        seatId: 'OB-7KQ2MX-E0001',
        slug: 'acme-steels/ob-7kq2mx-e0001',
        status: 'published',
        templateId: 'classic-charcoal',
        name: 'Sneha Reddy',
        designation: 'Sales',
        publicUrl: 'https://cards.example/c/acme-steels/ob-7kq2mx-e0001',
        updatedAt: new Date().toISOString(),
      },
    ]);
    vi.spyOn(apiClient, 'listBranches').mockResolvedValue([]);
  });

  it('adds a product and saves the settings', async () => {
    vi.spyOn(apiClient, 'getCompanyProfile').mockResolvedValue(settings());
    const put = vi.spyOn(apiClient, 'updateCompanyProfile').mockImplementation(async (s) => s);
    render(<CompanyPageFeature tenantId={tenantId} organization={org} />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Products and services' }));
    expect((screen.getByTestId('company-page-save') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Add product' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'TMT bars' } });
    expect(screen.getByTestId('catalogue-limit').textContent).toBe('1 of 50 on Starter');

    fireEvent.click(screen.getByTestId('company-page-save'));
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(put.mock.calls[0][0].products[0].name).toBe('TMT bars');
    expect(await screen.findByRole('status')).toBeTruthy();
  });

  it('stops adding products at the Starter limit', async () => {
    vi.spyOn(apiClient, 'getCompanyProfile').mockResolvedValue(settings(50));
    render(<CompanyPageFeature tenantId={tenantId} organization={org} />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Products and services' }));
    expect((screen.getByRole('button', { name: 'Add product' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Business has no limit/)).toBeTruthy();
  });

  it('saves profile text on the organization', async () => {
    vi.spyOn(apiClient, 'getCompanyProfile').mockResolvedValue(settings());
    const patch = vi.spyOn(apiClient, 'updateOrganization').mockResolvedValue({ ...org, about: 'Structural steel.' } as Organization);
    render(<CompanyPageFeature tenantId={tenantId} organization={org} />);
    fireEvent.change(await screen.findByLabelText('About the company'), { target: { value: 'Structural steel.' } });
    fireEvent.click(screen.getByTestId('company-page-save'));
    await waitFor(() => expect(patch).toHaveBeenCalledWith(tenantId, expect.objectContaining({ about: 'Structural steel.' })));
  });

  it('shows the server error when saving fails', async () => {
    vi.spyOn(apiClient, 'getCompanyProfile').mockResolvedValue(settings());
    vi.spyOn(apiClient, 'updateCompanyProfile').mockRejectedValue(new Error('Videos must be a YouTube or Vimeo link'));
    render(<CompanyPageFeature tenantId={tenantId} organization={org} />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Search engines' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Let search engines list this page' }));
    fireEvent.click(screen.getByTestId('company-page-save'));
    expect((await screen.findByRole('alert')).textContent).toContain('YouTube or Vimeo');
  });

  it('chooses who receives enquiries from published cards, without axe violations', async () => {
    vi.spyOn(apiClient, 'getCompanyProfile').mockResolvedValue(settings());
    const { container } = render(<CompanyPageFeature tenantId={tenantId} organization={org} />);
    fireEvent.click(await screen.findByRole('tab', { name: 'People and enquiries' }));
    const select = screen.getByLabelText('General enquiries') as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.text)).toEqual(['First published card', 'Sneha Reddy']);
    expect((await axe(container)).violations).toEqual([]);
  });
});
