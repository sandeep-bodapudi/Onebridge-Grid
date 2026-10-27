import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectMongo, MongoConnectionHandle, FakeEventBus } from '@onebridge/shared';
import { FollowService, MongoFollowRepository, MongoCompanyRefRepository, ProfilesClient, MemberSummary } from '../src/index.js';

const ACME = '01JACTENANTA00000000000000';
const OTHER = '01JACTENANTB00000000000000';
const evt = (type: string, payload: Record<string, unknown>, tenantId = ACME) => ({ type, tenantId, occurredAt: '2026-10-27T09:00:00.000Z', payload });

const members: MemberSummary[] = [
  { personId: 'p1', handle: 'meera-iyer', name: 'Meera Iyer', headline: 'Sales', visibility: 'everyone' },
  { personId: 'p2', handle: 'ravi-teja', name: 'Ravi Teja', visibility: 'members' },
  { personId: 'p3', handle: 'fatima', name: 'Fatima Begum', visibility: 'members' },
];
const profiles: ProfilesClient = { summaries: async (ids) => members.filter((m) => ids.includes(m.personId)) };

describe('N04 follow', () => {
  let mongod: MongoMemoryServer;
  let handle: MongoConnectionHandle;
  let service: FollowService;
  let bus: FakeEventBus;
  let clock: Date;
  const events = () => bus.calls.map((c) => (c.args as { event: { type: string; payload: Record<string, unknown> } }).event);

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
    await Promise.all(['follows', 'social_company_refs'].map((c) => db.collection(c).deleteMany({})));
    const follows = new MongoFollowRepository(handle);
    await follows.createIndexes();
    const companies = new MongoCompanyRefRepository(handle);
    bus = new FakeEventBus();
    clock = new Date('2026-10-27T09:00:00.000Z');
    service = new FollowService(follows, companies, profiles, bus, 3, () => clock);
    await service.onOrgEvent(evt('org.created', { orgId: ACME, name: 'Sahyadri Steel Works', slug: 'sahyadri-steel-works', industry: 'Manufacturing', city: 'Pune' }));
    await service.onOrgEvent(evt('org.created', { orgId: OTHER, name: 'Charminar Fabricators', slug: 'charminar-fabricators' }, OTHER));
  });

  const me = { type: 'member' as const, id: 'p1' };

  it('follows idempotently, counts once and publishes one event', async () => {
    expect(await service.follow(me, 'company', ACME, 'card_scan')).toEqual({ following: true, followerCount: 1 });
    expect(await service.follow(me, 'company', ACME)).toEqual({ following: true, followerCount: 1 });
    expect(events().filter((e) => e.type === 'follow.created')).toHaveLength(1);
    expect(events()[0].payload).toEqual({ followerType: 'member', followerId: 'p1', targetType: 'company', targetId: ACME, source: 'card_scan' });
    expect(await service.state(me, 'company', ACME)).toEqual({ following: true, followerCount: 1 });
    expect(await service.state(null, 'company', ACME)).toEqual({ following: false, followerCount: 1 });
  });

  it('unfollows idempotently', async () => {
    await service.follow(me, 'member', 'p2');
    expect(await service.unfollow(me, 'member', 'p2')).toEqual({ following: false, followerCount: 0 });
    expect(await service.unfollow(me, 'member', 'p2')).toEqual({ following: false, followerCount: 0 });
    expect(events().filter((e) => e.type === 'follow.removed')).toHaveLength(1);
  });

  it('refuses self-follows, unknown targets and bad types', async () => {
    await expect(service.follow(me, 'member', 'p1')).rejects.toMatchObject({ response: { code: 'self_follow' } });
    await expect(service.follow({ type: 'company', id: ACME }, 'company', ACME)).rejects.toMatchObject({ response: { code: 'self_follow' } });
    await expect(service.follow(me, 'member', 'nobody')).rejects.toMatchObject({ status: 404 });
    await expect(service.follow(me, 'company', 'no-such-company')).rejects.toMatchObject({ status: 404 });
    await expect(service.follow(me, 'group', 'x')).rejects.toMatchObject({ status: 400 });
  });

  it('caps new follows per day and resets the next day', async () => {
    await service.follow(me, 'member', 'p2');
    await service.follow(me, 'member', 'p3');
    await service.follow(me, 'company', ACME);
    await expect(service.follow(me, 'company', OTHER)).rejects.toMatchObject({ status: 429, response: { code: 'rate_limited' } });
    // Re-following something already followed is not a new follow.
    await expect(service.follow(me, 'company', ACME)).resolves.toMatchObject({ following: true });
    clock = new Date('2026-10-28T00:00:01.000Z');
    await expect(service.follow(me, 'company', OTHER)).resolves.toMatchObject({ following: true });
  });

  it('lets a company follow another company', async () => {
    await service.follow({ type: 'company', id: OTHER }, 'company', ACME);
    const page = await service.companyFollowers(ACME, 'owner');
    expect(page.items).toEqual([expect.objectContaining({ type: 'company', id: OTHER, name: 'Charminar Fabricators', handle: 'charminar-fabricators' })]);
  });

  it('shows company followers to the owner and admins only, newest first, without contact details', async () => {
    await service.follow({ type: 'member', id: 'p2' }, 'company', ACME);
    clock = new Date('2026-10-27T10:00:00.000Z');
    await service.follow(me, 'company', ACME);
    await expect(service.companyFollowers(ACME, 'employee')).rejects.toMatchObject({ status: 403 });
    await expect(service.companyFollowers(ACME, undefined)).rejects.toMatchObject({ status: 403 });
    const page = await service.companyFollowers(ACME, 'admin');
    expect(page.total).toBe(2);
    expect(page.items.map((i) => i.name)).toEqual(['Meera Iyer', 'Ravi Teja']);
    expect(JSON.stringify(page)).not.toMatch(/phone|email|\+91/i);
  });

  it('lists who I follow, with company summaries from org events', async () => {
    await service.onOrgEvent(evt('kyb.status_changed', { orgId: ACME, status: 'verified' }));
    await service.onOrgEvent(evt('org.updated', { orgId: ACME, updatedFields: { name: 'Sahyadri Steel' } }));
    await service.follow(me, 'company', ACME);
    const page = await service.following(me);
    expect(page.items[0]).toMatchObject({ type: 'company', name: 'Sahyadri Steel', verified: true, headline: 'Manufacturing · Pune' });
  });

  it('keeps one member\'s follows separate from another\'s', async () => {
    await service.follow(me, 'company', ACME);
    expect((await service.following({ type: 'member', id: 'p2' })).items).toHaveLength(0);
    expect(await service.state({ type: 'member', id: 'p2' }, 'company', ACME)).toEqual({ following: false, followerCount: 1 });
  });
});
