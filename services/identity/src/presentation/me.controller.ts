import { CacheStore, ProblemException, Role } from '@onebridge/shared';
import { RbacService, MeResult } from '../application/rbac.service.js';
import { TokenService } from '../application/token.service.js';
import { MembershipProps } from '../domain/membership.js';
import { InMemoryCacheStore } from './auth.controller.js';

export class MeController {
  private cacheStore: CacheStore;

  constructor(
    private rbacService: RbacService,
    private tokenService: TokenService,
    cacheStore?: CacheStore
  ) {
    this.cacheStore = cacheStore || new InMemoryCacheStore();
  }

  private extractUserIdFromAuth(authHeader?: string, correlationId = 'unknown'): string {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ProblemException(
        401,
        'Unauthorized',
        'Missing or invalid Authorization header',
        correlationId
      );
    }
    const token = authHeader.substring(7);
    const decoded = this.tokenService.verifyAccessToken(token);
    if (!decoded) {
      throw new ProblemException(
        401,
        'Unauthorized',
        'Expired or invalid access token',
        correlationId
      );
    }
    return decoded.sub || decoded.userId;
  }

  async getMe(
    authorization?: string,
    activeTenantHeader?: string,
    ctx: { correlationId: string } = { correlationId: 'unknown' }
  ): Promise<MeResult> {
    const userId = this.extractUserIdFromAuth(authorization, ctx.correlationId);
    return this.rbacService.getMe(userId, activeTenantHeader, ctx.correlationId);
  }

  async createInternalMembership(
    body: {
      personId: string;
      orgId: string;
      role: Role;
      branchId?: string;
      departmentId?: string;
      teamId?: string;
    },
    idempotencyKey?: string,
    ctx: { correlationId?: string } = {}
  ): Promise<MembershipProps> {
    const correlationId = ctx.correlationId || 'unknown';
    if (idempotencyKey) {
      const cached = await this.cacheStore.get(idempotencyKey);
      if (cached) {
        if (JSON.stringify(cached.requestBody) !== JSON.stringify(body)) {
          throw new ProblemException(
            422,
            'Unprocessable Entity',
            'Mismatching body for idempotency key',
            correlationId
          );
        }
        return cached.response as MembershipProps;
      }
    }

    const created = await this.rbacService.createMembership(body);
    if (idempotencyKey) {
      await this.cacheStore.set(idempotencyKey, { requestBody: body, response: created }, 86400);
    }
    return created;
  }
}
