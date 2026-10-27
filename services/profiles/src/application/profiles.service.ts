import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ulid } from 'ulid';
import type { EventBus } from '@onebridge/shared';
import type { MyProfile, PublicMemberProfile, WorkHistoryEntry } from '@onebridge/api-contracts';
import {
  MEMBER_NOTICE_VERSION,
  MemberProfileProps,
  ProfileUpdateInput,
  ProfileValidationError,
  WorkHistoryInput,
  WorkHistoryProps,
  completeness,
  handleFromName,
  sortWorkHistory,
  validateProfileUpdate,
  validateWorkHistory,
} from '../domain/member-profile.js';
import {
  MongoMemberProfileRepository,
  MongoOrgRefRepository,
  MongoSeatRefRepository,
  MongoWorkHistoryRepository,
} from '../infrastructure/repositories.js';

const problem = (status: number, title: string, detail: string, code?: string) => ({
  type: 'https://tools.ietf.org/html/rfc7807',
  title,
  status,
  detail,
  ...(code ? { code } : {}),
});

function rethrow(err: unknown): never {
  if (err instanceof ProfileValidationError) {
    if (err.code === 'handle_taken') throw new ConflictException(problem(409, 'Conflict', err.message, 'handle_taken'));
    throw new BadRequestException(problem(400, 'Bad Request', err.message, err.code));
  }
  throw err;
}

/** Outcome of looking up a public profile: the profile, a redirect for an old handle, or nothing. */
export type PublicLookup = { kind: 'profile'; profile: PublicMemberProfile } | { kind: 'redirect'; handle: string } | { kind: 'none' };

/**
 * N01: member profiles and work history. Verified roles come only from
 * claimed seats (seat.assigned) and cannot be edited by the member.
 */
export class ProfilesService {
  constructor(
    private readonly profiles: MongoMemberProfileRepository,
    private readonly work: MongoWorkHistoryRepository,
    private readonly orgRefs: MongoOrgRefRepository,
    private readonly seatRefs: MongoSeatRefRepository,
    private readonly eventBus: EventBus,
    private readonly now: () => Date = () => new Date()
  ) {}

  private async publish(type: string, payload: Record<string, unknown>): Promise<void> {
    await this.eventBus.publish({
      eventId: ulid(),
      type,
      version: '1.0.0',
      tenantId: 'global',
      occurredAt: this.now().toISOString(),
      correlationId: ulid(),
      aggregateVersion: 1,
      payload,
    });
  }

  private async toEntry(entry: WorkHistoryProps): Promise<WorkHistoryEntry> {
    const org = entry.tenantId ? await this.orgRefs.get(entry.tenantId) : null;
    return {
      id: entry.id,
      source: entry.source,
      verified: entry.source === 'seat',
      companySlug: org?.slug,
      // Verified entries follow the company's current name; self-added ones show what the member typed.
      companyName: entry.source === 'seat' && org ? org.name : entry.companyName,
      title: entry.title,
      startDate: entry.startDate,
      endDate: entry.endDate,
      hidden: entry.hidden,
    };
  }

  private async history(personId: string, includeHidden: boolean): Promise<WorkHistoryEntry[]> {
    const entries = sortWorkHistory(await this.work.listForPerson(personId)).filter((e) => includeHidden || !e.hidden);
    return Promise.all(entries.map((e) => this.toEntry(e)));
  }

  private async toMine(profile: MemberProfileProps): Promise<MyProfile> {
    return {
      personId: profile.personId,
      handle: profile.handle,
      name: profile.name,
      headline: profile.headline,
      photoUrl: profile.photoUrl,
      coverUrl: profile.coverUrl,
      city: profile.city,
      about: profile.about,
      skills: profile.skills,
      languages: profile.languages,
      visibility: profile.visibility,
      indexable: profile.indexable,
      workHistory: await this.history(profile.personId, true),
      completeness: completeness(profile),
    };
  }

  /** GET /me/profile. 404 (code profile_missing) until the member has created one. */
  async getMine(personId: string): Promise<MyProfile> {
    const profile = await this.profiles.findByPersonId(personId);
    if (!profile) throw new NotFoundException(problem(404, 'Not Found', 'You have not created a profile yet.', 'profile_missing'));
    return this.toMine(profile);
  }

