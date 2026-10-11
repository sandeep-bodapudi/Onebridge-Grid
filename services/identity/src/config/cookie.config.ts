export interface CookieOptions {
  httpOnly?: boolean;
  sameSite?: 'lax' | 'strict' | 'none' | boolean;
  secure?: boolean;
  domain?: string;
  path?: string;
  maxAge?: number;
}

export function getRefreshTokenCookieOptions(
  cookieSecure: boolean,
  cookieDomain?: string
): CookieOptions {
  const options: CookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure,
    path: '/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  if (cookieDomain && cookieDomain !== 'localhost') {
    options.domain = cookieDomain;
  }

  return options;
}
