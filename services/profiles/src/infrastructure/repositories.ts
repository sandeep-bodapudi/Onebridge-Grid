import { GlobalRepository, MongoConnectionHandle } from '@onebridge/shared';
import type { Filter } from 'mongodb';
import { MemberProfileProps, WorkHistoryProps } from '../domain/member-profile.js';

type Doc<T> = T & { _id?: unknown };

function strip<T>(doc: Doc<T> | null): T | null {
  if (!doc) return null;
  const { _id: _ignored, ...rest } = doc as Doc<T> & Record<string, unknown>;
  return rest as unknown as T;
}

/**
 * Member profiles are global: a person's profile belongs to the person, not
 * to a company (N01), so there is no tenant scope.
 */
export class MongoMemberProfileRepository extends GlobalRepository<MemberProfileProps> {
  constructor(handle: MongoConnectionHandle) {
    super(handle, 'member_profiles');
  }

  async findByPersonId(personId: string): Promise<MemberProfileProps | null> {
    return strip(await this.findOne({ personId } as Filter<MemberProfileProps>));
  }

  async findByHandle(handle: string): Promise<MemberProfileProps | null> {
    return strip(await this.findOne({ handle } as Filter<MemberProfileProps>));
  }

  async findByPreviousHandle(handle: string): Promise<MemberProfileProps | null> {
    return strip(await this.findOne({ previousHandles: handle } as Filter<MemberProfileProps>));
  }

  /** A handle is free if no profile uses it now or used it before (old handles keep redirecting). */
  async isHandleFree(handle: string, exceptPersonId?: string): Promise<boolean> {
    const owner = await this.findOne({ $or: [{ handle }, { previousHandles: handle }] } as Filter<MemberProfileProps>);
    return !owner || owner.personId === exceptPersonId;
  }

  async save(profile: MemberProfileProps): Promise<MemberProfileProps> {
    await this.collection.replaceOne({ personId: profile.personId } as Filter<MemberProfileProps>, profile, { upsert: true });
    return profile;
  }

  async createIndexes(): Promise<void> {
    await this.createIndex({ personId: 1 }, { unique: true });
    await this.createIndex({ handle: 1 }, { unique: true });
    await this.createIndex({ previousHandles: 1 });
  }
}

export class MongoWorkHistoryRepository extends GlobalRepository<WorkHistoryProps> {
  constructor(handle: MongoConnectionHandle) {
    super(handle, 'work_history');
  }

  async listForPerson(personId: string): Promise<WorkHistoryProps[]> {
    return (await this.find({ personId } as Filter<WorkHistoryProps>)).map((d) => strip(d as Doc<WorkHistoryProps>)!);
  }

  async findById(id: string): Promise<WorkHistoryProps | null> {
    return strip(await this.findOne({ id } as Filter<WorkHistoryProps>));
  }

  /** The open (no end date) verified entry for a seat held by a person. */
  async findOpenSeatEntry(personId: string, seatId: string): Promise<WorkHistoryProps | null> {
    return strip(await this.findOne({ personId, seatId, source: 'seat', endDate: { $exists: false } } as Filter<WorkHistoryProps>));
  }

  async listOpenForSeat(seatId: string): Promise<WorkHistoryProps[]> {
    return (await this.find({ seatId, source: 'seat', endDate: { $exists: false } } as Filter<WorkHistoryProps>)).map((d) => strip(d as Doc<WorkHistoryProps>)!);
  }

  async listByTenant(tenantId: string): Promise<WorkHistoryProps[]> {
    return (await this.find({ tenantId, source: 'seat' } as Filter<WorkHistoryProps>)).map((d) => strip(d as Doc<WorkHistoryProps>)!);
  }

  async save(entry: WorkHistoryProps): Promise<WorkHistoryProps> {
    const { endDate, ...rest } = entry;
    // Store "no end date" as a missing field so open-entry lookups work.
    await this.collection.replaceOne({ id: entry.id } as Filter<WorkHistoryProps>, endDate ? entry : (rest as WorkHistoryProps), { upsert: true });
    return entry;
  }

  async remove(id: string): Promise<void> {
    await this.deleteOne({ id } as Filter<WorkHistoryProps>);
  }

  async createIndexes(): Promise<void> {
    await this.createIndex({ id: 1 }, { unique: true });
    await this.createIndex({ personId: 1 });
    await this.createIndex({ seatId: 1, source: 1 });
  }
}

/** Company names and slugs for work history, from org.* events (ADR-0003: no reads of another service's data). */
export interface OrgRef {
  tenantId: string;
  name: string;
  slug?: string;
  updatedAt: string;
}

export class MongoOrgRefRepository extends GlobalRepository<OrgRef> {
  constructor(handle: MongoConnectionHandle) {
    super(handle, 'profile_org_refs');
  }

  async get(tenantId: string): Promise<OrgRef | null> {
    return strip(await this.findOne({ tenantId } as Filter<OrgRef>));
  }

  async upsert(ref: OrgRef): Promise<void> {
    await this.collection.replaceOne({ tenantId: ref.tenantId } as Filter<OrgRef>, ref, { upsert: true });
  }

  async createIndexes(): Promise<void> {
    await this.createIndex({ tenantId: 1 }, { unique: true });
  }
}

/** Seat titles and holders, from seat.* events. */
export interface SeatRef {
  seatId: string;
  tenantId: string;
  title: string;
  personId?: string;
  updatedAt: string;
}

export class MongoSeatRefRepository extends GlobalRepository<SeatRef> {
  constructor(handle: MongoConnectionHandle) {
    super(handle, 'profile_seat_refs');
  }

  async get(seatId: string): Promise<SeatRef | null> {
    return strip(await this.findOne({ seatId } as Filter<SeatRef>));
  }

  async upsert(ref: SeatRef): Promise<void> {
    await this.collection.replaceOne({ seatId: ref.seatId } as Filter<SeatRef>, ref, { upsert: true });
  }

  async createIndexes(): Promise<void> {
    await this.createIndex({ seatId: 1 }, { unique: true });
  }
}
