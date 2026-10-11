import { CanActivate, ExecutionContext, Injectable, ForbiddenException, Inject, Optional } from '@nestjs/common';

interface HttpRequest {
  method: string;
  headers: Record<string, string | string[] | undefined>;
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
    const method = req.method.toUpperCase();

    // Only state-modifying requests need CSRF/Origin validation
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return true;
    }

    const origin = req.headers['origin'] as string | undefined;
    const referer = req.headers['referer'] as string | undefined;

    const requestOrigin = origin || (referer ? new URL(referer).origin : undefined);

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

    return true;
  }
}
