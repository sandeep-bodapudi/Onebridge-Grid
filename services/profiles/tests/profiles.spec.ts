import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectMongo, MongoConnectionHandle, FakeEventBus } from '@onebridge/shared';
import {
  ProfilesService,
  MongoMemberProfileRepository,
  MongoWorkHistoryRepository,
  MongoOrgRefRepository,
  MongoSeatRefRepository,
  MEMBER_NOTICE_VERSION,
  validateProfileUpdate,
  normaliseHandle,
  handleFromName,
  completeness,
} from '../src/index.js';

const TENANT = '01JACTENANTA00000000000000';
const OTHER = '01JACTENANTB00000000000000';
const evt = (type: string, payload: Record<string, unknown>, occurredAt = '2026-10-26T10:00:00.000Z', tenantId = TENANT) => ({
  eventId: `e-${Math.random()}`,
  type,
  version: '1.0.0',
  tenantId,
  occurredAt,
  correlationId: 'c',
  aggregateVersion: 1,
  payload,
});

describe('N01 profile rules', () => {
  it('validates handles and builds one from a name', () => {
    expect(normaliseHandle('Meera-Iyer')).toBe('meera-iyer');
    expect(() => normaliseHandle('ab')).toThrow(/3 to 40/);
    expect(() => normaliseHandle('admin')).toThrow(/reserved/);
    expect(handleFromName('Meera Iyer')).toBe('meera-iyer');
    expect(handleFromName('Jo')).toBe('member-jo');
  });

  it('limits fields, de-duplicates skills and needs https images', () => {
    expect(validateProfileUpdate({ skills: ['Sales', 'sales', 'TMT bars'] }).skills).toEqual(['Sales', 'TMT bars']);
    expect(() => validateProfileUpdate({ headline: 'x'.repeat(121) })).toThrow(/120/);
    expect(() => validateProfileUpdate({ skills: Array.from({ length: 31 }, (_, i) => `s${i}`) })).toThrow(/30/);
    expect(() => validateProfileUpdate({ photoUrl: 'http://x.test/a.png' })).toThrow(/https/);
    expect(() => validateProfileUpdate({ name: '  ' })).toThrow(/name/);
  });

  it('reports completeness', () => {
    expect(completeness({ skills: [], headline: 'Sales' } as never)).toEqual({ done: 1, missing: ['photo', 'city', 'about', 'skill'] });
  });
});

