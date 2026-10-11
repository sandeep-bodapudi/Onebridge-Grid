export const ROLES = [
  'super_admin',
  'owner',
  'admin',
  'branch_manager',
  'department_manager',
  'team_lead',
  'employee',
  'viewer'
] as const;

export type Role = typeof ROLES[number];

export const CAPABILITIES = [
  'billing:read',
  'billing:manage',
  'org:profile:read',
  'org:profile:manage',
  'org:structure:read',
  'org:structure:manage',
  'employees:read',
  'employees:manage',
  'cards:read',
  'cards:manage',
  'nfc:read',
  'nfc:order',
  'nfc:request',
  'analytics:read',
  'leads:read',
  'leads:manage',
  'relationships:reassign',
  'audit:read',
  'integrations:manage',
  'ai:access'
] as const;

export type Capability = typeof CAPABILITIES[number];

export type ScopeType = 'full' | 'branch' | 'department' | 'team' | 'own' | 'none';

export interface MembershipScope {
  branchId?: string;
  departmentId?: string;
  teamId?: string;
}

export interface MembershipLike {
  id: string;
  personId: string;
  orgId: string;
  role: Role;
  scope?: MembershipScope;
  createdAt: string;
}

export interface ResourceContext {
  branchId?: string;
  departmentId?: string;
  teamId?: string;
  ownerPersonId?: string;
}

export const ROLE_PERMISSION_MATRIX: Record<Role, Partial<Record<Capability, ScopeType>>> = {
  super_admin: {
    'billing:read': 'full',
    'billing:manage': 'full',
    'org:profile:read': 'full',
    'org:profile:manage': 'full',
    'org:structure:read': 'full',
    'org:structure:manage': 'full',
    'employees:read': 'full',
    'employees:manage': 'full',
    'cards:read': 'full',
    'cards:manage': 'full',
    'nfc:read': 'full',
    'nfc:order': 'full',
    'nfc:request': 'full',
    'analytics:read': 'full',
    'leads:read': 'full',
    'leads:manage': 'full',
    'relationships:reassign': 'full',
    'audit:read': 'full',
    'integrations:manage': 'full',
    'ai:access': 'full'
  },
  owner: {
    'billing:read': 'full',
    'billing:manage': 'full',
    'org:profile:read': 'full',
    'org:profile:manage': 'full',
    'org:structure:read': 'full',
    'org:structure:manage': 'full',
    'employees:read': 'full',
    'employees:manage': 'full',
    'cards:read': 'full',
    'cards:manage': 'full',
    'nfc:read': 'full',
    'nfc:order': 'full',
    'nfc:request': 'full',
    'analytics:read': 'full',
    'leads:read': 'full',
    'leads:manage': 'full',
    'relationships:reassign': 'full',
    'audit:read': 'full',
    'integrations:manage': 'full',
    'ai:access': 'full'
  },
  admin: {
    'billing:read': 'full',
    'billing:manage': 'none',
    'org:profile:read': 'full',
    'org:profile:manage': 'full',
    'org:structure:read': 'full',
    'org:structure:manage': 'full',
    'employees:read': 'full',
    'employees:manage': 'full',
    'cards:read': 'full',
    'cards:manage': 'full',
    'nfc:read': 'full',
    'nfc:order': 'full',
    'nfc:request': 'full',
    'analytics:read': 'full',
    'leads:read': 'full',
    'leads:manage': 'full',
    'relationships:reassign': 'full',
    'audit:read': 'full',
    'integrations:manage': 'full',
    'ai:access': 'full'
  },
  branch_manager: {
    'billing:read': 'none',
    'billing:manage': 'none',
    'org:profile:read': 'full',
    'org:profile:manage': 'none',
    'org:structure:read': 'branch',
    'org:structure:manage': 'branch',
    'employees:read': 'branch',
    'employees:manage': 'branch',
    'cards:read': 'branch',
    'cards:manage': 'branch',
    'nfc:read': 'branch',
    'nfc:order': 'branch',
    'nfc:request': 'branch',
    'analytics:read': 'branch',
    'leads:read': 'branch',
    'leads:manage': 'branch',
    'relationships:reassign': 'branch',
    'audit:read': 'branch',
    'integrations:manage': 'none',
    'ai:access': 'branch'
  },
  department_manager: {
    'billing:read': 'none',
    'billing:manage': 'none',
    'org:profile:read': 'full',
    'org:profile:manage': 'none',
    'org:structure:read': 'department',
    'org:structure:manage': 'none',
    'employees:read': 'department',
    'employees:manage': 'none',
    'cards:read': 'department',
    'cards:manage': 'department',
    'nfc:read': 'none',
    'nfc:order': 'none',
    'nfc:request': 'none',
    'analytics:read': 'department',
    'leads:read': 'department',
    'leads:manage': 'department',
    'relationships:reassign': 'department',
    'audit:read': 'none',
    'integrations:manage': 'none',
    'ai:access': 'department'
  },
  team_lead: {
    'billing:read': 'none',
    'billing:manage': 'none',
    'org:profile:read': 'full',
    'org:profile:manage': 'none',
    'org:structure:read': 'team',
    'org:structure:manage': 'none',
    'employees:read': 'team',
    'employees:manage': 'none',
    'cards:read': 'team',
    'cards:manage': 'team',
    'nfc:read': 'none',
    'nfc:order': 'none',
    'nfc:request': 'none',
    'analytics:read': 'team',
    'leads:read': 'team',
    'leads:manage': 'team',
    'relationships:reassign': 'team',
    'audit:read': 'none',
    'integrations:manage': 'none',
    'ai:access': 'team'
  },
  employee: {
    'billing:read': 'none',
    'billing:manage': 'none',
    'org:profile:read': 'full',
    'org:profile:manage': 'none',
    'org:structure:read': 'none',
    'org:structure:manage': 'none',
    'employees:read': 'none',
    'employees:manage': 'none',
    'cards:read': 'own',
    'cards:manage': 'own',
    'nfc:read': 'none',
    'nfc:order': 'none',
    'nfc:request': 'full',
    'analytics:read': 'own',
    'leads:read': 'own',
    'leads:manage': 'own',
    'relationships:reassign': 'none',
    'audit:read': 'none',
    'integrations:manage': 'none',
    'ai:access': 'own'
  },
  viewer: {
    'billing:read': 'full',
    'billing:manage': 'none',
    'org:profile:read': 'full',
    'org:profile:manage': 'none',
    'org:structure:read': 'full',
    'org:structure:manage': 'none',
    'employees:read': 'none',
    'employees:manage': 'none',
    'cards:read': 'none',
    'cards:manage': 'none',
    'nfc:read': 'none',
    'nfc:order': 'none',
    'nfc:request': 'none',
    'analytics:read': 'full',
    'leads:read': 'full',
    'leads:manage': 'none',
    'relationships:reassign': 'none',
    'audit:read': 'full',
    'integrations:manage': 'none',
    'ai:access': 'full'
  }
};

