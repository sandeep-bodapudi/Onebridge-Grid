import { GlobalRepository, MongoConnectionHandle, TenantContext, TenantScopedRepository } from '@onebridge/shared';
import type { Filter } from 'mongodb';
import type { ActorRef, ActorType } from '../domain/rules.js';
import type { EncryptedText } from '../domain/crypto.js';

export type ConversationKind = 'member_member' | 'member_company' | 'company_company' | 'member_card';

export interface Participant extends ActorRef {
  lastReadAt?: string;
  lastReadMessageId?: string;
  /** Last time this side was connected (for delivered receipts). */
  lastSeenAt?: string;
}

/** N08 conversation. Never holds message text. */
export interface ConversationDoc {
  id: string;
  kind: ConversationKind;
  /** Both actors (sorted) plus the card seat, so a pair has one conversation per route. */
  pairKey: string;
  participants: [Participant, Participant];
  ownership: 'company' | 'members';
  /** The company whose inbox handles it (status, assignment, notes). */
  tenantId?: string;
  /** Encryption key scope: the tenant for company inbox conversations, else per conversation. */
  keyScope: string;
  startedBy: ActorRef;
  requestState: 'none' | 'pending' | 'accepted' | 'ignored';
  requestReceiver?: ActorRef;
  status: 'open' | 'done';
  assignedSeatId?: string;
  viaCardSeatId?: string;
  context?: { kind: string; id: string };
  lastMessageId?: string;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageDoc {
  id: string;
  conversationId: string;
  clientMessageId: string;
  sender: ActorRef;
  /** Company messages: which seat (or person, without a seat) wrote it. Company-only. */
  sentBySeatId?: string;
  body?: EncryptedText;
  replyToMessageId?: string;
  editedAt?: string;
  unsentAt?: string;
  createdAt: string;
}

export interface NoteDoc {
  id: string;
  tenantId: string;
  conversationId: string;
  authorSeatId: string;
  body: EncryptedText;
  createdAt: string;
}

export interface CompanyRef {
  tenantId: string;
  name: string;
  slug?: string;
  industry?: string;
  city?: string;
  logo?: string;
  plan?: string;
  verified: boolean;
  updatedAt: string;
}

export interface SeatRef {
  tenantId: string;
  seatId: string;
  personId?: string;
  title?: string;
  status?: string;
  updatedAt: string;
}

export interface FollowRef {
  followerType: ActorType;
  followerId: string;
  targetType: ActorType;
  targetId: string;
}

function strip<T>(doc: unknown): T {
  const { _id: _i, ...rest } = doc as Record<string, unknown>;
  return rest as T;
}

type F<T> = Filter<T>;

export class MongoConversationRepository extends GlobalRepository<ConversationDoc> {
  constructor(handle: MongoConnectionHandle) {
    super(handle, 'conversations');
  }

  async createIndexes(): Promise<void> {
    await this.collection.createIndex({ id: 1 }, { unique: true });
    await this.collection.createIndex({ pairKey: 1 }, { unique: true });
    await this.collection.createIndex({ 'participants.type': 1, 'participants.id': 1, lastMessageAt: -1 });
    await this.collection.createIndex({ tenantId: 1, assignedSeatId: 1 });
    await this.collection.createIndex({ 'startedBy.type': 1, 'startedBy.id': 1, createdAt: -1 });
  }

  async get(id: string): Promise<ConversationDoc | null> {
    const d = await this.collection.findOne({ id } as F<ConversationDoc>);
    return d ? strip<ConversationDoc>(d) : null;
  }

  async byPair(pairKey: string): Promise<ConversationDoc | null> {
    const d = await this.collection.findOne({ pairKey } as F<ConversationDoc>);
    return d ? strip<ConversationDoc>(d) : null;
  }

  /** Inserts unless the pair already has a conversation (concurrent starts); returns the stored one. */
  async insertOrGet(doc: ConversationDoc): Promise<{ conversation: ConversationDoc; created: boolean }> {
    try {
      await this.collection.insertOne({ ...doc });
      return { conversation: doc, created: true };
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err;
      return { conversation: (await this.byPair(doc.pairKey))!, created: false };
    }
  }

  async set(id: string, fields: Partial<ConversationDoc>, unset: string[] = []): Promise<ConversationDoc | null> {
    const update: Record<string, unknown> = { $set: fields };
    if (unset.length) update.$unset = Object.fromEntries(unset.map((k) => [k, '']));
    const d = await this.collection.findOneAndUpdate({ id } as F<ConversationDoc>, update, { returnDocument: 'after' });
    return d ? strip<ConversationDoc>(d) : null;
  }

