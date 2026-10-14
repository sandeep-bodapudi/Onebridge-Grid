import { TenantScopedRepository, MongoConnectionHandle } from '@onebridge/shared';
import { BranchProps } from '../domain/branch.js';

export class MongoBranchRepository extends TenantScopedRepository<BranchProps> {
  constructor(dbOrHandle: MongoConnectionHandle | unknown) {
    super(dbOrHandle as MongoConnectionHandle, 'branches');
  }

  async save(branch: BranchProps): Promise<BranchProps> {
    const filter = { id: branch.id } as Parameters<typeof this.replaceOne>[0];
    const existing = await this.findOne(filter);

    if (existing) {
      await this.replaceOne(filter, branch);
    } else {
      await this.insertOne(branch as Parameters<typeof this.insertOne>[0]);
    }
    return branch;
  }

  async findById(id: string): Promise<BranchProps | null> {
    const filter = { id } as Parameters<typeof this.findOne>[0];
    return this.findOne(filter);
  }

  async listBranches(includeArchived = false): Promise<BranchProps[]> {
    const filter: Record<string, unknown> = {};
    if (!includeArchived) {
      filter.status = 'active';
    }
    return this.find(filter as Parameters<typeof this.find>[0]);
  }

  async countActiveBranches(): Promise<number> {
    const filter = { status: 'active' } as Parameters<typeof this.countDocuments>[0];
    return this.countDocuments(filter);
  }

  async createIndexes(): Promise<void> {
    await this.collection.createIndex({ tenantId: 1, id: 1 }, { unique: true });
    await this.collection.createIndex({ tenantId: 1, status: 1 });
  }
}
