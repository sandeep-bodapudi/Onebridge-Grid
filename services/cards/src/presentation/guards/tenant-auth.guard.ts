import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Role } from '@onebridge/shared';

export interface AuthenticatedUser {
  personId: string;
  role: Role;
  tenantId?: string;
}

/**
 * Thin NestJS request-wiring adapter. Deliberately duplicated per service
 * (not imported from services/organization) because "a service may import
 * only packages/*, never another service's source" (AGENTS.md section 5).
 * The actual RBAC logic lives in packages/shared/src/rbac.
 */
@Injectable()
export class TenantAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();

    const personId = req.headers?.['x-user-id'] as string | undefined;
    const role = req.headers?.['x-user-role'] as Role | undefined;
    const tenantId = req.headers?.['x-tenant-id'] as string | undefined;

    req.user = { personId, role, tenantId };

    return true;
  }
}