  async setParticipant(id: string, actor: ActorRef, fields: Partial<Participant>): Promise<void> {
    const $set = Object.fromEntries(Object.entries(fields).map(([k, v]) => [`participants.$[p].${k}`, v]));
    await this.collection.updateOne({ id } as F<ConversationDoc>, { $set }, { arrayFilters: [{ 'p.type': actor.type, 'p.id': actor.id }] });
  }

  async touchSeen(actor: ActorRef, at: string): Promise<void> {
    await this.collection.updateMany(
      { participants: { $elemMatch: { type: actor.type, id: actor.id } } } as F<ConversationDoc>,
      { $set: { 'participants.$[p].lastSeenAt': at } },
      { arrayFilters: [{ 'p.type': actor.type, 'p.id': actor.id }] }
    );
  }

  /** Newest activity first; `before` is the lastMessageAt|id of the last item shown. */
  async list(filter: Record<string, unknown>, limit: number, before?: string): Promise<ConversationDoc[]> {
    const q: Record<string, unknown> = { ...filter };
    if (before) {
      const [at, id] = before.split('|');
      q.$and = [...((q.$and as unknown[]) ?? []), { $or: [{ lastMessageAt: { $lt: at } }, { lastMessageAt: at, id: { $lt: id } }] }];
    }
    const docs = await this.collection.find(q as F<ConversationDoc>).sort({ lastMessageAt: -1, id: -1 }).limit(limit).toArray();
    return docs.map((d) => strip<ConversationDoc>(d));
  }

  async countStartedSince(actor: ActorRef, sinceIso: string, requestsOnly: boolean): Promise<number> {
    const q: Record<string, unknown> = { 'startedBy.type': actor.type, 'startedBy.id': actor.id, createdAt: { $gte: sinceIso } };
    if (requestsOnly) q.requestReceiver = { $exists: true };
    return this.collection.countDocuments(q as F<ConversationDoc>);
  }

  /** Offboarding (F16): conversations on a seat that is no longer active go back to the unassigned queue. */
  async unassignSeat(tenantId: string, seatId: string): Promise<number> {
    const res = await this.collection.updateMany({ tenantId, assignedSeatId: seatId } as F<ConversationDoc>, { $unset: { assignedSeatId: '' } });
    return res.modifiedCount;
  }
}

export class MongoMessageRepository extends GlobalRepository<MessageDoc> {
  constructor(handle: MongoConnectionHandle) {
    super(handle, 'messages');
  }

  async createIndexes(): Promise<void> {
    await this.collection.createIndex({ id: 1 }, { unique: true });
    await this.collection.createIndex({ conversationId: 1, 'sender.id': 1, clientMessageId: 1 }, { unique: true });
    await this.collection.createIndex({ conversationId: 1, createdAt: -1 });
  }

  async get(id: string): Promise<MessageDoc | null> {
    const d = await this.collection.findOne({ id } as F<MessageDoc>);
    return d ? strip<MessageDoc>(d) : null;
  }

  async getMany(ids: string[]): Promise<MessageDoc[]> {
    if (!ids.length) return [];
    return (await this.collection.find({ id: { $in: ids } } as F<MessageDoc>).toArray()).map((d) => strip<MessageDoc>(d));
  }

  /** Inserts unless the same clientMessageId was already stored (retries never duplicate). */
  async insertOrGet(doc: MessageDoc): Promise<{ message: MessageDoc; created: boolean }> {
    try {
      await this.collection.insertOne({ ...doc });
      return { message: doc, created: true };
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err;
      const d = await this.collection.findOne({ conversationId: doc.conversationId, 'sender.id': doc.sender.id, clientMessageId: doc.clientMessageId } as F<MessageDoc>);
      return { message: strip<MessageDoc>(d), created: false };
    }
  }

  async set(id: string, fields: Partial<MessageDoc>, unset: string[] = []): Promise<MessageDoc | null> {
    const update: Record<string, unknown> = { $set: fields };
    if (unset.length) update.$unset = Object.fromEntries(unset.map((k) => [k, '']));
    const d = await this.collection.findOneAndUpdate({ id } as F<MessageDoc>, update, { returnDocument: 'after' });
    return d ? strip<MessageDoc>(d) : null;
  }

  /** Newest first; `before` is the createdAt|id of the last message shown. */
  async page(conversationId: string, limit: number, before?: string): Promise<MessageDoc[]> {
    const q: Record<string, unknown> = { conversationId };
    if (before) {
      const [at, id] = before.split('|');
      q.$or = [{ createdAt: { $lt: at } }, { createdAt: at, id: { $lt: id } }];
    }
    const docs = await this.collection.find(q as F<MessageDoc>).sort({ createdAt: -1, id: -1 }).limit(limit).toArray();
    return docs.map((d) => strip<MessageDoc>(d));
  }

