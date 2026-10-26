import { NextResponse, type NextRequest } from 'next/server';
import { DEMO_ACCESS_COOKIE, demoAccessToken, safeEqual } from './src/demo-access';

/** Hosted prototype only: ask for the shared passcode before showing the dashboard (D-DEMO-HOSTING). */
export async function middleware(request: NextRequest) {
  const passcode = process.env.DEMO_ACCESS_PASSCODE;
  // The product homepage is public; the passcode guards the demo behind it.
  if (!passcode || request.nextUrl.pathname === '/') return NextResponse.next();

  const cookie = request.cookies.get(DEMO_ACCESS_COOKIE)?.value || '';
  if (cookie && safeEqual(cookie, await demoAccessToken(passcode))) return NextResponse.next();

  // Behind a proxy (single-service deployment) request.nextUrl carries the internal host
  // (localhost:<port>), so the redirect is built from the public host the browser used.
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host;
  const proto = (request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', '')).split(',')[0].trim();
  return NextResponse.redirect(new URL('/demo-access', `${proto}://${host}`));
}

export const config = {
  // Everything except the passcode page itself, its API route, the service proxy and static files.
  matcher: ['/((?!demo-access|api/demo-access|svc/|_next/|fonts/|favicon).*)'],
};
