import { TenantScopedRepository, MongoConnectionHandle } from '@onebridge/shared';
import { OrgReadModel, SeatReadModel, BranchReadModel, isNewerVersion } from '../domain/read-models.js';

export interface OrgReadModelDoc extends OrgReadModel {
  id: string; // = tenantId, so TenantScopedRepository's generic findOne/replaceOne stay simple
  [key: string]: unknown;
}

type OrgRepoBase = TenantScopedRepository<OrgReadModelDoc>;

export class MongoOrgReadModelRepository extends TenantScopedRepository<OrgReadModelDoc> {
  constructor(dbOrHandle: MongoConnectionHandle | unknown) {
    super(dbOrHandle as MongoConnectionHandle, 'org_read_models');
  }

  async findByTenantId(tenantId: string): Promise<OrgReadModel | null> {
    const filter = { id: tenantId } as unknown as Parameters<OrgRepoBase['findOne']>[0];
    const doc = await this.findOne(filter);
    return doc ? (doc as unknown as OrgReadModel) : null;
  }

  /** Upserts only if `model.aggregateVersion` is newer than the stored one (ADR-0003 point 3). Returns true if applied. */
  async upsertIfNewer(model: OrgReadModel): Promise<boolean> {
    const activeTenantId = this.getActiveTenantId();
    const existing = await this.findByTenantId(model.tenantId);
    if (!isNewerVersion(existing?.aggregateVersion, model.aggregateVersion)) {
      return false;
    }
    const doc: OrgReadModelDoc = { ...model, id: model.tenantId, tenantId: activeTenantId };
    const idFilter = { id: model.tenantId } as unknown as Parameters<OrgRepoBase['findOne']>[0];
    if (existing) {
      await this.replaceOne(
        idFilter as unknown as Parameters<OrgRepoBase['replaceOne']>[0],
        doc as unknown as Parameters<OrgRepoBase['replaceOne']>[1]
      );
    } else {
      await this.insertOne(doc as unknown as Parameters<OrgRepoBase['insertOne']>[0]);
    }
    return true;
  }

  async createIndexes(): Promise<void> {
    await this.collection.createIndex({ id: 1 }, { unique: true });
  }
}

export interface SeatReadModelDoc extends SeatReadModel {
  id: string; // = seatId
  [key: string]: unknown;
}

type SeatRepoBase = TenantScopedRepository<SeatReadModelDoc>;

export class MongoSeatReadModelRepository extends TenantScopedRepository<SeatReadModelDoc> {
  constructor(dbOrHandle: MongoConnectionHandle | unknown) {
    super(dbOrHandle as MongoConnectionHandle, 'seat_read_models');
  }

  async findBySeatId(seatId: string): Promise<SeatReadModel | null> {
    const filter = { id: seatId } as unknown as Parameters<SeatRepoBase['findOne']>[0];
    const doc = await this.findOne(filter);
    return doc ? (doc as unknown as SeatReadModel) : null;
  }

  async upsertIfNewer(model: SeatReadModel): Promise<boolean> {
    const activeTenantId = this.getActiveTenantId();
    const existing = await this.findBySeatId(model.seatId);
    if (!isNewerVersion(existing?.aggregateVersion, model.aggregateVersion)) {
      return false;
    }
    const doc: SeatReadModelDoc = { ...model, id: model.seatId, tenantId: activeTenantId };
    const idFilter = { id: model.seatId } as unknown as Parameters<SeatRepoBase['findOne']>[0];
    if (existing) {
      await this.replaceOne(
        idFilter as unknown as Parameters<SeatRepoBase['replaceOne']>[0],
        doc as unknown as Parameters<SeatRepoBase['replaceOne']>[1]
      );
    } else {
      await this.insertOne(doc as unknown as Parameters<SeatRepoBase['insertOne']>[0]);
    }
    return true;
  }

  async createIndexes(): Promise<void> {
    await this.collection.createIndex({ id: 1 }, { unique: true });
    await this.collection.createIndex({ tenantId: 1 });
  }
}

export interface BranchReadModelDoc extends BranchReadModel {
  id: string; // = branchId
  [key: string]: unknown;
}

type BranchRepoBase = TenantScopedRepository<BranchReadModelDoc>;

export class MongoBranchReadModelRepository extends TenantScopedRepository<BranchReadModelDoc> {
  constructor(dbOrHandle: MongoConnectionHandle | unknown) {
    super(dbOrHandle as MongoConnectionHandle, 'branch_read_models');
  }

  async findByBranchId(branchId: string): Promise<BranchReadModel | null> {
    const filter = { id: branchId } as unknown as Parameters<BranchRepoBase['findOne']>[0];
    const doc = await this.findOne(filter);
    return doc ? (doc as unknown as BranchReadModel) : null;
  }

  async upsertIfNewer(model: BranchReadModel): Promise<boolean> {
    const activeTenantId = this.getActiveTenantId();
    const existing = await this.findByBranchId(model.branchId);
    if (!isNewerVersion(existing?.aggregateVersion, model.aggregateVersion)) {
      return false;
    }
    const doc: BranchReadModelDoc = { ...model, id: model.branchId, tenantId: activeTenantId };
    const idFilter = { id: model.branchId } as unknown as Parameters<BranchRepoBase['findOne']>[0];
    if (existing) {
      await this.replaceOne(
        idFilter as unknown as Parameters<BranchRepoBase['replaceOne']>[0],
        doc as unknown as Parameters<BranchRepoBase['replaceOne']>[1]
      );
    } else {
      await this.insertOne(doc as unknown as Parameters<BranchRepoBase['insertOne']>[0]);
    }
    return true;
  }

  async createIndexes(): Promise<void> {
    await this.collection.createIndex({ id: 1 }, { unique: true });
    await this.collection.createIndex({ tenantId: 1 });
  }
}