  async countBy(conversationId: string, sender: ActorRef): Promise<number> {
    return this.collection.countDocuments({ conversationId, 'sender.type': sender.type, 'sender.id': sender.id } as F<MessageDoc>);
  }

  /** Messages from the other side after `afterIso` (unread count). */
  async countUnread(conversationId: string, viewer: ActorRef, afterIso?: string): Promise<number> {
    const q: Record<string, unknown> = { conversationId, unsentAt: { $exists: false }, $nor: [{ 'sender.type': viewer.type, 'sender.id': viewer.id }] };
    if (afterIso) q.createdAt = { $gt: afterIso };
    return this.collection.countDocuments(q as F<MessageDoc>);
  }
}

type NoteBase = TenantScopedRepository<NoteDoc & Record<string, unknown>>;

/** Tenant-scoped: notes are company data. Callers run inside TenantContext.run(tenantId). */
export class MongoNoteRepository extends TenantScopedRepository<NoteDoc & Record<string, unknown>> {
  constructor(handle: MongoConnectionHandle) {
    super(handle, 'conversation_notes');
  }

  async add(note: NoteDoc): Promise<void> {
    await TenantContext.run(note.tenantId, () => this.insertOne(note as unknown as Parameters<NoteBase['insertOne']>[0]));
  }

  async list(tenantId: string, conversationId: string): Promise<NoteDoc[]> {
    const docs = await TenantContext.run(tenantId, () =>
      this.find({ conversationId } as unknown as Parameters<NoteBase['find']>[0], { sort: { createdAt: 1 } })
    );
    return docs.map((d) => strip<NoteDoc>(d));
  }
}

export class MongoCompanyRefRepository extends GlobalRepository<CompanyRef> {
  constructor(handle: MongoConnectionHandle) {
    super(handle, 'messaging_company_refs');
  }

  async createIndexes(): Promise<void> {
    await this.collection.createIndex({ tenantId: 1 }, { unique: true });
  }

  async get(tenantId: string): Promise<CompanyRef | null> {
    const d = await this.collection.findOne({ tenantId } as F<CompanyRef>);
    return d ? strip<CompanyRef>(d) : null;
  }

  async getMany(ids: string[]): Promise<CompanyRef[]> {
    if (!ids.length) return [];
    return (await this.collection.find({ tenantId: { $in: ids } } as F<CompanyRef>).toArray()).map((d) => strip<CompanyRef>(d));
  }

  async upsert(ref: CompanyRef): Promise<void> {
    await this.collection.updateOne({ tenantId: ref.tenantId } as F<CompanyRef>, { $set: ref }, { upsert: true });
  }
}

export class MongoSeatRefRepository extends GlobalRepository<SeatRef> {
  constructor(handle: MongoConnectionHandle) {
    super(handle, 'messaging_seat_refs');
  }

  async createIndexes(): Promise<void> {
    await this.collection.createIndex({ tenantId: 1, seatId: 1 }, { unique: true });
    await this.collection.createIndex({ tenantId: 1, personId: 1 });
  }

  async get(tenantId: string, seatId: string): Promise<SeatRef | null> {
    const d = await this.collection.findOne({ tenantId, seatId } as F<SeatRef>);
    return d ? strip<SeatRef>(d) : null;
  }

  /** Active seats a person holds in a company. */
  async heldBy(tenantId: string, personId: string): Promise<SeatRef[]> {
    return (await this.collection.find({ tenantId, personId, status: 'active' } as F<SeatRef>).toArray()).map((d) => strip<SeatRef>(d));
  }

  async patch(tenantId: string, seatId: string, fields: Partial<SeatRef>): Promise<void> {
    await this.collection.updateOne({ tenantId, seatId } as F<SeatRef>, { $set: { ...fields, tenantId, seatId } }, { upsert: true });
  }
}

export class MongoFollowRefRepository extends GlobalRepository<FollowRef> {
  constructor(handle: MongoConnectionHandle) {
    super(handle, 'messaging_follow_refs');
  }

  async createIndexes(): Promise<void> {
    await this.collection.createIndex({ followerType: 1, followerId: 1, targetType: 1, targetId: 1 }, { unique: true });
  }

  async add(ref: FollowRef): Promise<void> {
    await this.collection.updateOne(ref as F<FollowRef>, { $setOnInsert: ref }, { upsert: true });
  }

  async remove(ref: FollowRef): Promise<void> {
    await this.collection.deleteOne(ref as F<FollowRef>);
  }

  async follows(follower: ActorRef, target: ActorRef): Promise<boolean> {
    return Boolean(
      await this.collection.findOne({ followerType: follower.type, followerId: follower.id, targetType: target.type, targetId: target.id } as F<FollowRef>)
    );
  }
}