  private async freeHandle(base: string, personId: string): Promise<string> {
    if (await this.profiles.isHandleFree(base, personId)) return base;
    for (let i = 2; i < 50; i++) {
      const candidate = `${base.slice(0, 36)}-${i}`;
      if (await this.profiles.isHandleFree(candidate, personId)) return candidate;
    }
    return `${base.slice(0, 30)}-${ulid().slice(-6).toLowerCase()}`;
  }

  /** PUT /me/profile: creates the profile on first save (age and notice required), then updates it. */
  async saveMine(personId: string, input: ProfileUpdateInput): Promise<MyProfile> {
    let changes: Partial<MemberProfileProps>;
    try {
      changes = validateProfileUpdate(input);
    } catch (err) {
      rethrow(err);
    }
    const existing = await this.profiles.findByPersonId(personId);
    const now = this.now().toISOString();

    if (!existing) {
      if (input.ageConfirmed !== true) {
        throw new BadRequestException(problem(400, 'Bad Request', 'You must be 18 or older to join OneBridge Grid.', 'age_required'));
      }
      if (input.noticeVersion !== MEMBER_NOTICE_VERSION) {
        throw new BadRequestException(problem(400, 'Bad Request', 'Accept the member privacy notice to continue.', 'notice_required'));
      }
      if (!changes.name) throw new BadRequestException(problem(400, 'Bad Request', 'Enter your name.', 'invalid'));
      const handle = changes.handle
        ? changes.handle
        : await this.freeHandle(handleFromName(changes.name), personId);
      if (changes.handle && !(await this.profiles.isHandleFree(handle, personId))) {
        throw new ConflictException(problem(409, 'Conflict', 'That profile address is taken. Try another.', 'handle_taken'));
      }
      const created: MemberProfileProps = {
        personId,
        handle,
        previousHandles: [],
        name: changes.name,
        headline: changes.headline,
        photoUrl: changes.photoUrl,
        coverUrl: changes.coverUrl,
        city: changes.city,
        about: changes.about,
        skills: changes.skills ?? [],
        languages: changes.languages ?? [],
        visibility: changes.visibility ?? 'members',
        indexable: changes.indexable ?? false,
        ageConfirmedAt: now,
        consents: [{ type: 'member_notice', version: MEMBER_NOTICE_VERSION, acceptedAt: now }],
        createdAt: now,
        updatedAt: now,
      };
      await this.profiles.save(created);
      await this.publish('member.registered', { personId });
      return this.toMine(created);
    }

    const updated: MemberProfileProps = { ...existing, ...changes, updatedAt: now };
    if (changes.handle && changes.handle !== existing.handle) {
      if (!(await this.profiles.isHandleFree(changes.handle, personId))) {
        throw new ConflictException(problem(409, 'Conflict', 'That profile address is taken. Try another.', 'handle_taken'));
      }
      // The old address keeps redirecting to the new one.
      updated.previousHandles = Array.from(new Set([...existing.previousHandles, existing.handle])).filter((h) => h !== changes.handle);
    }
    await this.profiles.save(updated);
    const changedFields = Object.keys(changes).filter(
      (k) => JSON.stringify((existing as unknown as Record<string, unknown>)[k]) !== JSON.stringify((changes as Record<string, unknown>)[k])
    );
    if (changedFields.length) await this.publish('member.profile_updated', { personId, changedFields });
    return this.toMine(updated);
  }

  private async requireProfile(personId: string): Promise<MemberProfileProps> {
    const profile = await this.profiles.findByPersonId(personId);
    if (!profile) throw new NotFoundException(problem(404, 'Not Found', 'Create your profile first.', 'profile_missing'));
    return profile;
  }

  /** POST /me/work-history: a self-reported role, labelled "Not verified". */
  async addWork(personId: string, input: WorkHistoryInput): Promise<WorkHistoryEntry> {
    await this.requireProfile(personId);
    let fields: Partial<WorkHistoryProps>;
    try {
      fields = validateWorkHistory(input);
    } catch (err) {
      rethrow(err);
    }
    const now = this.now().toISOString();
    const entry: WorkHistoryProps = {
      id: ulid(),
      personId,
      source: 'self',
      companyName: fields.companyName!,
      title: fields.title!,
      startDate: fields.startDate!,
      endDate: fields.endDate,
      hidden: fields.hidden ?? false,
      createdAt: now,
      updatedAt: now,
    };
    await this.work.save(entry);
    await this.publish('member.work_history_changed', { personId, entryId: entry.id, source: 'self' });
    return this.toEntry(entry);
  }

