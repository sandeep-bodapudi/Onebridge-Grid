/**
 * Hosted prototype passcode (D-DEMO-HOSTING). The dashboard of the public demo
 * is behind a shared passcode so only invited investors and customers reach
 * it; visitor cards stay public. Off unless DEMO_ACCESS_PASSCODE is set.
 */
export const DEMO_ACCESS_COOKIE = 'ob_demo_access';

/** SHA-256 hex of the passcode with a fixed label, usable in the edge middleware and route handlers. */
export async function demoAccessToken(passcode: string): Promise<string> {
  const data = new TextEncoder().encode(`onebridge-demo-access:${passcode}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Constant-time comparison of two equal-length hex strings. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
