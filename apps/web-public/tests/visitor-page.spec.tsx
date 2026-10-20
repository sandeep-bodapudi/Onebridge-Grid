import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextRequest } from 'next/server';
import crypto from 'node:crypto';
import VisitorCardPage, { generateMetadata } from '../app/c/[...slug]/page';
import { POST as revalidateHandler } from '../app/api/revalidate/route';
import { GET as vcardHandler } from '../app/c/[...slug]/vcard/route';
import { GET as publicVcardHandler } from '../app/public/c/[...slug]/vcard/route';
import { POST as analyticsHandler } from '../app/api/analytics/route';
import { POST as sharebackHandler } from '../app/api/shareback/route';

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

describe('F12: Web-Public Visitor Page, Metadata, vCard and Revalidate', () => {
  const SECRET = 'test-secret-minimum-32-characters-for-unit-tests';

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.REVALIDATION_SIGNING_SECRET = SECRET;
    process.env.CARDS_SERVICE_URL = 'http://localhost:4002';
  });

  it('renders published VisitorCard with structured data and contact buttons', async () => {
    const mockCard = {
      slug: 'acme/sneha',
      status: 'published',
      verifiedBadge: true,
      person: {
        name: 'Sneha Reddy',
        designation: 'Senior Sales Executive',
        phone: '+919876543210',
        email: 'sneha@acme.com',
        photoUrl: 'https://cdn.onebridge.in/photos/sneha.jpg',
      },
      company: {
        name: 'Acme Steels',
        businessId: 'OB-7KQ2MX',
        brandColours: { band: '#1B2A4A', accent: '#F68713', text: '#FFFFFF' },
      },
      branch: {
        name: 'Jubilee Hills Branch',
      },
      sections: [],
      actions: {
        saveContactUrl: '/c/acme/sneha/vcard',
        whatsappUrl: 'https://wa.me/919876543210',
        callUrl: 'tel:+919876543210',
        emailUrl: 'mailto:sneha@acme.com',
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockCard,
    });

    const jsx = await VisitorCardPage({ params: { slug: ['acme', 'sneha'] } });
    const { container } = render(jsx);

    expect(screen.getByText('Sneha Reddy')).toBeDefined();
    expect(screen.getByText('Senior Sales Executive')).toBeDefined();
    expect(screen.getAllByText('Acme Steels').length).toBeGreaterThan(0);
    expect(screen.getByText('Save contact')).toBeDefined();

    // Verify structured data script exists
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    const ldJson = JSON.parse(script!.textContent || '{}');
    expect(ldJson['@type']).toBe('Person');
    expect(ldJson.name).toBe('Sneha Reddy');
    expect(ldJson.worksFor.name).toBe('Acme Steels');
  });

  it('generates rich metadata for search engines and social cards', async () => {
    const mockCard = {
      slug: 'acme/sneha',
      status: 'published',
      person: {
        name: 'Sneha Reddy',
        designation: 'Senior Sales Executive',
        photoUrl: 'https://cdn.onebridge.in/photos/sneha.jpg',
      },
      company: {
        name: 'Acme Steels',
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockCard,
    });

    const meta = await generateMetadata({ params: { slug: ['acme', 'sneha'] } });
    expect(meta.title).toBe('Sneha Reddy | Acme Steels');
    expect(meta.description).toContain('Sneha Reddy, Senior Sales Executive at Acme Steels');
    expect(meta.openGraph?.title).toBe('Sneha Reddy | Acme Steels');
  });

  it('renders neutral unactivated state when slug does not exist with zero PII', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    const jsx = await VisitorCardPage({ params: { slug: ['non-existent', 'card'] } });
    const { container } = render(jsx);

    expect(screen.getByText('This card is not active yet')).toBeDefined();
    expect(container.querySelector('script[type="application/ld+json"]')).toBeNull();
  });

  it('revalidates path and tags with valid HMAC signature and rejects expired timestamps', async () => {
    const now = Date.now();
    const payload = JSON.stringify({ path: '/c/acme/sneha', slug: 'acme/sneha' });
    const validSignature = crypto
      .createHmac('sha256', SECRET)
      .update(`${now}.${payload}`)
      .digest('hex');

    // 1. Success case
    const req = new NextRequest('http://localhost:3001/api/revalidate', {
      method: 'POST',
      headers: {
        'x-signature': validSignature,
        'x-timestamp': now.toString(),
        'content-type': 'application/json',
      },
      body: payload,
    });

    const res = await revalidateHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.revalidated).toBe(true);

    // 2. Expired timestamp (> 5 minutes)
    const oldTimestamp = (now - 6 * 60 * 1000).toString();
    const expiredReq = new NextRequest('http://localhost:3001/api/revalidate', {
      method: 'POST',
      headers: {
        'x-signature': validSignature,
        'x-timestamp': oldTimestamp,
      },
      body: payload,
    });

    const expiredRes = await revalidateHandler(expiredReq);
    expect(expiredRes.status).toBe(401);
    const expiredBody = await expiredRes.json();
    expect(expiredBody.type).toBe('https://tools.ietf.org/html/rfc7807');
    expect(expiredBody.detail).toContain('expired');

    // 3. Forged signature
    const forgedReq = new NextRequest('http://localhost:3001/api/revalidate', {
      method: 'POST',
      headers: {
        'x-signature': '0000000000000000000000000000000000000000000000000000000000000000',
        'x-timestamp': now.toString(),
      },
      body: payload,
    });

    const forgedRes = await revalidateHandler(forgedReq);
    expect(forgedRes.status).toBe(401);
  });

  it('vcard route proxies vcard text stream with text/vcard content-type header for both /c/ and /public/c/ paths', async () => {
    const vcardContent = 'BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Sneha Reddy\r\nEND:VCARD\r\n';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({
        'content-disposition': 'attachment; filename="sneha-reddy.vcf"',
      }),
      text: async () => vcardContent,
    });

    // 1. Direct /c/ route
    const req = new NextRequest('http://localhost:3001/c/acme/sneha/vcard');
    const res = await vcardHandler(req, { params: { slug: ['acme', 'sneha'] } });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/vcard');
    expect(res.headers.get('content-disposition')).toContain('sneha-reddy.vcf');
    const text = await res.text();
    expect(text).toContain('FN:Sneha Reddy');

    // 2. Alias /public/c/ route
    const publicReq = new NextRequest('http://localhost:3001/public/c/acme/sneha/vcard');
    const publicRes = await publicVcardHandler(publicReq, { params: { slug: ['acme', 'sneha'] } });
    expect(publicRes.status).toBe(200);
    expect(publicRes.headers.get('content-type')).toContain('text/vcard');
  });

  it('filters bot user agents from analytics ingestion', async () => {
    const botReq = new NextRequest('http://localhost:3001/api/analytics', {
      method: 'POST',
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ type: 'card_viewed', slug: 'acme/sneha' }),
    });

    const res = await analyticsHandler(botReq);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ignored).toBe(true);
    expect(body.reason).toBe('bot_filtered');
  });

  it('forwards human visitor telemetry events to POST /analytics/events with 202 Accepted', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({ status: 'accepted' }),
    });

    const humanReq = new NextRequest('http://localhost:3001/api/analytics', {
      method: 'POST',
      headers: {
        'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        type: 'contact_saved',
        cardId: 'OB-ABC123-E0001',
        slug: 'acme/sneha',
      }),
    });

    const res = await analyticsHandler(humanReq);
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:4002/analytics/events',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('enforces page weight budget well below 300 KB before media per AC-4', async () => {
    const mockCard = {
      slug: 'acme/sneha',
      status: 'published',
      person: {
        name: 'Sneha Reddy',
        designation: 'Senior Sales Executive',
      },
      company: {
        name: 'Acme Steels',
        businessId: 'OB-7KQ2MX',
      },
      sections: [],
      actions: {
        saveContactUrl: '/c/acme/sneha/vcard',
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockCard,
    });

    const jsx = await VisitorCardPage({ params: { slug: ['acme', 'sneha'] } });
    const { container } = render(jsx);

    const htmlString = container.innerHTML;
    const pageWeightBytes = Buffer.byteLength(htmlString, 'utf8');

    // Mandated budget: < 300 KB before media
    expect(pageWeightBytes).toBeLessThan(300 * 1024);
    // Typical static HTML payload is under 30 KB
    expect(pageWeightBytes).toBeLessThan(30 * 1024);
  });

  describe('F13: Shareback Proxy Route (/api/shareback)', () => {
    it('forwards share-back submission to cards service with client IP header', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({
          success: true,
          leadId: 'lead_123',
          message: 'Details shared successfully',
        }),
      });

      const req = new NextRequest('http://localhost:3001/api/shareback', {
        method: 'POST',
        headers: {
          'cf-connecting-ip': '203.0.113.195',
          'idempotency-key': 'idemp_key_123',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          slug: 'acme/sneha',
          name: 'Ravi Kumar',
          phone: '+919876543210',
          email: 'ravi@example.com',
          company: 'Apex Infra',
          note: 'Please call regarding TMT bars',
          consent: true,
          source: 'qr',
          sourceTag: 'flyer',
        }),
      });

      const res = await sharebackHandler(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.leadId).toBe('lead_123');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4002/public/c/acme/sneha/shareback',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-forwarded-for': '203.0.113.195',
            'idempotency-key': 'idemp_key_123',
          }),
        })
      );
    });

    it('returns 400 problem details when slug is missing', async () => {
      const req = new NextRequest('http://localhost:3001/api/shareback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Ravi Kumar',
          phone: '+919876543210',
          consent: true,
        }),
      });

      const res = await sharebackHandler(req);
      expect(res.status).toBe(400);
      expect(res.headers.get('content-type')).toContain('application/problem+json');
      const body = await res.json();
      expect(body.title).toBe('Bad Request');
      expect(body.detail).toContain('Card slug is required');
    });
  });
});

