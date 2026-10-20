import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthenticationError, RequestAuthenticator, Role } from '@onebridge/shared';

export interface AuthenticatedUser {
  personId: string;
  role?: Role;
  tenantId?: string;
}

export const REQUEST_AUTHENTICATOR = 'REQUEST_AUTHENTICATOR';

/**
 * Establishes the caller from the identity access token (verified locally)
 * and their role in X-Tenant-Id (identity membership lookup). Client-sent
 * X-User-Id / X-User-Role headers are overwritten with the verified values,
 * so controllers reading them see only trusted data. Header-only identity is
 * accepted under NODE_ENV=test only. See docs/decisions.md D-SERVICE-AUTH.
 *
 * Kept per service (not imported from another service), per AGENTS.md
 * section 5; the logic lives in @onebridge/shared RequestAuthenticator.
 */
@Injectable()
export class TenantAuthGuard implements CanActivate {
  constructor(@Inject(REQUEST_AUTHENTICATOR) private readonly authenticator: RequestAuthenticator) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    try {
      const caller = await this.authenticator.authenticate(req.headers ?? {});
      RequestAuthenticator.applyToHeaders(req.headers, caller);
      req.user = { personId: caller.personId, role: caller.role, tenantId: caller.tenantId, scope: caller.scope, via: caller.via };
      return true;
    } catch (err) {
      if (err instanceof AuthenticationError) {
        throw new UnauthorizedException({
          type: 'https://tools.ietf.org/html/rfc7807',
          title: 'Unauthorized',
          status: 401,
          detail: 'Your session has expired or is missing. Sign in again.',
        });
      }
      throw err;
    }
  }
}
