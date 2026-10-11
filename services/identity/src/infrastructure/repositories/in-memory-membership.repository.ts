import { Repository, TenantIsolationError } from '@onebridge/shared';
import { MembershipProps } from '../../domain/membership.js';

export class InMemoryMembershipRepository extends Repository<MembershipProps> {
  constructor(initialData: MembershipProps[] = []) {
    super(initialData);
  }

  /**
   * Global person partition lookup: returns all organization memberships for a user
   * across companies to enable tenant selection on GET /me and login.
   */
  async findByPersonId(personId: string): Promise<MembershipProps[]> {
    return this.collection.filter(m => m.personId === personId);
  }

  async findByPersonAndOrg(personId: string, orgId: string): Promise<MembershipProps | null> {
    if (!orgId) {
      throw new TenantIsolationError('TenantIsolationError: Missing tenantId in query');
    }
    const found = this.collection.find(m => m.personId === personId && (m.orgId === orgId || m.tenantId === orgId));
    return found || null;
  }
  async save(item: MembershipProps): Promise<MembershipProps> {
    const tenantId = item.orgId || item.tenantId;
    if (!tenantId) {
      throw new TenantIsolationError('TenantIsolationError: Missing tenantId in document');
    }

    const record: MembershipProps = {
      ...item,
      tenantId,
      orgId: tenantId
    };

    const idx = this.collection.findIndex(
      m => m.id === record.id || (m.personId === record.personId && (m.orgId === record.orgId || m.tenantId === record.tenantId))
    );

    if (idx >= 0) {
      this.collection[idx] = record;
    } else {
      this.collection.push(record);
    }
    return record;
  }
}
