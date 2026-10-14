import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Role } from '@onebridge/shared';

export interface AuthenticatedUser {
  personId: string;
  role: Role;
  tenantId?: string;
}

@Injectable()
export class TenantAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();

    // In service / local context, extract X-User-Id, X-User-Role, and X-Tenant-Id headers
    const personId = req.headers?.['x-user-id'] as string | undefined;
    const role = req.headers?.['x-user-role'] as Role | undefined;
    const tenantId = req.headers?.['x-tenant-id'] as string | undefined;

    // Attach user object to request if present (never auto-elevate to owner)
    req.user = {
      personId,
      role,
      tenantId,
    };

    return true;
  }
}
