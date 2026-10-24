import { NextResponse } from 'next/server';
import { DEMO_ACCESS_COOKIE, demoAccessToken, safeEqual } from '../../../src/demo-access';

/** Checks the shared demo passcode and sets an httpOnly access cookie (never localStorage). */
export async function POST(request: Request) {
  const passcode = process.env.DEMO_ACCESS_PASSCODE;
  if (!passcode) return NextResponse.json({ ok: true });

  const body = (await request.json().catch(() => ({}))) as { passcode?: unknown };
  const given = typeof body.passcode === 'string' ? body.passcode.trim() : '';
  const expected = await demoAccessToken(passcode);
  if (!given || !safeEqual(await demoAccessToken(given), expected)) {
    // A small delay makes guessing slower; the passcode is shared with invited people only.
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ ok: false, detail: 'That passcode is not right. Check the invite and try again.' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(DEMO_ACCESS_COOKIE, expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development' || process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 14,
  });
  return res;
}
