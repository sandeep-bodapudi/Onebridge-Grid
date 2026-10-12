export interface CookieOptions {
  httpOnly?: boolean;
  sameSite?: 'lax' | 'strict' | 'none' | boolean;
  secure?: boolean;
  domain?: string;
  path?: string;
  maxAge?: number;
  [key: string]: unknown;
}

export function getRefreshTokenCookieOptions(
  cookieSecure: boolean,
  cookieDomain?: string,
  cookiePath = process.env.COOKIE_PATH || '/auth'
): CookieOptions {
  const options: CookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure,
    path: cookiePath,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  if (cookieDomain && cookieDomain !== 'localhost') {
    options.domain = cookieDomain;
  }

  return options;
}