  private async ownEntry(personId: string, entryId: string): Promise<WorkHistoryProps> {
    const entry = await this.work.findById(entryId);
    if (!entry || entry.personId !== personId) throw new NotFoundException(problem(404, 'Not Found', 'That role is not on your profile.'));
    return entry;
  }

  /** PATCH /me/work-history/{id}: verified roles can only be hidden or shown. */
  async patchWork(personId: string, entryId: string, input: WorkHistoryInput): Promise<WorkHistoryEntry> {
    const entry = await this.ownEntry(personId, entryId);
    let fields: Partial<WorkHistoryProps>;
    try {
      fields = validateWorkHistory(input, true);
    } catch (err) {
      rethrow(err);
    }
    if (entry.source === 'seat') {
      const editsVerified = (['companyName', 'title', 'startDate', 'endDate'] as const).some((k) => input[k] !== undefined);
      if (editsVerified) {
        throw new ForbiddenException(
          problem(403, 'Forbidden', 'Verified roles come from your company and cannot be edited. You can hide them.', 'verified_entry')
        );
      }
    }
    const updated: WorkHistoryProps = { ...entry, ...fields, updatedAt: this.now().toISOString() };
    if (fields.startDate && !fields.endDate && entry.endDate && entry.endDate < fields.startDate) {
      throw new BadRequestException(problem(400, 'Bad Request', 'The end date is before the start date.'));
    }
    await this.work.save(updated);
    await this.publish('member.work_history_changed', { personId, entryId, source: entry.source });
    return this.toEntry(updated);
  }

  /** DELETE /me/work-history/{id}: self-reported roles only. */
  async deleteWork(personId: string, entryId: string): Promise<void> {
    const entry = await this.ownEntry(personId, entryId);
    if (entry.source === 'seat') {
      throw new ForbiddenException(problem(403, 'Forbidden', 'Verified roles cannot be deleted. You can hide them.', 'verified_entry'));
    }
    await this.work.remove(entryId);
    await this.publish('member.work_history_changed', { personId, entryId, source: 'self' });
  }

  /**
   * GET /members/{handle}. Members-only profiles are invisible to signed-out
   * viewers, and that looks exactly like "not found" (no leak).
   */
  async getPublic(handleParam: string, viewerPersonId?: string): Promise<PublicLookup> {
    const handle = String(handleParam || '').toLowerCase();
    const profile = await this.profiles.findByHandle(handle);
    if (!profile) {
      const moved = await this.profiles.findByPreviousHandle(handle);
      return moved ? { kind: 'redirect', handle: moved.handle } : { kind: 'none' };
    }
    if (profile.visibility === 'members' && !viewerPersonId) return { kind: 'none' };
    return {
      kind: 'profile',
      profile: {
        personId: profile.personId,
        handle: profile.handle,
        name: profile.name,
        headline: profile.headline,
        photoUrl: profile.photoUrl,
        coverUrl: profile.coverUrl,
        city: profile.city,
        about: profile.about,
        skills: profile.skills,
        languages: profile.languages,
        indexable: profile.indexable && profile.visibility === 'everyone',
        workHistory: await this.history(profile.personId, false),
        viewer: {
          // N04, N08, N11 and N09 fill these in; until then nothing is offered.
          following: false,
          canMessage: false,
          canRequestCall: false,
          blocked: false,
        },
      },
    };
  }

  /**
   * Internal (service key): public summaries of members, for lists in other
   * services (followers, conversations). Never contact details.
   */
  async summaries(personIds: string[]) {
    const unique = Array.from(new Set(personIds.filter((id) => typeof id === 'string' && id))).slice(0, 200);
    const found = await Promise.all(unique.map((id) => this.profiles.findByPersonId(id)));
    return found
      .filter((p): p is MemberProfileProps => Boolean(p))
      .map((p) => ({
        personId: p.personId,
        handle: p.handle,
        name: p.name,
        headline: p.headline,
        photoUrl: p.photoUrl,
        visibility: p.visibility,
        // N03 search: public profile text only.
        city: p.city,
        about: p.about,
        skills: p.skills,
      }));
  }

