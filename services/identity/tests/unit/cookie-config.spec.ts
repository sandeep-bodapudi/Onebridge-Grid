import { describe, it, expect } from 'vitest';
import { getRefreshTokenCookieOptions } from '../../src/config/cookie.config';

describe('Cookie Configuration Resolution (Condition 4)', () => {
  it('should set secure: true when cookieSecure is true', () => {
    const options = getRefreshTokenCookieOptions(true);
    expect(options.secure).toBe(true);
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe('lax');
    expect(options.path).toBe('/auth');
  });

  it('should set secure: false for local HTTP dev and e2e testing when cookieSecure is false', () => {
    const options = getRefreshTokenCookieOptions(false);
    expect(options.secure).toBe(false);
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe('lax');
  });

  it('should attach domain when specified and not localhost', () => {
    const options = getRefreshTokenCookieOptions(true, '.onebridge.in');
    expect(options.domain).toBe('.onebridge.in');
  });

  it('should omit domain when domain is localhost for browser compatibility', () => {
    const options = getRefreshTokenCookieOptions(false, 'localhost');
    expect(options.domain).toBeUndefined();
  });
});
