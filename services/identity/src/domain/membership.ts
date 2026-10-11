import { Role, MembershipScope } from '@onebridge/shared';

export interface MembershipProps {
  id: string;
  personId: string;
  orgId: string;
  tenantId?: string;
  role: Role;
  scope?: MembershipScope;
  createdAt?: string;
  updatedAt?: string;
}

export class Membership {
  public readonly id: string;
  public readonly personId: string;
  public readonly orgId: string;
  public readonly role: Role;
  public readonly scope?: MembershipScope;
  public readonly createdAt: string;
  public readonly updatedAt: string;

  constructor(props: MembershipProps) {
    if (!props.personId) throw new Error('personId is required');
    if (!props.orgId) throw new Error('orgId is required');
    if (!props.role) throw new Error('role is required');

    this.id = props.id || `mem-${Math.random().toString(36).substring(2, 9)}`;
    this.personId = props.personId;
    this.orgId = props.orgId;
    this.role = props.role;
    this.scope = props.scope;
    this.createdAt = props.createdAt || new Date().toISOString();
    this.updatedAt = props.updatedAt || new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      personId: this.personId,
      orgId: this.orgId,
      role: this.role,
      scope: this.scope,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}
