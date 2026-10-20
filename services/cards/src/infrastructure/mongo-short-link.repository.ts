import { TenantScopedRepository, MongoConnectionHandle, TenantIsolationError } from '@onebridge/shared';
import { ShortLinkProps } from '../domain/short-link.js';

export interface ShortLinkDoc extends ShortLinkProps {
  [key: string]: unknown;
}

export class MongoShortLinkRepository extends TenantScopedRepository<ShortLinkDoc> {
  constructor(dbOrHandle: MongoConnectionHandle | unknown) {
    super(dbOrHandle as MongoConnectionHandle, 'short_links');
  }

  async findById(id: string): Promise<ShortLinkProps | null> {
    const doc = await this.findOne({ id } as unknown as Parameters<typeof this.findOne>[0]);
    return doc ? (doc as unknown as ShortLinkProps) : null;
  }

  async findByTarget(targetId: string): Promise<ShortLinkProps[]> {
    const docs = await this.find({ targetId } as unknown as Parameters<typeof this.find>[0]);
    return docs as unknown as ShortLinkProps[];
  }

  async findBySource(targetId: string, source: string): Promise<ShortLinkProps | null> {
    const doc = await this.findOne({ targetId, source } as unknown as Parameters<typeof this.findOne>[0]);
    return doc ? (doc as unknown as ShortLinkProps) : null;
  }

  /**
   * Public code lookup used by edge worker resolution fallback.
   * Directly uses underlying collection to find globally by unique code.
   */
  async findByCodeGlobal(code: string): Promise<ShortLinkProps | null> {
    const doc = await this.collection.findOne({ code });
    return doc ? (doc as unknown as ShortLinkProps) : null;
  }

  async save(link: ShortLinkProps): Promise<ShortLinkProps> {
    const activeTenantId = this.getActiveTenantId();
    if (link.tenantId && link.tenantId !== activeTenantId) {
      throw new TenantIsolationError(
        `TenantIsolationError: Mismatched tenantId "${link.tenantId}" against active tenantId "${activeTenantId}"`
      );
    }

    const docToSave: ShortLinkDoc = { ...link, tenantId: activeTenantId };
    const idFilter = { id: link.id } as unknown as Parameters<typeof this.findOne>[0];
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
    await this.collection.createIndex({ code: 1 }, { unique: true });
    await this.collection.createIndex({ tenantId: 1, targetId: 1 });
    await this.collection.createIndex({ tenantId: 1, targetId: 1, source: 1 });
  }
}