describe('N01 ProfilesService', () => {
  let mongod: MongoMemoryServer;
  let handle: MongoConnectionHandle;
  let service: ProfilesService;
  let bus: FakeEventBus;
  const published = () => bus.calls.map((c) => (c.args as { event: { type: string; payload: Record<string, unknown> } }).event);

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    handle = await connectMongo(mongod.getUri());
  }, 120000);

  afterAll(async () => {
    if (handle) await handle.close();
    if (mongod) await mongod.stop();
  });

  beforeEach(async () => {
    const db = handle._getInternalDb();
    await Promise.all(['member_profiles', 'work_history', 'profile_org_refs', 'profile_seat_refs'].map((c) => db.collection(c).deleteMany({})));
    bus = new FakeEventBus();
    const profiles = new MongoMemberProfileRepository(handle);
    await profiles.createIndexes();
    service = new ProfilesService(
      profiles,
      new MongoWorkHistoryRepository(handle),
      new MongoOrgRefRepository(handle),
      new MongoSeatRefRepository(handle),
      bus,
      () => new Date('2026-10-26T10:00:00.000Z')
    );
  });

  const join = (personId: string, name: string, extra: Record<string, unknown> = {}) =>
    service.saveMine(personId, { name, ageConfirmed: true, noticeVersion: MEMBER_NOTICE_VERSION, ...extra });

  it('needs age confirmation and the current notice on first save, and records the consent', async () => {
    await expect(service.saveMine('p1', { name: 'Meera Iyer', noticeVersion: MEMBER_NOTICE_VERSION })).rejects.toMatchObject({ response: { code: 'age_required' } });
    await expect(service.saveMine('p1', { name: 'Meera Iyer', ageConfirmed: true, noticeVersion: 'old' })).rejects.toMatchObject({ response: { code: 'notice_required' } });
    const me = await join('p1', 'Meera Iyer');
    expect(me.handle).toBe('meera-iyer');
    expect(me.visibility).toBe('members');
    expect(me.indexable).toBe(false); // search engines off by default for individuals
    const stored = await handle._getInternalDb().collection('member_profiles').findOne({ personId: 'p1' });
    expect(stored?.consents).toEqual([{ type: 'member_notice', version: MEMBER_NOTICE_VERSION, acceptedAt: '2026-10-26T10:00:00.000Z' }]);
    expect(published().map((e) => e.type)).toContain('member.registered');
  });

  it('gives a free handle when the name is taken, and refuses a taken handle', async () => {
    await join('p1', 'Meera Iyer');
    expect((await join('p2', 'Meera Iyer')).handle).toBe('meera-iyer-2');
    await expect(service.saveMine('p2', { handle: 'meera-iyer' })).rejects.toMatchObject({ status: 409, response: { code: 'handle_taken' } });
  });

  it('keeps an old handle redirecting after a change, and nobody else can take it', async () => {
    await join('p1', 'Meera Iyer', { visibility: 'everyone' });
    await service.saveMine('p1', { handle: 'meera-builds' });
    expect(await service.getPublic('meera-iyer')).toEqual({ kind: 'redirect', handle: 'meera-builds' });
    await join('p2', 'Someone Else');
    await expect(service.saveMine('p2', { handle: 'meera-iyer' })).rejects.toMatchObject({ status: 409 });
  });

  it('never exposes contact details and hides members-only profiles from signed-out viewers', async () => {
    await join('p1', 'Meera Iyer', { headline: 'Sales executive', city: 'Hyderabad' });
    expect(await service.getPublic('meera-iyer')).toEqual({ kind: 'none' });
    const asMember = await service.getPublic('meera-iyer', 'p9');
    expect(asMember.kind).toBe('profile');
    const body = JSON.stringify(asMember);
    expect(body).not.toMatch(/phone|email|\+91/i);
    await service.saveMine('p1', { visibility: 'everyone', indexable: true });
    const anon = await service.getPublic('meera-iyer');
    expect(anon.kind === 'profile' && anon.profile.indexable).toBe(true);
  });

  it('adds a verified role when a seat is claimed, ends it on offboarding, and the member cannot edit it', async () => {
    await join('p1', 'Meera Iyer');
    await service.onOrgEvent(evt('org.created', { orgId: TENANT, name: 'Sahyadri Steel Works', slug: 'sahyadri-steel-works' }));
    await service.onSeatCreatedOrUpdated(evt('seat.created', { orgId: TENANT, seatId: 'S1', title: 'Sales executive' }));
    await service.onSeatAssigned(evt('seat.assigned', { orgId: TENANT, seatId: 'S1', personId: 'p1' }, '2026-03-01T09:00:00.000Z'));
    // Redelivery does not duplicate.
    await service.onSeatAssigned(evt('seat.assigned', { orgId: TENANT, seatId: 'S1', personId: 'p1' }, '2026-03-01T09:00:00.000Z'));

    let me = await service.getMine('p1');
    expect(me.workHistory).toHaveLength(1);
    expect(me.workHistory[0]).toMatchObject({ verified: true, companyName: 'Sahyadri Steel Works', companySlug: 'sahyadri-steel-works', title: 'Sales executive', startDate: '2026-03-01' });

    const entryId = me.workHistory[0].id;
    await expect(service.patchWork('p1', entryId, { title: 'CEO' })).rejects.toMatchObject({ response: { code: 'verified_entry' } });
    await expect(service.deleteWork('p1', entryId)).rejects.toMatchObject({ response: { code: 'verified_entry' } });
    expect((await service.patchWork('p1', entryId, { hidden: true })).hidden).toBe(true);
    const publicView = await service.getPublic(me.handle, 'p9');
    expect(publicView.kind === 'profile' && publicView.profile.workHistory).toHaveLength(0); // hidden entries are omitted

    await service.onSeatStatusChanged(evt('seat.status_changed', { orgId: TENANT, seatId: 'S1', newStatus: 'offboarded' }, '2026-09-30T18:00:00.000Z'));
    me = await service.getMine('p1');
    expect(me.workHistory[0].endDate).toBe('2026-09-30');
  });

  it('ends the previous holder\'s role when the seat goes to someone else', async () => {
    await service.onOrgEvent(evt('org.created', { orgId: TENANT, name: 'Acme', slug: 'acme' }));
    await service.onSeatCreatedOrUpdated(evt('seat.created', { orgId: TENANT, seatId: 'S1', title: 'Sales' }));
    await service.onSeatAssigned(evt('seat.assigned', { orgId: TENANT, seatId: 'S1', personId: 'p1' }, '2026-01-01T00:00:00.000Z'));
    await service.onSeatAssigned(evt('seat.assigned', { orgId: TENANT, seatId: 'S1', personId: 'p2' }, '2026-06-01T00:00:00.000Z'));
    await join('p1', 'Old Holder');
    expect((await service.getMine('p1')).workHistory[0].endDate).toBe('2026-06-01');
  });

  it('follows company renames and seat title changes on verified roles', async () => {
    await join('p1', 'Meera Iyer');
    await service.onOrgEvent(evt('org.created', { orgId: TENANT, name: 'Old Name', slug: 'old' }));
    await service.onSeatCreatedOrUpdated(evt('seat.created', { orgId: TENANT, seatId: 'S1', title: 'Sales' }));
    await service.onSeatAssigned(evt('seat.assigned', { orgId: TENANT, seatId: 'S1', personId: 'p1' }));
    await service.onOrgEvent(evt('org.updated', { orgId: TENANT, updatedFields: { name: 'New Name' } }));
    await service.onSeatCreatedOrUpdated(evt('seat.updated', { orgId: TENANT, seatId: 'S1', updatedFields: { title: 'Senior sales' } }));
    expect((await service.getMine('p1')).workHistory[0]).toMatchObject({ companyName: 'New Name', title: 'Senior sales' });
  });

  it('lets members add, edit and delete their own unverified roles', async () => {
    await join('p1', 'Meera Iyer');
    const added = await service.addWork('p1', { companyName: 'Previous Co', title: 'Intern', startDate: '2022-06-01', endDate: '2023-05-31' });
    expect(added).toMatchObject({ verified: false, source: 'self' });
    await expect(service.addWork('p1', { companyName: 'X', title: 'Y', startDate: '2024-01-01', endDate: '2023-01-01' })).rejects.toMatchObject({ status: 400 });
    expect((await service.patchWork('p1', added.id, { title: 'Sales intern' })).title).toBe('Sales intern');
    await expect(service.patchWork('p2', added.id, { title: 'Hijack' })).rejects.toMatchObject({ status: 404 });
    await service.deleteWork('p1', added.id);
    expect((await service.getMine('p1')).workHistory).toHaveLength(0);
  });

  it('keeps one company\'s seats out of another company\'s people', async () => {
    await service.onOrgEvent(evt('org.created', { orgId: TENANT, name: 'A', slug: 'a' }));
    await service.onOrgEvent(evt('org.created', { orgId: OTHER, name: 'B', slug: 'b' }, undefined, OTHER));
    await service.onSeatCreatedOrUpdated(evt('seat.created', { orgId: OTHER, seatId: 'S9', title: 'Manager' }, undefined, OTHER));
    await service.onSeatAssigned(evt('seat.assigned', { orgId: OTHER, seatId: 'S9', personId: 'p1' }, undefined, OTHER));
    await join('p1', 'Meera Iyer');
    expect((await service.getMine('p1')).workHistory[0]).toMatchObject({ companyName: 'B', companySlug: 'b' });
  });

  it('publishes profile changes with field names only', async () => {
    await join('p1', 'Meera Iyer');
    await service.saveMine('p1', { headline: 'Sales lead', city: 'Hyderabad' });
    const updated = published().find((e) => e.type === 'member.profile_updated');
    expect(updated?.payload).toEqual({ personId: 'p1', changedFields: ['headline', 'city'] });
    expect(JSON.stringify(updated)).not.toContain('Sales lead');
  });

  it('starts a verified role for a seat created with its person already on it', async () => {
    await service.onOrgEvent(evt('org.created', { orgId: TENANT, name: 'Sahyadri Steel Works', slug: 'sahyadri-steel-works' }));
    await service.onSeatCreatedOrUpdated(evt('seat.created', { orgId: TENANT, seatId: 'S0', title: 'Founder', personId: 'owner', status: 'active' }));
    await join('owner', 'Priya Kulkarni');
    expect((await service.getMine('owner')).workHistory[0]).toMatchObject({ verified: true, title: 'Founder', companyName: 'Sahyadri Steel Works' });
  });
});
