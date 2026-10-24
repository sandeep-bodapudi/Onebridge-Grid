import { describe, it, expect, vi, afterEach } from 'vitest';
import type { PublicCompanyProfile } from '@onebridge/api-contracts';
import { companyMetadata, companyStructuredData, fetchCompany } from '../lib/company-page';

const company: PublicCompanyProfile = {
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
    gstin: '36AABCA1234F1Z5',
    socialLinks: { linkedin: 'https://linkedin.com/company/acme', bad: 'javascript:alert(1)' },
  },
  seoIndexable: true,
  branches: [{ id: 'br_hyd', name: 'Jubilee Hills', address: 'Road 36', directionsUrl: 'https://maps.example/1' }],
  people: [],
  products: [{ id: 'p1', name: 'TMT bars', category: 'Bars' }],
  services: [],
  portfolio: [],
  clientLogos: [],
  documents: [],
};

afterEach(() => vi.unstubAllGlobals());

describe('company page SEO (F26)', () => {
  it('describes the company as an Organization with branches and a catalogue', () => {
    const ld = companyStructuredData(company, '/acme-steels') as Record<string, any>;
    expect(ld['@type']).toBe('Organization');
    expect(ld.identifier).toBe('OB-7KQ2MX');
    expect(ld.taxID).toBe('36AABCA1234F1Z5');
    expect(ld.department[0]).toMatchObject({ '@type': 'LocalBusiness', name: 'Acme Steels, Jubilee Hills', address: 'Road 36' });
    expect(ld.hasOfferCatalog.itemListElement[0].itemOffered.name).toBe('TMT bars');
    expect(ld.sameAs).toEqual(['https://acme.example.com', 'https://linkedin.com/company/acme']);
  });

  it('follows the search-engine setting and stops indexing lapsed pages', () => {
    expect(companyMetadata(company, '/acme-steels').robots).toEqual({ index: true, follow: true });
    expect(companyMetadata({ ...company, seoIndexable: false }, '/acme-steels').robots).toEqual({ index: false, follow: false });
    expect(companyMetadata({ ...company, status: 'lapsed' }, '/acme-steels').robots).toEqual({ index: false, follow: false });
    expect(companyMetadata(null, '/x').robots).toEqual({ index: false, follow: false });
    expect(companyMetadata(company, '/acme-steels').title).toBe('Acme Steels | Steel in Hyderabad');
  });

  it('never calls the service for addresses that are not company slugs', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchCompany('favicon.ico')).toBeNull();
    expect(await fetchCompany('../admin')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
