import { TenantScopedRepository, MongoConnectionHandle } from '@onebridge/shared';
import { InviteProps, NoticeAcceptanceProps } from '../domain/invite.js';

type InviteDoc = InviteProps & Record<string, unknown>;
type InviteBase = TenantScopedRepository<InviteDoc>;
type InviteFilter = Parameters<InviteBase['findOne']>[0];

/** F14 invites (tenant-scoped). */
export class MongoInviteRepository extends TenantScopedRepository<InviteDoc> {
  constructor(dbOrHandle: MongoConnectionHandle | unknown) {
    super(dbOrHandle as MongoConnectionHandle, 'invites');
  }

  private strip(doc: (InviteDoc & { _id?: unknown }) | null): InviteProps | null {
    if (!doc) return null;
    const { _id: _ignored, ...rest } = doc;
    return rest as InviteProps;
  }

  async save(invite: InviteProps): Promise<InviteProps> {
    const filter = { id: invite.id } as unknown as InviteFilter;
    const existing = await this.findOne(filter);
    if (existing) {
      await this.replaceOne(filter as unknown as Parameters<InviteBase['replaceOne']>[0], invite as InviteDoc);
    } else {
      await this.insertOne(invite as unknown as Parameters<InviteBase['insertOne']>[0]);
    }
    return invite;
  }

  async findPendingBySeat(seatId: string): Promise<InviteProps | null> {
    return this.strip(await this.findOne({ seatId, status: 'pending' } as unknown as InviteFilter));
  }

  async findLatestBySeat(seatId: string): Promise<InviteProps | null> {
    const docs = await this.collection
      .find({ tenantId: this.getActiveTenantId(), seatId })
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray();
    return this.strip((docs[0] as (InviteDoc & { _id?: unknown }) | undefined) ?? null);
  }

  /** Single use (F14 AC-1): only one caller can move an invite from pending to claimed. */
  async markClaimed(id: string, personId: string, claimedAt: string): Promise<boolean> {
    const result = await this.collection.updateOne(
      { tenantId: this.getActiveTenantId(), id, status: 'pending' },
      { $set: { status: 'claimed', claimedBy: personId, claimedAt } }
    );
    return result.modifiedCount === 1;
  }

  async listPending(): Promise<InviteProps[]> {
    const docs = await this.find({ status: 'pending' } as unknown as InviteFilter);
    return docs.map((d) => this.strip(d)!);
  }

  /**
   * Token lookup happens before the caller's company is known (the link is
   * the only input), so it reads across tenants by the unique token hash.
   * Callers immediately switch into the invite's tenant for every other step.
   */
  async findByTokenHashGlobal(tokenHash: string): Promise<InviteProps | null> {
    return this.strip((await this.collection.findOne({ tokenHash })) as (InviteDoc & { _id?: unknown }) | null);
  }

  async createIndexes(): Promise<void> {
    try {
      await this.collection.createIndex({ tokenHash: 1 }, { unique: true });
      await this.collection.createIndex({ tenantId: 1, seatId: 1, status: 1 });
    } catch {
      // already exists
    }
  }
}

type NoticeDoc = NoticeAcceptanceProps & Record<string, unknown>;

/** F14 AC-2: seat-claim notice acceptances (tenant-scoped, append-only). */
export class MongoNoticeAcceptanceRepository extends TenantScopedRepository<NoticeDoc> {
  constructor(dbOrHandle: MongoConnectionHandle | unknown) {
    super(dbOrHandle as MongoConnectionHandle, 'notice_acceptances');
  }

  async record(acceptance: NoticeAcceptanceProps): Promise<NoticeAcceptanceProps> {
    await this.insertOne(acceptance as unknown as Parameters<TenantScopedRepository<NoticeDoc>['insertOne']>[0]);
    return acceptance;
  }

  async listForSeat(seatId: string): Promise<NoticeAcceptanceProps[]> {
    const docs = await this.find({ seatId } as unknown as Parameters<TenantScopedRepository<NoticeDoc>['find']>[0]);
    return docs.map((d) => {
      const { _id: _ignored, ...rest } = d as NoticeDoc & { _id?: unknown };
      return rest as NoticeAcceptanceProps;
    });
  }
}
