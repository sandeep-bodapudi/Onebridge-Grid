import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectMongo, MongoConnectionHandle, FakeEventBus } from '@onebridge/shared';
import {
  OrganizationService,
  OrgStructureService,
  SeatsService,
  CounterService,
  AccessRequestService,
  MongoAccessRequestRepository,
  MongoOrganizationRepository,
  MongoIssuedIdRepository,
  MongoSeatRepository,
  MongoBranchRepository,
  MongoDepartmentRepository,
  MongoTeamRepository,
  MongoAuditRepository,
  MongoCounterRepository,
  IdentityInternalClient,
  PLAN_LIMITS,
  limitFor,
} from '../src/index.js';

const GSTIN = '36AABCS1429B1Z5';

describe('N02 plan limits table', () => {
  it('gives the free plan no seats, one branch and 10 catalogue items; unknown plans read as Starter', () => {
    expect(PLAN_LIMITS.free).toMatchObject({ seats: 0, branches: 1, catalogue_items: 10 });
    expect(limitFor('business', 'branches')).toBeNull();
    expect(limitFor(undefined, 'catalogue_items')).toBe(50);
  });
});

describe('N02 free company profiles', () => {
  let mongod: MongoMemoryServer;
  let handle: MongoConnectionHandle;
  let orgs: OrganizationService;
  let seats: SeatsService;
  let structure: OrgStructureService;
  let access: AccessRequestService;
  let identity: IdentityInternalClient;
  let bus: FakeEventBus;

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
    await Promise.all(
      ['organizations', 'issued_id_registries', 'seats', 'branches', 'counters', 'audit_logs', 'access_requests'].map((c) => db.collection(c).deleteMany({}))
    );
    bus = new FakeEventBus();
    identity = {
      createMembership: vi.fn().mockResolvedValue({ id: 'm1', role: 'owner' }),
      getPersonContacts: vi.fn().mockResolvedValue(null),
    };
    const orgRepo = new MongoOrganizationRepository(handle);
    const counter = new CounterService(new MongoCounterRepository(handle), orgRepo);
    const auditRepo = new MongoAuditRepository(handle);
    const seatRepo = new MongoSeatRepository(handle);
    const branchRepo = new MongoBranchRepository(handle);
    orgs = new OrganizationService(orgRepo, new MongoIssuedIdRepository(handle), identity, bus, counter);
    seats = new SeatsService(seatRepo, orgRepo, counter, auditRepo, bus);
    structure = new OrgStructureService(branchRepo, new MongoDepartmentRepository(handle), new MongoTeamRepository(handle), auditRepo, orgRepo, counter, bus);
    access = new AccessRequestService(new MongoAccessRequestRepository(handle), orgRepo, seatRepo, branchRepo, auditRepo, identity, bus);
  });

  const createFree = (name = 'Charminar Fabricators', gstin?: string) =>
    orgs.createOrganization({ name, industry: 'Manufacturing', size: '11-50', city: 'Hyderabad', plan: 'free', gstin, creatorPersonId: 'owner-1' });

  it('creates a free company with a Business ID and an Owner membership', async () => {
    const org = await createFree();
    expect(org.plan).toBe('free');
    expect(org.businessId).toMatch(/^OB-/);
    expect(identity.createMembership).toHaveBeenCalledWith(expect.objectContaining({ orgId: org.id, role: 'owner' }));
    const created = bus.calls.map((c) => (c.args as { event: { type: string; payload: { plan?: string } } }).event).find((e) => e.type === 'org.created');
    expect(created?.payload.plan).toBe('free');
  });

  it('refuses unknown plans', async () => {
    await expect(orgs.createOrganization({ name: 'X Co', industry: 'Services', size: '1-10', city: 'Hyderabad', plan: 'platinum' as unknown as 'free', creatorPersonId: 'p' })).rejects.toMatchObject({ status: 400 });
  });

  it('has no seats on the free plan, with an upgrade message', async () => {
    const org = await createFree();
    await expect(seats.createSeat(org.id, { title: 'Sales' })).rejects.toMatchObject({
      status: 403,
      response: { code: 'plan_limit', detail: expect.stringContaining('Upgrade to Starter') },
    });
  });

  it('allows one branch on the free plan', async () => {
    const org = await createFree();
    await structure.createBranch(org.id, { name: 'Balanagar works', address: { line1: 'Plot 5, IDA Balanagar', city: 'Hyderabad', state: 'Telangana', pincode: '500037' } } as Parameters<typeof structure.createBranch>[1], 'owner-1');
    await expect(structure.createBranch(org.id, { name: 'Second', address: { line1: 'Plot 5, IDA Balanagar', city: 'Hyderabad', state: 'Telangana', pincode: '500037' } } as Parameters<typeof structure.createBranch>[1], 'owner-1')).rejects.toMatchObject({ status: 403 });
    expect(await access.limits(org.id)).toEqual({ plan: 'free', items: [{ key: 'seats', used: 0, limit: 0 }, { key: 'branches', used: 1, limit: 1 }] });
  });

  it('allows one company per GSTIN and never names the existing one', async () => {
    await createFree('Charminar Fabricators', GSTIN);
    const err = await orgs.createOrganization({ name: 'Copycat', industry: 'Manufacturing', size: '1-10', city: 'Hyderabad', plan: 'free', gstin: GSTIN.toLowerCase(), creatorPersonId: 'p2' }).catch((e) => e);
    expect(err.status).toBe(409);
    expect(err.response.code).toBe('gstin_taken');
    expect(JSON.stringify(err.response)).not.toContain('Charminar');
  });

  it('lets someone request access by GSTIN, gives the same answer for unknown GSTINs, and the owner approves', async () => {
    const org = await createFree('Charminar Fabricators', GSTIN);
    await access.request('requester-1', { gstin: GSTIN, name: 'Imran (purchase team)', message: 'I manage purchasing here.' });
    await access.request('requester-1', { gstin: GSTIN, name: 'Imran again' }); // no duplicate while pending
    await expect(access.request('someone', { gstin: '27AABCU9603R1ZM', name: 'Nobody' })).resolves.toBeUndefined();

    await expect(access.listPending(org.id, 'admin')).rejects.toMatchObject({ status: 403 });
    const pending = await access.listPending(org.id, 'owner');
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ status: 'pending', requester: { name: 'Imran (purchase team)' }, message: 'I manage purchasing here.' });

    const decided = await access.decide(org.id, pending[0].id, { decision: 'approve', role: 'admin' }, 'owner', 'owner-1');
    expect(decided.status).toBe('approved');
    expect(identity.createMembership).toHaveBeenLastCalledWith(expect.objectContaining({ personId: 'requester-1', orgId: org.id, role: 'admin', onlyIfAbsent: true }));
    await expect(access.decide(org.id, pending[0].id, { decision: 'decline' }, 'owner', 'owner-1')).rejects.toMatchObject({ status: 409 });
  });

  it('validates the request', async () => {
    await expect(access.request('p', { gstin: 'not-a-gstin', name: 'X' })).rejects.toMatchObject({ status: 400 });
    await expect(access.request('p', { gstin: GSTIN, name: '' })).rejects.toMatchObject({ status: 400 });
  });

  it('keeps access requests inside the company', async () => {
    const a = await createFree('Charminar Fabricators', GSTIN);
    const b = await createFree('Golconda Tools', '36AAACG1234H1Z2');
    await access.request('requester-1', { gstin: GSTIN, name: 'Imran' });
    expect(await access.listPending(b.id, 'owner')).toHaveLength(0);
    const [req] = await access.listPending(a.id, 'owner');
    await expect(access.decide(b.id, req.id, { decision: 'approve' }, 'owner', 'owner-b')).rejects.toMatchObject({ status: 404 });
  });
});