  // ------------------------------------------------------------------
  // Event handlers (ADR-0003). Idempotent: events are at-least-once.
  // ------------------------------------------------------------------

  async onOrgEvent(event: { tenantId: string; occurredAt: string; payload: Record<string, unknown> }): Promise<void> {
    const p = event.payload;
    const updated = (p.updatedFields ?? {}) as Record<string, unknown>;
    const tenantId = (p.orgId as string) || event.tenantId;
    const existing = await this.orgRefs.get(tenantId);
    const name = (updated.name as string) ?? (p.name as string) ?? existing?.name;
    if (!name) return;
    await this.orgRefs.upsert({
      tenantId,
      name,
      slug: (updated.slug as string) ?? (p.slug as string) ?? existing?.slug,
      updatedAt: event.occurredAt,
    });
  }

  async onSeatCreatedOrUpdated(event: { tenantId: string; occurredAt: string; payload: Record<string, unknown> }): Promise<void> {
    const p = event.payload;
    const seatId = p.seatId as string;
    if (!seatId) return;
    const existing = await this.seatRefs.get(seatId);
    const updated = (p.updatedFields ?? {}) as Record<string, unknown>;
    const title = (updated.title as string) ?? (p.title as string) ?? existing?.title ?? '';
    await this.seatRefs.upsert({
      seatId,
      tenantId: (p.orgId as string) || event.tenantId,
      title,
      personId: (p.personId as string) ?? existing?.personId,
      updatedAt: event.occurredAt,
    });
    // A changed seat title updates the open verified role too.
    if (existing && title && title !== existing.title) {
      for (const entry of await this.work.listOpenForSeat(seatId)) {
        await this.work.save({ ...entry, title, updatedAt: event.occurredAt });
      }
    }
    // A seat created with its person already on it (for example the owner's own seat) starts a verified role.
    if (!existing && p.personId && (p.status === undefined || p.status === 'active')) {
      await this.onSeatAssigned({ ...event, payload: { orgId: p.orgId, seatId, personId: p.personId } });
    }
  }

  /** seat.assigned: the person now holds the seat, so a verified role starts (and the previous holder's ends). */
  async onSeatAssigned(event: { tenantId: string; occurredAt: string; payload: Record<string, unknown> }): Promise<void> {
    const p = event.payload;
    const seatId = p.seatId as string;
    const personId = p.personId as string;
    const tenantId = (p.orgId as string) || event.tenantId;
    if (!seatId || !personId) return;
    const day = event.occurredAt.slice(0, 10);

    for (const open of await this.work.listOpenForSeat(seatId)) {
      if (open.personId !== personId) {
        await this.work.save({ ...open, endDate: day, updatedAt: event.occurredAt });
        await this.publish('member.work_history_changed', { personId: open.personId, entryId: open.id, source: 'seat' });
      }
    }
    const seat = await this.seatRefs.get(seatId);
    await this.seatRefs.upsert({ seatId, tenantId, title: seat?.title ?? '', personId, updatedAt: event.occurredAt });
    if (await this.work.findOpenSeatEntry(personId, seatId)) return; // already recorded (redelivery)
    const org = await this.orgRefs.get(tenantId);
    const entry: WorkHistoryProps = {
      id: ulid(),
      personId,
      source: 'seat',
      tenantId,
      seatId,
      companyName: org?.name ?? 'Company',
      title: seat?.title ?? '',
      startDate: day,
      hidden: false,
      createdAt: event.occurredAt,
      updatedAt: event.occurredAt,
    };
    await this.work.save(entry);
    await this.publish('member.work_history_changed', { personId, entryId: entry.id, source: 'seat' });
  }

  /** seat.status_changed to offboarded or vacant: the holder's verified role ends. */
  async onSeatStatusChanged(event: { tenantId: string; occurredAt: string; payload: Record<string, unknown> }): Promise<void> {
    const p = event.payload;
    const seatId = p.seatId as string;
    const status = p.newStatus as string;
    if (!seatId || !['offboarded', 'vacant'].includes(status)) return;
    const day = event.occurredAt.slice(0, 10);
    for (const open of await this.work.listOpenForSeat(seatId)) {
      await this.work.save({ ...open, endDate: day, updatedAt: event.occurredAt });
      await this.publish('member.work_history_changed', { personId: open.personId, entryId: open.id, source: 'seat' });
    }
  }
}
