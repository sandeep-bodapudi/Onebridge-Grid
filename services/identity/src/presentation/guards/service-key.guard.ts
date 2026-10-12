import crypto from 'node:crypto';
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException, Inject, Optional } from '@nestjs/common';

interface HttpRequest {
  headers: Record<string, string | string[] | undefined>;
}

function timingSafeMatch(actual: string, expected: string): boolean {
  const actualHash = crypto.createHash('sha256').update(actual).digest();
  const expectedHash = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(actualHash, expectedHash);
}

@Injectable()
export class ServiceKeyGuard implements CanActivate {
  constructor(
    @Optional() @Inject('INTERNAL_SERVICE_KEY') private expectedKey?: string
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<HttpRequest>();
    const serviceKey = req.headers['x-service-key'];
    const authHeader = req.headers['authorization'];
    const effectiveKey = this.expectedKey || process.env.INTERNAL_SERVICE_KEY || 'test-internal-service-key-at-least-32-chars-12345';

    const isValid = typeof serviceKey === 'string' && timingSafeMatch(serviceKey, effectiveKey);

    if (!isValid) {
      // If user attempted to call internal route with user JWT
      if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        throw new ForbiddenException({
          type: 'https://tools.ietf.org/html/rfc7807',
          title: 'Forbidden',
          status: 403,
          detail: 'User tokens are not permitted on internal service endpoints',
        });
      }
      throw new UnauthorizedException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Unauthorized',
        status: 401,
        detail: 'Missing or invalid service credential (x-service-key required)',
      });
    }

    return true;
  }
}
