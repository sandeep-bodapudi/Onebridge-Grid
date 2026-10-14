import { TenantScopedRepository, MongoConnectionHandle } from '@onebridge/shared';
import { ulid } from 'ulid';
import { CounterDoc, CounterType } from '../domain/counter.js';

export class MongoCounterRepository extends TenantScopedRepository<CounterDoc> {
  constructor(dbOrHandle: MongoConnectionHandle | unknown) {
    super(dbOrHandle as MongoConnectionHandle, 'counters');
  }

  /**
   * Atomically and monotonically advances the sequence counter for a specific entity type.
   * Per F03 AC-4 & ADR-0001: Counters never reuse a number.
   */
  async getNextSequence(tenantId: string, type: CounterType): Promise<number> {
    const filter = { tenantId, type } as Parameters<typeof this.findOneAndUpdate>[0];
    const update = {
      $inc: { seq: 1 },
      $setOnInsert: {
        id: ulid(),
        tenantId,
      },
      $set: {
        updatedAt: new Date().toISOString(),
      },
    } as unknown as Parameters<typeof this.findOneAndUpdate>[1];
    const options = {
      upsert: true,
      returnDocument: 'after',
    } as Parameters<typeof this.findOneAndUpdate>[2];

    const result = await this.findOneAndUpdate(filter, update, options);
    const doc =
      result && 'seq' in result
        ? (result as unknown as CounterDoc)
        : (result as unknown as { value?: CounterDoc })?.value;

    if (!doc || typeof doc.seq !== 'number') {
      throw new Error(
        `Failed to advance counter for entity type "${type}" in tenant "${tenantId}"`
      );
    }
    return doc.seq;
  }

  /**
   * Returns current sequence without incrementing (0 if uninitialized).
   */
  async getSequence(tenantId: string, type: CounterType): Promise<number> {
    const filter = { tenantId, type } as Parameters<typeof this.findOne>[0];
    const doc = await this.findOne(filter);
    return doc?.seq ?? 0;
  }

  async createIndexes(): Promise<void> {
    await this.collection.createIndex({ tenantId: 1, type: 1 }, { unique: true });
  }
}
