import { GlobalRepository, MongoConnectionHandle } from '@onebridge/shared';
import type { Filter } from '@onebridge/shared';

export type ActorType = 'member' | 'company';

/** N04: one follow edge. Global: follows connect people and companies across tenants. */
export interface FollowProps {
  id: string;
  followerType: ActorType;
  followerId: string;
  targetType: ActorType;
  targetId: string;
  source?: string;
  createdAt: string;
}

function strip<T>(doc: (T & { _id?: unknown }) | null): T | null {
  if (!doc) return null;
  const { _id: _i, ...rest } = doc as T & { _id?: unknown } & Record<string, unknown>;
  return rest as unknown as T;
}

export class MongoFollowRepository extends GlobalRepository<FollowProps> {
  constructor(handle: MongoConnectionHandle) {
    super(handle, 'follows');
  }

  /** Inserts the edge if new; returns true when it was created (follow is idempotent). */
  async add(edge: FollowProps): Promise<boolean> {
    const { id, createdAt, source, ...key } = edge;
    const res = await this.collection.updateOne(key as Filter<FollowProps>, { $setOnInsert: { id, createdAt, source } }, { upsert: true });
    return res.upsertedCount === 1;
  }

  async remove(followerType: ActorType, followerId: string, targetType: ActorType, targetId: string): Promise<boolean> {
    return (await this.deleteOne({ followerType, followerId, targetType, targetId } as Filter<FollowProps>)).deletedCount === 1;
  }

  async exists(followerType: ActorType, followerId: string, targetType: ActorType, targetId: string): Promise<boolean> {
    return Boolean(await this.findOne({ followerType, followerId, targetType, targetId } as Filter<FollowProps>));
  }

  async countFollowers(targetType: ActorType, targetId: string): Promise<number> {
    return this.collection.countDocuments({ targetType, targetId } as Filter<FollowProps>);
  }

  async countFollowsSince(followerType: ActorType, followerId: string, sinceIso: string): Promise<number> {
    return this.collection.countDocuments({ followerType, followerId, createdAt: { $gte: sinceIso } } as Filter<FollowProps>);
  }

  /** Newest first; `before` is the createdAt|id of the last item already shown. */
  async listFollowers(targetType: ActorType, targetId: string, limit: number, before?: string): Promise<FollowProps[]> {
    return this.page({ targetType, targetId }, limit, before);
  }

  async listFollowing(followerType: ActorType, followerId: string, limit: number, before?: string): Promise<FollowProps[]> {
    return this.page({ followerType, followerId }, limit, before);
  }

  private async page(base: Record<string, unknown>, limit: number, before?: string): Promise<FollowProps[]> {
    const filter: Record<string, unknown> = { ...base };
    if (before) {
      const [createdAt, id] = before.split('|');
      filter.$or = [{ createdAt: { $lt: createdAt } }, { createdAt, id: { $lt: id } }];
    }
    const docs = await this.collection.find(filter as Filter<FollowProps>).sort({ createdAt: -1, id: -1 }).limit(limit).toArray();
    return docs.map((d) => strip(d as FollowProps & { _id?: unknown })!);
  }

  /** N09 / N10: a block or a deleted account removes follows in both directions. */
  async removeAllBetween(a: { type: ActorType; id: string }, b: { type: ActorType; id: string }): Promise<void> {
    await this.deleteMany({
      $or: [
        { followerType: a.type, followerId: a.id, targetType: b.type, targetId: b.id },
        { followerType: b.type, followerId: b.id, targetType: a.type, targetId: a.id },
      ],
    } as Filter<FollowProps>);
  }

  async createIndexes(): Promise<void> {
    await this.createIndex({ followerType: 1, followerId: 1, targetType: 1, targetId: 1 }, { unique: true });
    await this.createIndex({ targetType: 1, targetId: 1, createdAt: -1 });
    await this.createIndex({ followerType: 1, followerId: 1, createdAt: -1 });
  }
}

/** Company summaries for lists, from org events (ADR-0003). */
export interface CompanyRef {
  tenantId: string;
  name: string;
  slug?: string;
  industry?: string;
  city?: string;
  logo?: string;
  verified: boolean;
  updatedAt: string;
}

export class MongoCompanyRefRepository extends GlobalRepository<CompanyRef> {
  constructor(handle: MongoConnectionHandle) {
    super(handle, 'social_company_refs');
  }

  async get(tenantId: string): Promise<CompanyRef | null> {
    return strip(await this.findOne({ tenantId } as Filter<CompanyRef>));
  }

  async getMany(ids: string[]): Promise<CompanyRef[]> {
    if (!ids.length) return [];
    return (await this.find({ tenantId: { $in: ids } } as Filter<CompanyRef>)).map((d) => strip(d as CompanyRef & { _id?: unknown })!);
  }

  async upsert(ref: CompanyRef): Promise<void> {
    await this.collection.replaceOne({ tenantId: ref.tenantId } as Filter<CompanyRef>, ref, { upsert: true });
  }

  async createIndexes(): Promise<void> {
    await this.createIndex({ tenantId: 1 }, { unique: true });
  }
}
