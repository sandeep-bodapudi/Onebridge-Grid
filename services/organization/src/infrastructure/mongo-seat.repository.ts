import { TenantScopedRepository, MongoConnectionHandle } from '@onebridge/shared';
import { SeatProps } from '../domain/seat.js';

type SeatFilter = NonNullable<Parameters<TenantScopedRepository<SeatProps>['replaceOne']>[0]>;
type SeatFindOptions = Parameters<TenantScopedRepository<SeatProps>['find']>[1];
type SeatInsertDoc = Parameters<TenantScopedRepository<SeatProps>['insertOne']>[0];

export class MongoSeatRepository extends TenantScopedRepository<SeatProps> {
  constructor(dbOrHandle: MongoConnectionHandle | unknown) {
    super(dbOrHandle as MongoConnectionHandle, 'seats');
  }

  async save(seat: SeatProps): Promise<SeatProps> {
    const filter = { id: seat.id } as SeatFilter;
    const existing = await this.findOne(filter);

    if (existing) {
      await this.replaceOne(filter, seat);
    } else {
      await this.insertOne(seat as SeatInsertDoc);
    }
    return seat;
  }

  async findById(id: string): Promise<SeatProps | null> {
    return this.findOne({ id } as SeatFilter);
  }

  async findByPersonId(personId: string): Promise<SeatProps | null> {
    return this.findOne({ personId } as SeatFilter);
  }

  async listSeats(options?: {
    status?: string;
    branchId?: string;
    departmentId?: string;
    teamId?: string;
  }): Promise<SeatProps[]> {
    const filter: Record<string, unknown> = {};
    if (options?.status) {
      filter.status = options.status;
    }
    if (options?.branchId) {
      filter.branchId = options.branchId;
    }
    if (options?.departmentId) {
      filter.departmentId = options.departmentId;
    }
    if (options?.teamId) {
      filter.teamId = options.teamId;
    }
    const findOptions: SeatFindOptions = { sort: { id: 1 } };
    return this.find(filter as SeatFilter, findOptions);
  }

  async countSeats(options?: { status?: string }): Promise<number> {
    const filter: Record<string, unknown> = {};
    if (options?.status) {
      filter.status = options.status;
    }
    return this.countDocuments(filter as SeatFilter);
  }

  async createIndexes(): Promise<void> {
    await this.collection.createIndex({ tenantId: 1, id: 1 }, { unique: true });
    await this.collection.createIndex({ tenantId: 1, personId: 1 });
    await this.collection.createIndex({ tenantId: 1, status: 1 });
    await this.collection.createIndex({ tenantId: 1, branchId: 1 });
    await this.collection.createIndex({ tenantId: 1, departmentId: 1 });
    await this.collection.createIndex({ tenantId: 1, teamId: 1 });
  }
}
