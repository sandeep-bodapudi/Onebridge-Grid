import { TenantScopedRepository, TenantContext, TenantIsolationError, MongoConnectionHandle } from '@onebridge/shared';
import { MembershipProps } from '../../domain/membership.js';

export interface MongoMembershipDoc extends MembershipProps {
  id: string;
  tenantId: string;
}

export class MongoMembershipRepository {
  private repo: TenantScopedRepository<MongoMembershipDoc>;

  constructor(dbOrHandle: MongoConnectionHandle | unknown) {
    this.repo = new TenantScopedRepository<MongoMembershipDoc>(dbOrHandle as MongoConnectionHandle, 'memberships');
  }

  async ensureIndexes(): Promise<void> {
    await this.repo.createIndex({ tenantId: 1, personId: 1 }, { unique: true });
  }

  async findByPersonId(personId: string): Promise<MembershipProps[]> {
    const docs = await this.repo.findUnscopedByPerson(personId);
    return docs;
  }

  async findByPersonAndOrg(personId: string, orgId: string): Promise<MembershipProps | null> {
    if (!orgId) {
      throw new TenantIsolationError('TenantIsolationError: Missing tenantId in query');
    }
    return TenantContext.run(orgId, async () => {
      const found = await this.repo.findOne({ personId });
      return found;
    });
  }

  async findById(id: string): Promise<MembershipProps | null> {
    const doc = await this.repo.findOne({ id });
    return doc;
  }

  async listByTenant(limit = 20, offset = 0): Promise<{ items: MembershipProps[]; total: number }> {
    const total = await this.repo.countDocuments();
    const items = await this.repo.find({}, { limit, skip: offset });
    return { items, total };
  }

  async save(item: MembershipProps): Promise<MembershipProps> {
    const tenantId = item.orgId || item.tenantId;
    if (!tenantId) {
      throw new TenantIsolationError('TenantIsolationError: Missing tenantId in document');
    }

    const doc: MongoMembershipDoc = {
      ...item,
      id: item.id || `mem_${Math.random().toString(36).substring(2, 9)}`,
      tenantId,
      orgId: tenantId,
    };

    return TenantContext.run(tenantId, async () => {
      const existing = await this.repo.findOne({ personId: doc.personId });
      if (existing) {
        await this.repo.replaceOne({ personId: doc.personId }, doc);
      } else {
        await this.repo.insertOne(doc);
      }
      return doc;
    });
  }
}
