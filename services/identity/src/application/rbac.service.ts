import { 
  EventBus, 
  ProblemException, 
  Role, 
  getEffectiveRolePermissions 
} from '@onebridge/shared';
import { InMemoryMembershipRepository } from '../infrastructure/repositories/in-memory-membership.repository.js';
import { InMemoryPersonRepository } from '../infrastructure/repositories/in-memory-person.repository.js';
import { MembershipProps } from '../domain/membership.js';

export interface ActiveTenantContext {
  tenantId: string;
  orgName?: string;
  role: Role;
  permissions: string[];
  scope?: {
    branchId?: string;
    departmentId?: string;
    teamId?: string;
  };
}

export interface MeResult {
  person: {
    id: string;
    name?: string;
    phone: string;
    email?: string;
  };
  memberships: MembershipProps[];
  activeTenant?: ActiveTenantContext;
}

export class RbacService {
  constructor(
    private membershipRepo: InMemoryMembershipRepository,
    private personRepo: InMemoryPersonRepository,
    private eventBus: EventBus
  ) {}

  async getMe(personId: string, requestedTenantId?: string, correlationId = 'unknown'): Promise<MeResult> {
    const person = await this.personRepo.findById(personId);
    if (!person) {
      throw new ProblemException(401, 'Unauthorized', 'Person profile not found', correlationId);
    }

    const memberships = await this.membershipRepo.findByPersonId(personId);

    let activeMembership: MembershipProps | undefined;

    if (requestedTenantId) {
      activeMembership = memberships.find(m => m.orgId === requestedTenantId || m.tenantId === requestedTenantId);
      if (!activeMembership) {
        // Emit security audit event (No personal data: only IDs and action)
        await this.eventBus.publish({
          eventId: `evt-${Math.random().toString(36).substring(2, 9)}`,
          type: 'audit.recorded',
          version: '1.0.0',
          tenantId: requestedTenantId,
          occurredAt: new Date().toISOString(),
          correlationId,
          payload: {
            action: 'authorization.denied',
            personId,
            targetTenantId: requestedTenantId,
            reason: 'membership_not_found'
          },
          aggregateVersion: 1
        });

        throw new ProblemException(
          403,
          'Forbidden',
          `No membership found for tenant: ${requestedTenantId}`,
          correlationId
        );
      }
    } else {
      activeMembership = memberships[0];
    }

    let activeTenant: ActiveTenantContext | undefined;
    if (activeMembership) {
      const permissions = getEffectiveRolePermissions(activeMembership.role);
      activeTenant = {
        tenantId: activeMembership.orgId,
        role: activeMembership.role,
        permissions,
        scope: activeMembership.scope
      };
    }

    return {
      person: {
        id: person.userId,
        name: person.name,
        phone: person.phone || '',
        email: person.email
      },
      memberships,
      activeTenant
    };
  }

  async createMembership(props: {
    personId: string;
    orgId: string;
    role: Role;
    branchId?: string;
    departmentId?: string;
    teamId?: string;
  }): Promise<MembershipProps> {
    const existing = await this.membershipRepo.findByPersonAndOrg(props.personId, props.orgId);
    const membership: MembershipProps = {
      id: existing ? existing.id : `mem-${Math.random().toString(36).substring(2, 9)}`,
      personId: props.personId,
      orgId: props.orgId,
      role: props.role,
      scope: {
        branchId: props.branchId,
        departmentId: props.departmentId,
        teamId: props.teamId
      },
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return this.membershipRepo.save(membership);
  }
}
