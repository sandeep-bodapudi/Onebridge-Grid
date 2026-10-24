import { NextRequest } from 'next/server';
import { isBotUserAgent } from '@onebridge/shared';
import { cardsServiceUrl } from '../../../lib/cards-service';
import { COMPANY_SLUG } from '../../../lib/company-page';

/** Counts a company page view. No visitor data is sent; the company comes from the slug. */
export async function POST(req: NextRequest) {
  if (isBotUserAgent(req.headers.get('user-agent'))) return Response.json({ ignored: true }, { status: 200 });
  try {
    const { slug, branchId } = await req.json();
    if (typeof slug === 'string' && COMPANY_SLUG.test(slug)) {
      await fetch(`${cardsServiceUrl()}/public/o/${slug}/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(typeof branchId === 'string' ? { branchId } : {}),
      });
    }
  } catch {
    // Non-blocking
  }
  return Response.json({ accepted: true }, { status: 202 });
}
