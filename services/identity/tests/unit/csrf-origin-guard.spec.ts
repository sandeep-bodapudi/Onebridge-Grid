import { describe, it, expect } from 'vitest';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { CsrfOriginGuard } from '../../src/presentation/guards/csrf-origin.guard';

function createMockContext(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string | undefined>;
  cookies?: Record<string, string | undefined>;
}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method: options.method || 'GET',
        url: options.url || '/',
        originalUrl: options.url || '/',
        headers: options.headers || {},
        cookies: options.cookies || {},
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('CsrfOriginGuard Unit Tests (Fix 2: CSRF & Origin Security)', () => {
  const guard = new CsrfOriginGuard('http://localhost:3000');

  it('should allow GET, HEAD, OPTIONS requests without CSRF or Origin checks', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      const ctx = createMockContext({ method, headers: { origin: 'http://malicious-site.com' } });
      expect(guard.canActivate(ctx)).toBe(true);
    }
  });

  it('should allow machine-to-machine requests bearing x-service-key', () => {
    const ctx = createMockContext({
      method: 'POST',
      url: '/internal/memberships',
      headers: {
        'x-service-key': 'valid-internal-key-32-bytes-minimum',
      },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should reject mutating requests with forged Origin with 403 Forbidden', () => {
    const ctx = createMockContext({
      method: 'POST',
      url: '/auth/otp',
      headers: {
        origin: 'http://evil-attacker.com',
      },
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    try {
      guard.canActivate(ctx);
    } catch (err) {
      const response = (err as ForbiddenException).getResponse() as { detail?: string };
      expect(response.detail).toContain('Cross-origin request rejected from Origin: "http://evil-attacker.com"');
    }
  });

  it('should reject mutating requests with forged Referer with 403 Forbidden', () => {
    const ctx = createMockContext({
      method: 'POST',
      url: '/auth/otp',
      headers: {
        referer: 'http://evil-attacker.com/malicious-page',
      },
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    try {
      guard.canActivate(ctx);
    } catch (err) {
      const response = (err as ForbiddenException).getResponse() as { detail?: string };
      expect(response.detail).toContain('Cross-origin request rejected from Origin: "http://evil-attacker.com"');
    }
  });

  it('should reject request when xsrf-token cookie exists but x-csrf-token header is missing', () => {
    const ctx = createMockContext({
      method: 'POST',
      url: '/auth/refresh',
      headers: {
        origin: 'http://localhost:3000',
      },
      cookies: {
        'xsrf-token': 'csrf-secret-12345',
        refreshToken: 'valid-refresh-token',
      },
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    try {
      guard.canActivate(ctx);
    } catch (err) {
      const response = (err as ForbiddenException).getResponse() as { detail?: string };
      expect(response.detail).toContain('CSRF token missing');
    }
  });

  it('should reject request when x-csrf-token does not match xsrf-token cookie', () => {
    const ctx = createMockContext({
      method: 'POST',
      url: '/auth/refresh',
      headers: {
        origin: 'http://localhost:3000',
        'x-csrf-token': 'wrong-token-value',
      },
      cookies: {
        'xsrf-token': 'csrf-secret-12345',
        refreshToken: 'valid-refresh-token',
      },
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    try {
      guard.canActivate(ctx);
    } catch (err) {
      const response = (err as ForbiddenException).getResponse() as { detail?: string };
      expect(response.detail).toContain('Invalid CSRF token');
    }
  });

  it('should allow request when x-csrf-token header matches xsrf-token cookie with valid Origin', () => {
    const validToken = 'super-secure-random-csrf-token-abcdef123456';
    const ctx = createMockContext({
      method: 'POST',
      url: '/auth/refresh',
      headers: {
        origin: 'http://localhost:3000',
        'x-csrf-token': validToken,
      },
      cookies: {
        'xsrf-token': validToken,
        refreshToken: 'valid-refresh-token',
      },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
