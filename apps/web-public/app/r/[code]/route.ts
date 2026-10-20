import { cardsServiceUrl } from '../../../lib/cards-service';

/**
 * Short-link redirect served by web-public itself, for hosts that do not
 * run the Cloudflare edge worker (local dev, staging, demo). Set the cards
 * service's SHORT_LINK_BASE_URL to <WEB_PUBLIC_URL>/r to use it.
 *
 * Production QR codes and NFC chips use https://obg.in, served by
 * edge/shortlink, which also records scan analytics off the redirect path.
 */
export async function GET(_req: Request, { params }: { params: { code: string } }): Promise<Response> {
  const code = encodeURIComponent(params.code);

  let upstream: Response;
  try {
    upstream = await fetch(`${cardsServiceUrl()}/r/${code}`, { redirect: 'manual', cache: 'no-store' });
  } catch {
    return new Response('This link is temporarily unavailable. Please try again in a moment.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const location = upstream.headers.get('location');
  if (upstream.status >= 300 && upstream.status < 400 && location) {
    return new Response(null, { status: 302, headers: { Location: location, 'Cache-Control': 'no-store' } });
  }

  // Unknown, inactive or disabled codes: pass through the neutral page
  // (never contains personal data).
  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('content-type') || 'text/html; charset=utf-8' },
  });
}
