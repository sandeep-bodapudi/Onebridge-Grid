import { GlobalRepository, MongoConnectionHandle } from '@onebridge/shared';
import { IssuedBusinessIdEntry } from '../domain/business-id-registry.js';
import { ulid } from 'ulid';

export interface IssuedBusinessIdDoc extends IssuedBusinessIdEntry {
  [key: string]: unknown;
}

export class MongoIssuedIdRepository extends GlobalRepository<IssuedBusinessIdDoc> {
  constructor(dbOrHandle: MongoConnectionHandle | unknown) {
    super(dbOrHandle as MongoConnectionHandle, 'issued_id_registries');
  }

  /**
   * Atomically claims a Business ID.
   * If collision occurs (unique index on businessId), returns false.
   */
  async claimId(businessId: string, tenantId: string): Promise<boolean> {
    try {
      const entry: IssuedBusinessIdDoc = {
        id: ulid(),
        businessId,
        tenantId,
        status: 'issued',
        issuedAt: new Date().toISOString(),
      };
      await this.collection.insertOne(
        entry as unknown as Parameters<typeof this.collection.insertOne>[0]
      );
      return true;
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 11000) {
        // Unique key constraint violation -> ID collided
        return false;
      }
      throw err;
    }
  }

  /**
   * Per ADR-0001: If creation fails, mark entry as 'void'.
   * Never removed, guarantees "never reused".
   */
  async voidId(businessId: string): Promise<void> {
    const filter = { businessId } as unknown as Parameters<typeof this.collection.updateOne>[0];
    const update = {
      $set: { status: 'void', voidedAt: new Date().toISOString() },
    } as unknown as Parameters<typeof this.collection.updateOne>[1];

    await this.collection.updateOne(filter, update);
  }

  async isClaimed(businessId: string): Promise<boolean> {
    const filter = { businessId } as unknown as Parameters<typeof this.collection.findOne>[0];
    const doc = await this.collection.findOne(filter);
    return doc !== null;
  }

  async createIndexes(): Promise<void> {
    await this.collection.createIndex({ businessId: 1 }, { unique: true });
  }
}
