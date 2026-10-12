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

    const handlerObj = handler as Record<string, unknown> | undefined;
    const handlerVal = (handlerObj?.value as Record<string, unknown> | undefined);
    const targetClassObj = targetClass as Record<string, unknown> | undefined;

    const requiredPermissions: Capability[] =
      ((handlerObj && (handlerObj[PERMISSIONS_METADATA_KEY] as Capability[] | undefined)) ||
        (handlerVal && (handlerVal[PERMISSIONS_METADATA_KEY] as Capability[] | undefined)) ||
        (targetClassObj && (targetClassObj[PERMISSIONS_METADATA_KEY] as Capability[] | undefined))) ||
      [];

    const requiredRoles: Role[] =
      ((handlerObj && (handlerObj[ROLES_METADATA_KEY] as Role[] | undefined)) ||
        (handlerVal && (handlerVal[ROLES_METADATA_KEY] as Role[] | undefined)) ||
        (targetClassObj && (targetClassObj[ROLES_METADATA_KEY] as Role[] | undefined))) ||
      [];

    if (requiredPermissions.length === 0 && requiredRoles.length === 0) {
      return true;
    }

    const req = request as Record<string, unknown>;
    const membership = (req.membership || req.activeMembership) as MembershipLike | undefined;
    const headers = (req.headers || {}) as Record<string, string | undefined>;
    const correlationId = headers['x-correlation-id'] || (req.correlationId as string | undefined) || 'unknown';

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

    const params = (req.params || {}) as Record<string, string | undefined>;
    const query = (req.query || {}) as Record<string, string | undefined>;

    const resourceContext: ResourceContext = {
      branchId: params.branchId || query.branchId,
      departmentId: params.departmentId || query.departmentId,
      teamId: params.teamId || query.teamId,
      ownerPersonId: params.personId || query.personId || params.userId
    };

    for (const cap of requiredPermissions) {
      assertPermission(membership, cap, resourceContext, correlationId);
    }

    return true;
  }
}
