import { describe, it, expect } from 'vitest';
import { 
  ROLES, 
  Role, 
  CAPABILITIES, 
  hasPermission, 
  getEffectiveRolePermissions 
} from '@onebridge/shared';

describe('F02 RBAC Unit Tests (AC-2, AC-3, AC-5)', () => {
  it('should correctly enumerate all 8 standard platform and company roles (AC-2)', () => {
    expect(ROLES).toEqual([
      'super_admin',
      'owner',
      'admin',
      'branch_manager',
      'department_manager',
      'team_lead',
      'employee',
      'viewer'
    ]);
  });

  it('should permit Owner full company-wide access including billing:manage (AC-3)', () => {
    const ownerMembership = {
      id: 'm-owner',
      personId: 'person-owner',
      orgId: 'org-1',
      role: 'owner' as Role,
      createdAt: new Date().toISOString()
    };

    expect(hasPermission(ownerMembership, 'billing:manage')).toBe(true);
    expect(hasPermission(ownerMembership, 'billing:read')).toBe(true);
    expect(hasPermission(ownerMembership, 'org:profile:manage')).toBe(true);
    expect(hasPermission(ownerMembership, 'employees:manage')).toBe(true);
    expect(hasPermission(ownerMembership, 'cards:manage')).toBe(true);
    expect(hasPermission(ownerMembership, 'leads:manage')).toBe(true);
    expect(hasPermission(ownerMembership, 'nfc:order')).toBe(true);
  });

  it('should permit Admin company-wide access but restrict billing to read-only (AC-3)', () => {
    const adminMembership = {
      id: 'm-admin',
      personId: 'person-admin',
      orgId: 'org-1',
      role: 'admin' as Role,
      createdAt: new Date().toISOString()
    };

    // Admin has read-only billing (billing:manage is denied)
    expect(hasPermission(adminMembership, 'billing:read')).toBe(true);
    expect(hasPermission(adminMembership, 'billing:manage')).toBe(false);

    // Admin has full company-wide profile, employees, cards, leads
    expect(hasPermission(adminMembership, 'org:profile:manage')).toBe(true);
    expect(hasPermission(adminMembership, 'employees:manage')).toBe(true);
    expect(hasPermission(adminMembership, 'cards:manage')).toBe(true);
    expect(hasPermission(adminMembership, 'leads:manage')).toBe(true);
    expect(hasPermission(adminMembership, 'nfc:order')).toBe(true);
  });

  it('should restrict Branch Manager actions to assigned branch scope and deny on missing context (AC-3)', () => {
    const branchMgrMembership = {
      id: 'm-bm',
      personId: 'person-bm',
      orgId: 'org-1',
      role: 'branch_manager' as Role,
      scope: { branchId: 'branch-south' },
      createdAt: new Date().toISOString()
    };

    // Cannot manage company profile or billing
    expect(hasPermission(branchMgrMembership, 'billing:manage')).toBe(false);
    expect(hasPermission(branchMgrMembership, 'billing:read')).toBe(false);
    expect(hasPermission(branchMgrMembership, 'org:profile:manage')).toBe(false);
    expect(hasPermission(branchMgrMembership, 'org:profile:read')).toBe(true);

    // Access within own branch
    expect(hasPermission(branchMgrMembership, 'employees:manage', { branchId: 'branch-south' })).toBe(true);
    expect(hasPermission(branchMgrMembership, 'cards:manage', { branchId: 'branch-south' })).toBe(true);
    expect(hasPermission(branchMgrMembership, 'analytics:read', { branchId: 'branch-south' })).toBe(true);

    // Denied in another branch
    expect(hasPermission(branchMgrMembership, 'employees:manage', { branchId: 'branch-north' })).toBe(false);
    expect(hasPermission(branchMgrMembership, 'cards:manage', { branchId: 'branch-north' })).toBe(false);
    expect(hasPermission(branchMgrMembership, 'analytics:read', { branchId: 'branch-north' })).toBe(false);

    // DENY BY DEFAULT when resourceContext is missing or empty
    expect(hasPermission(branchMgrMembership, 'cards:manage')).toBe(false);
    expect(hasPermission(branchMgrMembership, 'cards:manage', {})).toBe(false);
  });

  it('should restrict Department Manager actions to assigned department scope and deny on missing context (AC-3)', () => {
    const deptMgrMembership = {
      id: 'm-dm',
      personId: 'person-dm',
      orgId: 'org-1',
      role: 'department_manager' as Role,
      scope: { departmentId: 'dept-sales' },
      createdAt: new Date().toISOString()
    };

    // Allowed in own department
    expect(hasPermission(deptMgrMembership, 'cards:manage', { departmentId: 'dept-sales' })).toBe(true);
    expect(hasPermission(deptMgrMembership, 'analytics:read', { departmentId: 'dept-sales' })).toBe(true);

    // Denied in another department
    expect(hasPermission(deptMgrMembership, 'cards:manage', { departmentId: 'dept-engineering' })).toBe(false);
    expect(hasPermission(deptMgrMembership, 'analytics:read', { departmentId: 'dept-engineering' })).toBe(false);

    // Denied for company-level capabilities
    expect(hasPermission(deptMgrMembership, 'billing:manage')).toBe(false);
    expect(hasPermission(deptMgrMembership, 'employees:manage', { departmentId: 'dept-sales' })).toBe(false);
    expect(hasPermission(deptMgrMembership, 'nfc:order')).toBe(false);

    // DENY BY DEFAULT when resourceContext is missing
    expect(hasPermission(deptMgrMembership, 'cards:manage')).toBe(false);
    expect(hasPermission(deptMgrMembership, 'cards:manage', {})).toBe(false);
  });

  it('should restrict Team Lead actions to assigned team scope and deny on missing context (AC-3)', () => {
    const teamLeadMembership = {
      id: 'm-tl',
      personId: 'person-tl',
      orgId: 'org-1',
      role: 'team_lead' as Role,
      scope: { teamId: 'team-direct-sales' },
      createdAt: new Date().toISOString()
    };

    // Allowed in own team
    expect(hasPermission(teamLeadMembership, 'cards:manage', { teamId: 'team-direct-sales' })).toBe(true);
    expect(hasPermission(teamLeadMembership, 'analytics:read', { teamId: 'team-direct-sales' })).toBe(true);

    // Denied in another team
    expect(hasPermission(teamLeadMembership, 'cards:manage', { teamId: 'team-support' })).toBe(false);
    expect(hasPermission(teamLeadMembership, 'analytics:read', { teamId: 'team-support' })).toBe(false);

    // Denied for company-level and NFC order
    expect(hasPermission(teamLeadMembership, 'billing:manage')).toBe(false);
    expect(hasPermission(teamLeadMembership, 'employees:manage', { teamId: 'team-direct-sales' })).toBe(false);
    expect(hasPermission(teamLeadMembership, 'nfc:order')).toBe(false);

    // DENY BY DEFAULT when resourceContext is missing
    expect(hasPermission(teamLeadMembership, 'cards:manage')).toBe(false);
    expect(hasPermission(teamLeadMembership, 'cards:manage', {})).toBe(false);
  });

  it('should restrict Employee to own card and own leads, and deny on missing context (AC-3)', () => {
    const employeeMembership = {
      id: 'm-emp',
      personId: 'person-emp',
      orgId: 'org-1',
      role: 'employee' as Role,
      createdAt: new Date().toISOString()
    };

    // Allowed to edit own card
    expect(hasPermission(employeeMembership, 'cards:manage', { ownerPersonId: 'person-emp' })).toBe(true);
    // Denied other's card
    expect(hasPermission(employeeMembership, 'cards:manage', { ownerPersonId: 'person-other' })).toBe(false);

    // Allowed own leads
    expect(hasPermission(employeeMembership, 'leads:read', { ownerPersonId: 'person-emp' })).toBe(true);
    expect(hasPermission(employeeMembership, 'leads:read', { ownerPersonId: 'person-other' })).toBe(false);

    // NFC request allowed, order denied
    expect(hasPermission(employeeMembership, 'nfc:request')).toBe(true);
    expect(hasPermission(employeeMembership, 'nfc:order')).toBe(false);

    // DENY BY DEFAULT when resourceContext is missing
    expect(hasPermission(employeeMembership, 'cards:manage')).toBe(false);
    expect(hasPermission(employeeMembership, 'cards:manage', {})).toBe(false);
    expect(hasPermission(employeeMembership, 'leads:read')).toBe(false);
  });

  it('should restrict Viewer to read-only capabilities and deny all mutations (AC-3)', () => {
    const viewerMembership = {
      id: 'm-viewer',
      personId: 'person-viewer',
      orgId: 'org-1',
      role: 'viewer' as Role,
      createdAt: new Date().toISOString()
    };

    // Read allowed
    expect(hasPermission(viewerMembership, 'billing:read')).toBe(true);
    expect(hasPermission(viewerMembership, 'org:profile:read')).toBe(true);
    expect(hasPermission(viewerMembership, 'audit:read')).toBe(true);
    expect(hasPermission(viewerMembership, 'analytics:read')).toBe(true);
    expect(hasPermission(viewerMembership, 'leads:read')).toBe(true);

    // All mutations denied
    expect(hasPermission(viewerMembership, 'billing:manage')).toBe(false);
    expect(hasPermission(viewerMembership, 'org:profile:manage')).toBe(false);
    expect(hasPermission(viewerMembership, 'employees:manage')).toBe(false);
    expect(hasPermission(viewerMembership, 'cards:manage')).toBe(false);
    expect(hasPermission(viewerMembership, 'leads:manage')).toBe(false);
  });

  it('should treat Super Admin standard roles without active impersonation in F02 (AC-5)', () => {
    const superAdminMembership = {
      id: 'm-super',
      personId: 'person-super',
      orgId: 'platform',
      role: 'super_admin' as Role,
      createdAt: new Date().toISOString()
    };

    const effective = getEffectiveRolePermissions(superAdminMembership.role);
    expect(effective).toContain('audit:read');
    expect(effective).toContain('org:profile:read');
    expect(effective).toContain('billing:manage');
    // Impersonation is not active/defined in standard F02 permissions
    expect(effective).not.toContain('impersonation:active');
  });
});
