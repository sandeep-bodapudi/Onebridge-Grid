import { NextRequest, NextResponse } from 'next/server';
import { cardsServiceUrl } from '../../../lib/cards-service';
import { COMPANY_SLUG } from '../../../lib/company-page';

function problem(status: number, detail: string) {
  return NextResponse.json(
    { type: 'https://tools.ietf.org/html/rfc7807', title: status === 400 ? 'Bad Request' : 'Error', status, detail },
    { status, headers: { 'Content-Type': 'application/problem+json' } }
  );
}

/** F26: company page enquiry. Passes the visitor's IP on for rate limiting; the cards service creates the lead. */
export async function POST(req: NextRequest) {
  try {
    const { slug, ...enquiry } = await req.json();
    if (typeof slug !== 'string' || !COMPANY_SLUG.test(slug)) return problem(400, 'Company is required');

    const clientIp =
      req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    const res = await fetch(`${cardsServiceUrl()}/public/o/${slug}/enquiry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': clientIp },
      body: JSON.stringify(enquiry),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return problem(500, 'Could not send your enquiry. Try again.');
  }
}
