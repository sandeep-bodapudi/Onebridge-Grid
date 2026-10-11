import { Db, TenantScopedRepository, TenantContext, TenantIsolationError } from '@onebridge/shared';
import { MembershipProps } from '../../domain/membership.js';

interface MongoMembershipDoc extends MembershipProps {
  id: string;
  tenantId: string;
}

export class MongoMembershipRepository {
  private repo: TenantScopedRepository<MongoMembershipDoc>;
  private db: Db;

  constructor(db: Db) {
    this.db = db;
    this.repo = new TenantScopedRepository<MongoMembershipDoc>(db, 'memberships');
  }

  async findByPersonId(personId: string): Promise<MembershipProps[]> {
    // Queries the memberships collection for personId
    const docs = await this.db
      .collection<MongoMembershipDoc>('memberships')
      .find({ personId })
      .toArray();
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

  async save(item: MembershipProps): Promise<MembershipProps> {
    const tenantId = item.orgId || item.tenantId;
    if (!tenantId) {
      throw new TenantIsolationError('TenantIsolationError: Missing tenantId in document');
    }

    const doc: MongoMembershipDoc = {
      ...item,
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
