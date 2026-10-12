import crypto from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  Inject,
  Optional,
} from '@nestjs/common';

interface HttpRequest {
  method: string;
  url?: string;
  originalUrl?: string;
  headers: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string | undefined>;
}

function timingSafeMatch(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

@Injectable()
export class CsrfOriginGuard implements CanActivate {
  private allowedOrigins: string[];

  constructor(
    @Optional() @Inject('APP_URL') appUrl?: string,
    extraOrigins: string[] = []
  ) {
    const effectiveAppUrl = appUrl || process.env.APP_URL || 'http://localhost:3000';
    this.allowedOrigins = [
      effectiveAppUrl.toLowerCase().replace(/\/$/, ''),
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      ...extraOrigins.map(o => o.toLowerCase().replace(/\/$/, '')),
    ];
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<HttpRequest>();
    const method = req.method ? req.method.toUpperCase() : 'GET';

    // Safe methods do not mutate server state
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return true;
    }

    // Machine-to-machine internal service requests are handled by ServiceKeyGuard
    if (req.headers && req.headers['x-service-key']) {
      return true;
    }

    // 1. Origin and Referer validation
    const origin = req.headers?.['origin'] as string | undefined;
    const referer = req.headers?.['referer'] as string | undefined;

    let requestOrigin: string | undefined;
    if (origin) {
      requestOrigin = origin;
    } else if (referer) {
      try {
        requestOrigin = new URL(referer).origin;
      } catch {
        // Malformed referer url
      }
    }

    if (requestOrigin) {
      const normalized = requestOrigin.toLowerCase().replace(/\/$/, '');
      const isAllowed = this.allowedOrigins.some(allowed => normalized === allowed);
      if (!isAllowed) {
        throw new ForbiddenException({
          type: 'https://tools.ietf.org/html/rfc7807',
          title: 'Forbidden',
          status: 403,
          detail: `Cross-origin request rejected from Origin: "${requestOrigin}"`,
        });
      }
    }

    // 2. CSRF Token Double-Submit Cookie validation
    const rawPath = req.originalUrl || req.url || '';
    const path = rawPath.split('?')[0];
    const isSensitiveSessionRoute =
      path.endsWith('/auth/refresh') ||
      path.endsWith('/auth/logout') ||
      path.endsWith('/auth/mfa/challenge');

    const cookieXsrfToken =
      req.cookies?.['xsrf-token'] ||
      req.cookies?.['csrfToken'] ||
      req.cookies?.['XSRF-TOKEN'];
    const hasSessionCookie = Boolean(req.cookies?.['refreshToken'] || req.cookies?.['sessionId']);

    if (cookieXsrfToken || (hasSessionCookie && isSensitiveSessionRoute)) {
      const headerTokenRaw = req.headers?.['x-csrf-token'] || req.headers?.['x-xsrf-token'];
      const headerToken = Array.isArray(headerTokenRaw) ? headerTokenRaw[0] : headerTokenRaw;

      if (!headerToken) {
        throw new ForbiddenException({
          type: 'https://tools.ietf.org/html/rfc7807',
          title: 'Forbidden',
          status: 403,
          detail: 'CSRF token missing',
        });
      }

      if (cookieXsrfToken && !timingSafeMatch(headerToken, cookieXsrfToken)) {
        throw new ForbiddenException({
          type: 'https://tools.ietf.org/html/rfc7807',
          title: 'Forbidden',
          status: 403,
          detail: 'Invalid CSRF token',
        });
      }
    }

    return true;
  }
}
