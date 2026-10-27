// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import React from 'react';
import { CompanyProfilePage, CompanyProfileData, videoEmbedUrl } from '../src/components/CompanyProfilePage';

const data: CompanyProfileData = {
  status: 'active',
  company: {
    name: 'Acme Steels',
    slug: 'acme-steels',
    businessId: 'OB-7KQ2MX',
    verifiedBadge: true,
    industry: 'Steel',
    city: 'Hyderabad',
    about: 'Structural steel for builders.',
    website: 'https://acme.example.com',
  },
  seoIndexable: true,
  focusBranchId: 'br_sec',
  branches: [
    { id: 'br_hyd', name: 'Jubilee Hills', address: 'Road 36', directionsUrl: 'https://maps.example/1' },
    { id: 'br_sec', name: 'Secunderabad', address: 'SD Road', directionsUrl: 'https://maps.example/2' },
  ],
  people: [{ name: 'Sneha Reddy', designation: 'Sales', branchName: 'Jubilee Hills', cardUrl: 'https://grid.example/c/acme/sneha' }],
  products: [
    { id: 'p1', name: 'TMT bars', category: 'Bars', price: '₹54,000 / MT' },
    { id: 'p2', name: 'MS plates', category: 'Plates', priceOnRequest: true },
  ],
  services: [{ id: 's1', name: 'Cut to length' }],
  portfolio: [{ id: 'w1', title: 'Metro depot', client: 'HMR', videoUrl: 'https://youtu.be/dQw4w9WgXcQ' }],
  clientLogos: [{ id: 'c1', name: 'HMR' }],
  documents: [{ id: 'd1', title: 'Brochure', sizeBytes: 2_400_000, downloadUrl: '/acme-steels/documents/d1' }],
};

describe('CompanyProfilePage (F26)', () => {
  it('shows the company, verified tag, catalogue, people, branches and documents', () => {
    render(<CompanyProfilePage data={data} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Acme Steels' })).toBeTruthy();
    expect(screen.getByTestId('verified-tag')).toBeTruthy();
    expect(screen.getByText('₹54,000 / MT')).toBeTruthy();
    expect(screen.getByText('Price on request')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Sneha Reddy/ }).getAttribute('href')).toBe('https://grid.example/c/acme/sneha');
    expect(screen.getByRole('link', { name: /Brochure/ }).getAttribute('href')).toBe('/acme-steels/documents/d1');
    expect(screen.getByText('PDF · 2.3 MB')).toBeTruthy();
  });

  it('puts the scanned branch first', () => {
    const { container } = render(<CompanyProfilePage data={data} />);
    const branches = container.querySelectorAll('#branches li');
    expect(branches[0].textContent).toContain('Secunderabad');
    expect(branches[0].textContent).toContain('You scanned this branch');
  });

  it('filters products by category', () => {
    render(<CompanyProfilePage data={data} />);
    fireEvent.click(screen.getByRole('button', { name: 'Plates' }));
    expect(screen.queryByText('TMT bars')).toBeNull();
    expect(screen.getByText('MS plates')).toBeTruthy();
  });

  it('loads the video only when asked, and only from YouTube or Vimeo', () => {
    const { container } = render(<CompanyProfilePage data={data} />);
    expect(container.querySelector('iframe')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Play video/ }));
    expect(container.querySelector('iframe')?.getAttribute('src')).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(videoEmbedUrl('https://evil.example/watch?v=dQw4w9WgXcQ')).toBeNull();
  });

  it('sends a product enquiry with the product and the scanned branch', async () => {
    const onEnquirySubmit = vi.fn().mockResolvedValue({ success: true });
    render(<CompanyProfilePage data={data} onEnquirySubmit={onEnquirySubmit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Enquire: TMT bars' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByTestId('enquiry-product').textContent).toContain('TMT bars');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Send enquiry' }));
    expect(within(dialog).getByRole('alert').textContent).toContain('Enter your name.');
    expect(onEnquirySubmit).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText(/Your name/), { target: { value: 'Rahul Mehta' } });
    fireEvent.change(within(dialog).getByLabelText(/Mobile number/), { target: { value: '98220 12345' } });
    fireEvent.change(within(dialog).getByLabelText(/What do you need/), { target: { value: 'Need 20 MT' } });
    fireEvent.click(within(dialog).getByRole('checkbox'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send enquiry' }));

    await waitFor(() => expect(screen.getByTestId('enquiry-success')).toBeTruthy());
    expect(onEnquirySubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Rahul Mehta', productId: 'p1', branchId: 'br_sec', message: 'Need 20 MT', consent: true })
    );
  });

  it('shows the error when the enquiry fails', async () => {
    render(<CompanyProfilePage data={data} onEnquirySubmit={async () => ({ success: false, message: 'Too many enquiries' })} />);
    fireEvent.click(screen.getByTestId('enquiry-bar'));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Your name/), { target: { value: 'Rahul' } });
    fireEvent.change(within(dialog).getByLabelText(/Mobile number/), { target: { value: '9822012345' } });
    fireEvent.click(within(dialog).getByRole('checkbox'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send enquiry' }));
    await waitFor(() => expect(within(dialog).getByRole('alert').textContent).toContain('Too many enquiries'));
  });

  it('shows basic details only when the plan has lapsed', () => {
    render(<CompanyProfilePage data={{ ...data, status: 'lapsed', products: [], people: [], documents: [], portfolio: [], services: [], clientLogos: [] }} />);
    expect(screen.getByRole('status').textContent).toContain('basic details only');
    expect(screen.queryByTestId('enquiry-bar')).toBeNull();
  });

  it('omits the verified tag for unverified companies and switches to Hindi', () => {
    render(<CompanyProfilePage data={{ ...data, company: { ...data.company, verifiedBadge: false } }} />);
    expect(screen.queryByTestId('verified-tag')).toBeNull();
    expect(screen.getByTestId('not-verified-tag').textContent).toBe('Not verified yet');
    fireEvent.click(screen.getByTestId('language-toggle'));
    expect(screen.getAllByText('पूछताछ भेजें').length).toBeGreaterThan(0);
  });

  it('shows a not-found state', () => {
    render(<CompanyProfilePage state="not_found" />);
    expect(screen.getByRole('heading', { name: 'Company page not found' })).toBeTruthy();
  });

  it('has no axe violations, with the enquiry sheet open too', async () => {
    const { container } = render(<CompanyProfilePage data={data} />);
    expect((await axe(container)).violations).toEqual([]);
    fireEvent.click(screen.getByTestId('enquiry-bar'));
    expect((await axe(document.body)).violations).toEqual([]);
  });

  it('hides every enquiry button when the company cannot receive enquiries yet (N02)', () => {
    render(<CompanyProfilePage data={{ ...data, acceptsEnquiries: false }} />);
    expect(screen.queryByTestId('enquiry-bar')).toBeNull();
    expect(screen.queryByRole('button', { name: /Enquire/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send an enquiry' })).toBeNull();
  });
});
