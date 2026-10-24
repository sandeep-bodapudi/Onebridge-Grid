import { NextResponse, type NextRequest } from 'next/server';
import { DEMO_ACCESS_COOKIE, demoAccessToken, safeEqual } from './src/demo-access';

/** Hosted prototype only: ask for the shared passcode before showing the dashboard (D-DEMO-HOSTING). */
export async function middleware(request: NextRequest) {
  const passcode = process.env.DEMO_ACCESS_PASSCODE;
  // The product homepage is public; the passcode guards the demo behind it.
  if (!passcode || request.nextUrl.pathname === '/') return NextResponse.next();

  const cookie = request.cookies.get(DEMO_ACCESS_COOKIE)?.value || '';
  if (cookie && safeEqual(cookie, await demoAccessToken(passcode))) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = '/demo-access';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except the passcode page itself, its API route, the service proxy and static files.
  matcher: ['/((?!demo-access|api/demo-access|svc/|_next/|fonts/|favicon).*)'],
};
