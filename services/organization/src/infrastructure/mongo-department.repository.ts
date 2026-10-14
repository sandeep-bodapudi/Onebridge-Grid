import { TenantScopedRepository, MongoConnectionHandle } from '@onebridge/shared';
import { DepartmentProps } from '../domain/department.js';

export class MongoDepartmentRepository extends TenantScopedRepository<DepartmentProps> {
  constructor(dbOrHandle: MongoConnectionHandle | unknown) {
    super(dbOrHandle as MongoConnectionHandle, 'departments');
  }

  async save(dept: DepartmentProps): Promise<DepartmentProps> {
    const filter = { id: dept.id } as Parameters<typeof this.replaceOne>[0];
    const existing = await this.findOne(filter);

    if (existing) {
      await this.replaceOne(filter, dept);
    } else {
      await this.insertOne(dept as Parameters<typeof this.insertOne>[0]);
    }
    return dept;
  }

  async findById(id: string): Promise<DepartmentProps | null> {
    const filter = { id } as Parameters<typeof this.findOne>[0];
    return this.findOne(filter);
  }

  async listDepartments(branchId?: string, includeArchived = false): Promise<DepartmentProps[]> {
    const filter: Record<string, unknown> = {};
    if (!includeArchived) {
      filter.status = 'active';
    }
    if (branchId) {
      filter.branchId = branchId;
    }
    return this.find(filter as Parameters<typeof this.find>[0]);
  }

  async createIndexes(): Promise<void> {
    await this.collection.createIndex({ tenantId: 1, id: 1 }, { unique: true });
    await this.collection.createIndex({ tenantId: 1, branchId: 1 });
  }
}
