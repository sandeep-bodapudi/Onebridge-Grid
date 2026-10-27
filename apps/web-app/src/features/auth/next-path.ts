/**
 * Where to go after signing in. Only a path on this site is allowed ("/invite/abc"), never
 * another origin ("//evil.example", "https://…"), so the link cannot send people off-site.
 */
export function safeNextPath(raw: string | null | undefined, fallback = '/dashboard'): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\') || /[\r\n]/.test(raw)) return fallback;
  return raw;
}

/** The `next` path from the current address, or null. */
export function nextFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('next');
  const safe = safeNextPath(raw, '');
  return safe || null;
}

/** Adds ?next= to a sign-in or sign-up link when there is somewhere to come back to. */
export function withNext(href: string, next: string | null): string {
  return next ? `${href}?next=${encodeURIComponent(next)}` : href;
}
