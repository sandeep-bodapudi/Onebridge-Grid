import { ProblemException } from '../global-exception.filter.js';
import { Capability, hasPermission, MembershipLike, ResourceContext, Role } from './roles.js';

export const PERMISSIONS_METADATA_KEY = 'rbac:permissions';
export const ROLES_METADATA_KEY = 'rbac:roles';

export function RequirePermission(...permissions: Capability[]) {
  return (target: object, _key?: string | symbol, descriptor?: TypedPropertyDescriptor<unknown>) => {
    if (descriptor) {
      ((descriptor.value as unknown) as Record<string, unknown>)[PERMISSIONS_METADATA_KEY] = permissions;
      return descriptor;
    }
    ((target as unknown) as Record<string, unknown>)[PERMISSIONS_METADATA_KEY] = permissions;
    return target;
  };
}

export function RequireRole(...roles: Role[]) {
  return (target: object, _key?: string | symbol, descriptor?: TypedPropertyDescriptor<unknown>) => {
    if (descriptor) {
      ((descriptor.value as unknown) as Record<string, unknown>)[ROLES_METADATA_KEY] = roles;
      return descriptor;
    }
    ((target as unknown) as Record<string, unknown>)[ROLES_METADATA_KEY] = roles;
    return target;
  };
}

export function assertPermission(
  membership: MembershipLike,
  capability: Capability,
  resourceContext?: ResourceContext,
  correlationId = 'unknown'
): void {
  const allowed = hasPermission(membership, capability, resourceContext);
  if (!allowed) {
    throw new ProblemException(
      403,
      'Forbidden',
      `Access denied: role '${membership.role}' lacks permission for '${capability}' in requested scope`,
      correlationId
    );
  }
}

export interface RbacExecutionContext {
  getHandler?: () => unknown;
  getClass?: () => unknown;
  handler?: unknown;
  targetClass?: unknown;
  switchToHttp?: () => { getRequest(): unknown };
  request?: unknown;
}

export class RbacGuard {
  canActivate(context: RbacExecutionContext): boolean {
    const handler = (context.getHandler ? context.getHandler() : context.handler) as Record<string, unknown> | undefined;
    const targetClass = (context.getClass ? context.getClass() : context.targetClass) as Record<string, unknown> | undefined;
    const request = (context.switchToHttp ? context.switchToHttp().getRequest() : context.request || context) as Record<string, unknown>;

    const requiredPermissions: Capability[] =
      (handler && (handler[PERMISSIONS_METADATA_KEY] || (handler.value && handler.value[PERMISSIONS_METADATA_KEY]))) ||
      (targetClass && targetClass[PERMISSIONS_METADATA_KEY]) ||
      [];

    const requiredRoles: Role[] =
      (handler && (handler[ROLES_METADATA_KEY] || (handler.value && handler.value[ROLES_METADATA_KEY]))) ||
      (targetClass && targetClass[ROLES_METADATA_KEY]) ||
      [];

    if (requiredPermissions.length === 0 && requiredRoles.length === 0) {
      return true;
    }

    const membership: MembershipLike | undefined = request.membership || request.activeMembership;
    const correlationId = request.headers?.['x-correlation-id'] || request.correlationId || 'unknown';

    if (!membership) {
      throw new ProblemException(
        403,
        'Forbidden',
        'Access denied: missing membership context for active tenant',
        correlationId
      );
    }

    if (requiredRoles.length > 0 && !requiredRoles.includes(membership.role)) {
      throw new ProblemException(
        403,
        'Forbidden',
        `Access denied: role '${membership.role}' does not match required roles [${requiredRoles.join(', ')}]`,
        correlationId
      );
    }

    const resourceContext: ResourceContext = {
      branchId: request.params?.branchId || request.query?.branchId,
      departmentId: request.params?.departmentId || request.query?.departmentId,
      teamId: request.params?.teamId || request.query?.teamId,
      ownerPersonId: request.params?.personId || request.query?.personId || request.params?.userId
    };

    for (const cap of requiredPermissions) {
      assertPermission(membership, cap, resourceContext, correlationId);
    }

    return true;
  }
}