export function hasPermission(
  membership: MembershipLike,
  capability: Capability,
  resourceContext?: ResourceContext
): boolean {
  const rolePermissions = ROLE_PERMISSION_MATRIX[membership.role];
  if (!rolePermissions) return false;

  const scopeType = rolePermissions[capability];
  if (!scopeType || scopeType === 'none') {
    return false;
  }

  if (scopeType === 'full') {
    return true;
  }

  if (scopeType === 'branch') {
    if (!resourceContext?.branchId) return false;
    return Boolean(membership.scope?.branchId && membership.scope.branchId === resourceContext.branchId);
  }

  if (scopeType === 'department') {
    if (!resourceContext?.departmentId) return false;
    return Boolean(membership.scope?.departmentId && membership.scope.departmentId === resourceContext.departmentId);
  }

  if (scopeType === 'team') {
    if (!resourceContext?.teamId) return false;
    return Boolean(membership.scope?.teamId && membership.scope.teamId === resourceContext.teamId);
  }

  if (scopeType === 'own') {
    if (!resourceContext?.ownerPersonId) return false;
    return resourceContext.ownerPersonId === membership.personId;
  }

  return false;
}

export function getEffectiveRolePermissions(role: Role): Capability[] {
  const matrix = ROLE_PERMISSION_MATRIX[role] || {};
  return Object.entries(matrix)
    .filter(([_, scope]) => scope && scope !== 'none')
    .map(([cap]) => cap as Capability);
}
