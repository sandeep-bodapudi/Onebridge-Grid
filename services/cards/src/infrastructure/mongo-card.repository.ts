import { TenantScopedRepository, MongoConnectionHandle, TenantIsolationError } from '@onebridge/shared';
import { CardProps } from '../domain/card.js';

export interface CardDoc extends CardProps {
  [key: string]: unknown;
}

export class MongoCardRepository extends TenantScopedRepository<CardDoc> {
  constructor(dbOrHandle: MongoConnectionHandle | unknown) {
    super(dbOrHandle as MongoConnectionHandle, 'cards');
  }

  async findById(id: string): Promise<CardProps | null> {
    const doc = await this.findOne({ id } as unknown as Parameters<typeof this.findOne>[0]);
    return doc ? (doc as unknown as CardProps) : null;
  }

  async findByIds(ids: string[]): Promise<CardProps[]> {
    if (ids.length === 0) return [];
    const docs = await this.find({ id: { $in: ids } } as unknown as Parameters<typeof this.find>[0]);
    return docs as unknown as CardProps[];
  }

  async findBySlug(slug: string): Promise<CardProps | null> {
    const doc = await this.findOne({ slug } as unknown as Parameters<typeof this.findOne>[0]);
    return doc ? (doc as unknown as CardProps) : null;
  }

  /**
   * Public card lookup by unique card slug across tenants (F12).
   * The caller MUST immediately enter TenantContext.run(card.tenantId)
   * before querying any tenant-scoped read models or child entities.
   */
  async findBySlugGlobal(slug: string): Promise<CardProps | null> {
    const doc = await this.collection.findOne({ slug } as unknown as Parameters<typeof this.collection.findOne>[0]);
    return doc ? (doc as unknown as CardProps) : null;
  }

  async listPublishedByTenant(): Promise<CardProps[]> {
    const docs = await this.find({ status: 'published' } as unknown as Parameters<typeof this.find>[0]);
    return docs as unknown as CardProps[];
  }

  async save(card: CardProps): Promise<CardProps> {
    const activeTenantId = this.getActiveTenantId();
    if (card.tenantId && card.tenantId !== activeTenantId) {
      throw new TenantIsolationError(
        `TenantIsolationError: Mismatched tenantId "${card.tenantId}" against active tenantId "${activeTenantId}"`
      );
    }

    const docToSave: CardDoc = { ...card, tenantId: activeTenantId };
    const idFilter = { id: card.id } as unknown as Parameters<typeof this.findOne>[0];
    const existing = await this.findOne(idFilter);

    if (existing) {
      await this.replaceOne(
        idFilter as unknown as Parameters<typeof this.replaceOne>[0],
        docToSave as unknown as Parameters<typeof this.replaceOne>[1]
      );
    } else {
      await this.insertOne(docToSave as unknown as Parameters<typeof this.insertOne>[0]);
    }

    return docToSave;
  }

  async createIndexes(): Promise<void> {
    await this.collection.createIndex({ id: 1 }, { unique: true });
    await this.collection.createIndex({ tenantId: 1, ownerId: 1 });
    await this.collection.createIndex({ slug: 1 }, { unique: true });
    await this.collection.createIndex({ tenantId: 1, status: 1 });
  }
}
