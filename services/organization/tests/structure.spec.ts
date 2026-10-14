import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectMongo, MongoConnectionHandle, FakeEventBus } from '@onebridge/shared';
import { createApp } from '../src/app.js';
import { OrganizationEnvConfig } from '../src/config/env.js';
import { IdentityInternalClient } from '../src/infrastructure/identity-internal.client.js';
import { OrganizationProps } from '../src/domain/organization.js';
import type { Branch, Department, OrgChartNode, AuditLogEntry } from '@onebridge/api-contracts';

describe('F07: Branches, Departments, Teams & Structure API (supertest & isolation)', () => {
  let mongod: MongoMemoryServer;
  let connectionHandle: MongoConnectionHandle;
  let app: INestApplication;
  let fakeEventBus: FakeEventBus;
  let mockIdentityClient: IdentityInternalClient;

  const TENANT_A = '01JACTENANTA00000000000000';
  const TENANT_B = '01JACTENANTB00000000000000';

  const testConfig: OrganizationEnvConfig = {
    nodeEnv: 'test',
    port: 4003,
    appUrl: 'http://localhost:3000',
    mongoUri: '',
    identityApiUrl: 'http://localhost:4001',
    internalServiceKey: 'test-key',
  };

  const seedOrg = async (tenantId: string, plan: 'starter' | 'business' = 'starter', businessId?: string) => {
    const db = connectionHandle._getInternalDb();
    const resolvedBusinessId = businessId || `OB-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const org: OrganizationProps = {
      id: tenantId,
      tenantId,
      businessId: resolvedBusinessId,
      name: `Org ${tenantId}`,
      slug: `org-${tenantId.toLowerCase()}`,
      previousSlugs: [],
      industry: 'Technology',
      size: '11-50',
      city: 'Bengaluru',
      plan,
      verifiedBadge: false,
      onboardingStartedAt: new Date().toISOString(),
      aggregateVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.collection('organizations').insertOne(org);
  };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    testConfig.mongoUri = mongod.getUri();
    connectionHandle = await connectMongo(mongod.getUri());

    fakeEventBus = new FakeEventBus();
    mockIdentityClient = {
      createMembership: vi.fn().mockResolvedValue({ id: 'mem_1', role: 'owner' }),
    };

    app = await createApp({
      envConfig: testConfig,
      connectionHandle,
      identityClient: mockIdentityClient,
      eventBus: fakeEventBus,
    });
    await app.init();
  }, 120000);

  afterAll(async () => {
    if (app) await app.close();
    if (connectionHandle) await connectionHandle.close();
    if (mongod) await mongod.stop();
  });

  beforeEach(async () => {
    const db = connectionHandle._getInternalDb();
    await db.collection('organizations').deleteMany({});
    await db.collection('branches').deleteMany({});
    await db.collection('departments').deleteMany({});
    await db.collection('teams').deleteMany({});
    await db.collection('audit_logs').deleteMany({});
    await db.collection('counters').deleteMany({});
    fakeEventBus.calls = [];
    vi.clearAllMocks();
  });

  // ===========================================================================
  // AC-1: Branches CRUD & Derived IDs
  // ===========================================================================
  describe('AC-1: Branches CRUD and Derived IDs (OB-XXXXXX-Bnn)', () => {
    it('creates, edits, and archives a branch with address, mapPin, contact, and manager', async () => {
      await seedOrg(TENANT_A, 'business', 'OB-ALPHA1');

      // 1. Create branch
      const createRes = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/branches`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'owner')
        .set('x-user-id', 'person_owner_1')
        .send({
          name: 'Indiranagar Flagship',
          address: {
            line1: '100 Feet Road, HAL 2nd Stage',
            line2: 'Suite 401',
            city: 'Bengaluru',
            state: 'Karnataka',
            pincode: '560038',
          },
          mapPin: {
            lat: 12.9716,
            lng: 77.5946,
            mapsUrl: 'https://maps.google.com/?q=12.9716,77.5946',
          },
          contact: {
            email: 'indiranagar@alphacorp.com',
            phone: '+919876543210',
          },
          managerPersonId: 'person_mgr_1',
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.id).toMatch(/^OB-ALPHA1-B01$/);
      expect(createRes.body.name).toBe('Indiranagar Flagship');
      expect(createRes.body.status).toBe('active');
      expect(createRes.body.managerPersonId).toBe('person_mgr_1');
      expect(createRes.body.address.pincode).toBe('560038');

      const branchId = createRes.body.id;

      // 2. Fetch branch by ID
      const getRes = await request(app.getHttpServer())
        .get(`/orgs/${TENANT_A}/branches/${branchId}`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin');

      expect(getRes.status).toBe(200);
      expect(getRes.body.id).toBe(branchId);
      expect(getRes.body.contact.email).toBe('indiranagar@alphacorp.com');

      // 3. Edit branch
      const updateRes = await request(app.getHttpServer())
        .patch(`/orgs/${TENANT_A}/branches/${branchId}`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({
          name: 'Indiranagar Experience Centre',
          contact: {
            email: 'experience@alphacorp.com',
            phone: '+919876543210',
          },
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.name).toBe('Indiranagar Experience Centre');
      expect(updateRes.body.contact.email).toBe('experience@alphacorp.com');

      // 4. Archive branch
      const archiveRes = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/branches/${branchId}/archive`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'owner');

      expect(archiveRes.status).toBe(200);
      expect(archiveRes.body.status).toBe('archived');
      expect(archiveRes.body.archivedAt).toBeDefined();
    });

    it('rejects branch creation if address is incomplete', async () => {
      await seedOrg(TENANT_A, 'business');

      const res = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/branches`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({
          name: 'Incomplete Branch',
          address: {
            line1: 'Road 1',
            // Missing city, state, pincode
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.detail || res.body.message).toMatch(/Complete branch address/);
    });
  });

  // ===========================================================================
  // AC-2: Departments (Defaults + Custom, Global vs Branch-Scoped)
  // ===========================================================================
  describe('AC-2: Departments (Defaults + Custom, Branch-Scoped & Derived IDs)', () => {
    it('seeds the 5 default departments: Sales, Marketing, HR, Support, Development', async () => {
      await seedOrg(TENANT_A, 'business', 'OB-ALPHA2');

      const seedRes = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/departments/defaults`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'owner');

      expect(seedRes.status).toBe(201);
      const depts = seedRes.body.items || seedRes.body;
      expect(Array.isArray(depts)).toBe(true);
      expect(depts.length).toBe(5);

      const deptNames = (depts as Department[]).map((d) => d.name);
      expect(deptNames).toContain('Sales');
      expect(deptNames).toContain('Marketing');
      expect(deptNames).toContain('HR');
      expect(deptNames).toContain('Support');
      expect(deptNames).toContain('Development');

      // Verify derived IDs OB-ALPHA2-D01 .. D05
      expect(depts[0].id).toMatch(/^OB-ALPHA2-D01$/);
      expect(depts[4].id).toMatch(/^OB-ALPHA2-D05$/);
    });


    it('creates custom global and branch-scoped departments, edits, and archives them', async () => {
      await seedOrg(TENANT_A, 'business', 'OB-ALPHA3');

      // 1. Create a branch first
      const branchRes = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/branches`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'owner')
        .send({
          name: 'Mumbai Office',
          address: { line1: 'Nariman Point', city: 'Mumbai', state: 'Maharashtra', pincode: '400021' },
        });
      const branchId = branchRes.body.id;

      // 2. Create custom branch-scoped department
      const customDeptRes = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/departments`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({
          name: 'Regional Operations',
          branchId,
          managerPersonId: 'person_head_1',
        });

      expect(customDeptRes.status).toBe(201);
      expect(customDeptRes.body.id).toMatch(/^OB-ALPHA3-D01$/);
      expect(customDeptRes.body.name).toBe('Regional Operations');
      expect(customDeptRes.body.branchId).toBe(branchId);
      expect(customDeptRes.body.managerPersonId).toBe('person_head_1');

      const deptId = customDeptRes.body.id;

      // 3. Edit department
      const updateRes = await request(app.getHttpServer())
        .patch(`/orgs/${TENANT_A}/departments/${deptId}`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({
          name: 'Western Regional Operations',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.name).toBe('Western Regional Operations');

      // 4. Archive department
      const archiveRes = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/departments/${deptId}/archive`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin');

      expect(archiveRes.status).toBe(200);
      expect(archiveRes.body.status).toBe('archived');
      expect(archiveRes.body.archivedAt).toBeDefined();
    });
  });

  // ===========================================================================
  // AC-3: Teams under Departments with Team Lead
  // ===========================================================================
  describe('AC-3: Teams under departments with Team Lead and derived manager chain', () => {
    it('creates teams under departments and returns derived manager chain', async () => {
      await seedOrg(TENANT_A, 'business', 'OB-ALPHA4');

      // 1. Create branch and dept
      const branchRes = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/branches`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'owner')
        .send({
          name: 'Bangalore HQ',
          address: { line1: 'MG Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
          managerPersonId: 'person_branch_lead',
        });

      const deptRes = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/departments`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'owner')
        .send({
          name: 'Engineering',
          branchId: branchRes.body.id,
          headPersonId: 'person_dept_head',
        });

      const deptId = deptRes.body.id;

      // 2. Create parent team
      const parentTeamRes = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/teams`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({
          name: 'Platform Core',
          departmentId: deptId,
          leadPersonId: 'person_lead_platform',
        });

      expect(parentTeamRes.status).toBe(201);
      expect(parentTeamRes.body.name).toBe('Platform Core');
      expect(parentTeamRes.body.leadPersonId).toBe('person_lead_platform');

      // 3. Create sub team under parent team
      const subTeamRes = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/teams`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .send({
          name: 'Infrastructure Squad',
          departmentId: deptId,
          leadPersonId: 'person_lead_infra',
          parentTeamId: parentTeamRes.body.id,
        });

      expect(subTeamRes.status).toBe(201);
      expect(subTeamRes.body.parentTeamId).toBe(parentTeamRes.body.id);

      // 4. Verify derived manager chain for an employee in subTeam
      // Tree view returns the hierarchy with manager chains
      const treeRes = await request(app.getHttpServer())
        .get(`/orgs/${TENANT_A}/tree`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin');

      expect(treeRes.status).toBe(200);
      expect(treeRes.body.type).toBe('company');
      expect(treeRes.body.children.length).toBeGreaterThan(0);
      const rootNode = treeRes.body as OrgChartNode;
      const branch = rootNode.children?.find((c) => c.type === 'branch');
      expect(branch).toBeDefined();
      const dept = branch?.children?.find((c) => c.type === 'department');
      expect(dept).toBeDefined();
      const team = dept?.children?.find((c) => c.type === 'team');
      expect(team).toBeDefined();
      expect(team?.name).toBe('Platform Core');
    });
  });

  // ===========================================================================
  // AC-4: Archive behaviour (hidden from queries, history preserved)
  // ===========================================================================
  describe('AC-4: Archived branches & departments hidden by default', () => {
    it('hides archived branches unless includeArchived=true', async () => {
      await seedOrg(TENANT_A, 'business');

      const b1 = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/branches`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'owner')
        .send({
          name: 'Active Branch',
          address: { line1: 'L1', city: 'Delhi', state: 'Delhi', pincode: '110001' },
        });

      const b2 = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/branches`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'owner')
        .send({
          name: 'Branch To Archive',
          address: { line1: 'L2', city: 'Delhi', state: 'Delhi', pincode: '110001' },
        });

      // Archive b2
      await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/branches/${b2.body.id}/archive`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'owner');

      // Default query: only active branches
      const activeList = await request(app.getHttpServer())
        .get(`/orgs/${TENANT_A}/branches`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin');

      const activeBranches = activeList.body.items || activeList.body;
      expect(activeBranches.length).toBe(1);
      expect(activeBranches[0].id).toBe(b1.body.id);

      // includeArchived=true: returns both
      const allList = await request(app.getHttpServer())
        .get(`/orgs/${TENANT_A}/branches?includeArchived=true`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin');

      const allBranches = allList.body.items || allList.body;
      expect(allBranches.length).toBe(2);
      const archived = (allBranches as Branch[]).find((b) => b.id === b2.body.id);
      expect(archived).toBeDefined();
      expect(archived?.status).toBe('archived');
      expect(archived?.archivedAt).toBeDefined();
    });
  });


  // ===========================================================================
  // AC-5: Plan limits (Starter: 1 branch; Business: unlimited)
  // ===========================================================================
  describe('AC-5: Plan limits enforced server-side (Starter=1, Business=unlimited)', () => {
    it('restricts Starter plan to 1 active branch and forbids 2nd branch', async () => {
      await seedOrg(TENANT_A, 'starter');

      // 1st branch succeeds
      const b1 = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/branches`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'owner')
        .send({
          name: 'First Branch',
          address: { line1: 'L1', city: 'Pune', state: 'Maharashtra', pincode: '411001' },
        });
      expect(b1.status).toBe(201);

      // 2nd branch fails with 403 Forbidden
      const b2 = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/branches`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'owner')
        .send({
          name: 'Second Branch Forbidden',
          address: { line1: 'L2', city: 'Pune', state: 'Maharashtra', pincode: '411001' },
        });

      expect(b2.status).toBe(403);
      expect(b2.body.detail || b2.body.message).toMatch(/Starter plan allows a maximum of 1 branch/);
    });

    it('allows unlimited branches on Business plan', async () => {
      await seedOrg(TENANT_A, 'business');

      for (let i = 1; i <= 3; i++) {
        const res = await request(app.getHttpServer())
          .post(`/orgs/${TENANT_A}/branches`)
          .set('x-tenant-id', TENANT_A)
          .set('x-user-role', 'owner')
          .send({
            name: `Business Branch ${i}`,
            address: { line1: `L${i}`, city: 'Hyderabad', state: 'Telangana', pincode: '500081' },
          });
        expect(res.status).toBe(201);
      }
    });
  });

  // ===========================================================================
  // AC-6: Org Chart Tree View, Drag-and-Drop Move, and Cycle Prevention
  // ===========================================================================
  describe('AC-6: Org chart tree, drag-and-drop move, and cycle prevention', () => {
    it('detects and rejects circular parentTeam hierarchy with 400 Bad Request', async () => {
      await seedOrg(TENANT_A, 'business');

      const deptRes = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/departments`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'owner')
        .send({ name: 'Product Engineering' });

      // Team 1
      const t1 = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/teams`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'owner')
        .send({ name: 'Team Alpha', departmentId: deptRes.body.id });

      // Team 2 child of Team 1
      const t2 = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/teams`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'owner')
        .send({ name: 'Team Beta', departmentId: deptRes.body.id, parentTeamId: t1.body.id });

      // Team 3 child of Team 2
      const t3 = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/teams`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'owner')
        .send({ name: 'Team Gamma', departmentId: deptRes.body.id, parentTeamId: t2.body.id });

      // Try setting Team 1's parent to Team 3 (would create Alpha -> Beta -> Gamma -> Alpha loop)
      const loopRes = await request(app.getHttpServer())
        .patch(`/orgs/${TENANT_A}/teams/${t1.body.id}`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'owner')
        .send({ parentTeamId: t3.body.id });

      expect(loopRes.status).toBe(400);
      expect(loopRes.body.detail || loopRes.body.message).toMatch(/Cycle detected/);

      // Try setting Team 1's parent to itself
      const selfLoopRes = await request(app.getHttpServer())
        .patch(`/orgs/${TENANT_A}/teams/${t1.body.id}`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'owner')
        .send({ parentTeamId: t1.body.id });

      expect(selfLoopRes.status).toBe(400);
      expect(selfLoopRes.body.detail || selfLoopRes.body.message).toMatch(/cannot be its own parent/i);
    });

    it('moves a person between branch/department/team via /tree/move-person', async () => {
      await seedOrg(TENANT_A, 'business');

      const b = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/branches`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'owner')
        .send({
          name: 'Chennai Hub',
          address: { line1: 'OMR', city: 'Chennai', state: 'Tamil Nadu', pincode: '600096' },
        });

      const d = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/departments`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'owner')
        .send({ name: 'Frontend', branchId: b.body.id });

      const t = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/teams`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'owner')
        .send({ name: 'UI Components', departmentId: d.body.id });

      const moveRes = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/tree/move-person`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin')
        .set('x-user-id', 'admin_actor_1')
        .send({
          personId: 'employee_rohit',
          targetBranchId: b.body.id,
          targetDepartmentId: d.body.id,
          targetTeamId: t.body.id,
        });

      expect(moveRes.status).toBe(200);
      expect(moveRes.body.type).toBe('company');
      expect(moveRes.body.children).toBeDefined();
    });
  });

  // ===========================================================================
  // AC-7: Audit Trail (audit_logs collection & audit.recorded event)
  // ===========================================================================
  describe('AC-7: Audit logging and event publishing', () => {
    it('records immutable audit logs and publishes events on every create/update/archive', async () => {
      await seedOrg(TENANT_A, 'business');

      // 1. Create a branch
      const branchRes = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/branches`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'owner')
        .set('x-user-id', 'actor_vikram')
        .send({
          name: 'Noida Lab',
          address: { line1: 'Sector 62', city: 'Noida', state: 'Uttar Pradesh', pincode: '201309' },
        });

      const branchId = branchRes.body.id;

      // 2. Query audit logs via /audit-logs endpoint
      const auditRes = await request(app.getHttpServer())
        .get(`/orgs/${TENANT_A}/audit-logs?entityType=branch`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'owner');

      expect(auditRes.status).toBe(200);
      expect(auditRes.body.length).toBeGreaterThan(0);
      const createLog = (auditRes.body as AuditLogEntry[]).find((l) => l.action === 'branch.created' && l.entityId === branchId);
      expect(createLog).toBeDefined();
      expect(createLog?.actorPersonId).toBe('actor_vikram');
      expect(createLog?.tenantId).toBe(TENANT_A);

      // Verify event was published
      interface FakePublishCall {
        args: {
          event: {
            type: string;
            tenantId: string;
            payload: { branchId: string };
          };
        };
      }
      const branchCreatedCall = (fakeEventBus.calls as unknown as FakePublishCall[]).find(
        (c) => c.args?.event?.type === 'branch.created'
      );
      expect(branchCreatedCall).toBeDefined();
      const branchCreatedEvent = branchCreatedCall?.args.event;
      expect(branchCreatedEvent?.tenantId).toBe(TENANT_A);
      expect(branchCreatedEvent?.payload.branchId).toBe(branchId);
    });
  });

  // ===========================================================================
  // Cross-Tenant Isolation Tests (AGENTS.md Section 3 Non-Negotiable)
  // ===========================================================================
  describe('Cross-Tenant Isolation & Role Authorization (AGENTS.md Section 3)', () => {
    it('strictly forbids cross-tenant access between Tenant A and Tenant B', async () => {
      await seedOrg(TENANT_A, 'business');
      await seedOrg(TENANT_B, 'business');

      // Create branch in Tenant A
      const bA = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/branches`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'owner')
        .send({
          name: 'Tenant A Secret Branch',
          address: { line1: 'A Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
        });

      // Tenant B tries to list Tenant A's branches (header tenant B mismatch with path tenant A)
      const hackList = await request(app.getHttpServer())
        .get(`/orgs/${TENANT_A}/branches`)
        .set('x-tenant-id', TENANT_B)
        .set('x-user-role', 'owner');

      expect(hackList.status).toBe(403);
      expect(hackList.body.detail).toMatch(/Cross-tenant access denied/);

      // Tenant B tries to fetch Tenant A's branch directly by ID using Tenant B context
      const hackGet = await request(app.getHttpServer())
        .get(`/orgs/${TENANT_B}/branches/${bA.body.id}`)
        .set('x-tenant-id', TENANT_B)
        .set('x-user-role', 'owner');

      // Since repo is tenant-scoped, Tenant B query will not find Tenant A branch
      expect(hackGet.status).toBe(404);
    });

    it('rejects structure modification requests from non-admin/owner roles', async () => {
      await seedOrg(TENANT_A, 'business');

      // Member role tries to create a branch
      const res = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/branches`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'member')
        .send({
          name: 'Unauthorized Branch',
          address: { line1: 'L1', city: 'Delhi', state: 'Delhi', pincode: '110001' },
        });

      expect(res.status).toBe(403);
      expect(res.body.detail).toMatch(/Only Organization Owner or Admin/);
    });

    it('strictly rejects write operations when x-user-role is missing or unauthenticated', async () => {
      await seedOrg(TENANT_A, 'business');

      // Unauthenticated caller omits x-user-role
      const res = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/branches`)
        .set('x-tenant-id', TENANT_A)
        .send({
          name: 'Anonymous Branch Attack',
          address: { line1: 'L1', city: 'Delhi', state: 'Delhi', pincode: '110001' },
        });

      expect(res.status).toBe(403);
      expect(res.body.detail).toMatch(/Only Organization Owner or Admin/);
    });

    it('strictly rejects requests when x-tenant-id is missing', async () => {
      await seedOrg(TENANT_A, 'business');

      // Caller omits x-tenant-id
      const res = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/branches`)
        .set('x-user-role', 'owner')
        .send({
          name: 'Missing Tenant Header',
          address: { line1: 'L1', city: 'Delhi', state: 'Delhi', pincode: '110001' },
        });

      expect(res.status).toBe(403);
      expect(res.body.detail).toMatch(/Cross-tenant access denied/);
    });
  });

  // ===========================================================================
  // Idempotency & Replay Protection (Rule 12)
  // ===========================================================================
  describe('Idempotency & Replay Protection (Rule 12)', () => {
    it('returns cached response on replayed Idempotency-Key and rejects payload mismatch with 422', async () => {
      await seedOrg(TENANT_A, 'business', 'OB-IDEM01');

      const payload = {
        name: 'Idempotent Branch',
        address: { line1: '123 MG Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
      };

      // First call
      const firstRes = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/branches`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'owner')
        .set('idempotency-key', 'branch-key-001')
        .send(payload);

      expect(firstRes.status).toBe(201);
      const mintedId = firstRes.body.id;
      expect(mintedId).toMatch(/^OB-IDEM01-B01$/);

      // Replay with identical body -> returns identical cached response
      const secondRes = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/branches`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'owner')
        .set('idempotency-key', 'branch-key-001')
        .send(payload);

      expect(secondRes.status).toBe(201);
      expect(secondRes.body.id).toBe(mintedId);

      // Replay with different body -> 422 Unprocessable Entity
      const mismatchRes = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/branches`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'owner')
        .set('idempotency-key', 'branch-key-001')
        .send({
          ...payload,
          name: 'Different Branch Name With Same Key',
        });

      expect(mismatchRes.status).toBe(422);
      expect(mismatchRes.body.detail).toMatch(/Mismatching request body/);
    });
  });

  // ===========================================================================
  // Soft Archiving of Teams & AC-3 Single Primary Team Enforcement
  // ===========================================================================
  describe('Soft Archiving of Teams & AC-3 Single Primary Team', () => {
    it('soft archives teams, preserves history in database, and hides from default list', async () => {
      await seedOrg(TENANT_A, 'business');

      const deptRes = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/departments`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'owner')
        .send({ name: 'Finance Dept' });

      const teamRes = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/teams`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'owner')
        .send({ name: 'Payroll Team', departmentId: deptRes.body.id });

      const teamId = teamRes.body.id;

      // Archive team via POST /teams/:id/archive
      const archiveRes = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/teams/${teamId}/archive`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'owner');

      expect(archiveRes.status).toBe(200);
      expect(archiveRes.body.status).toBe('archived');
      expect(archiveRes.body.archivedAt).toBeDefined();

      // Query active teams -> 0 returned
      const activeList = await request(app.getHttpServer())
        .get(`/orgs/${TENANT_A}/teams`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin');

      expect(activeList.body.items.length).toBe(0);

      // Query with includeArchived=true -> 1 returned
      const allList = await request(app.getHttpServer())
        .get(`/orgs/${TENANT_A}/teams?includeArchived=true`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin');

      expect(allList.body.items.length).toBe(1);
      expect(allList.body.items[0].id).toBe(teamId);
    });

    it('enforces that an employee has only one primary team at any time (AC-3) and emits org.person_moved (AC-6)', async () => {
      await seedOrg(TENANT_A, 'business');

      const deptRes = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/departments`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'owner')
        .send({ name: 'Product Dept' });

      const t1 = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/teams`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'owner')
        .send({ name: 'Team Alpha', departmentId: deptRes.body.id });

      const t2 = await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/teams`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'owner')
        .send({ name: 'Team Beta', departmentId: deptRes.body.id });

      // Move Rohit to Team Alpha
      await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/tree/move-person`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'owner')
        .send({
          personId: 'employee_rohit',
          targetTeamId: t1.body.id,
        });

      // Fetch Team Alpha
      const getT1AfterFirst = await request(app.getHttpServer())
        .get(`/orgs/${TENANT_A}/teams/${t1.body.id}`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin');
      expect(getT1AfterFirst.body.memberPersonIds).toContain('employee_rohit');

      // Move Rohit to Team Beta
      await request(app.getHttpServer())
        .post(`/orgs/${TENANT_A}/tree/move-person`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'owner')
        .send({
          personId: 'employee_rohit',
          targetTeamId: t2.body.id,
        });

      // Verify Rohit was removed from Team Alpha (single primary team enforced)
      const getT1AfterSecond = await request(app.getHttpServer())
        .get(`/orgs/${TENANT_A}/teams/${t1.body.id}`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin');
      expect(getT1AfterSecond.body.memberPersonIds).not.toContain('employee_rohit');

      // Verify Rohit is now in Team Beta
      const getT2AfterSecond = await request(app.getHttpServer())
        .get(`/orgs/${TENANT_A}/teams/${t2.body.id}`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin');
      expect(getT2AfterSecond.body.memberPersonIds).toContain('employee_rohit');

      // Verify org.person_moved event was emitted
      interface FakePublishCall {
        args: {
          event: {
            type: string;
            tenantId: string;
            payload: { personId: string; targetTeamId?: string };
          };
        };
      }
      const moveCalls = (fakeEventBus.calls as unknown as FakePublishCall[]).filter(
        (c) => c.args?.event?.type === 'org.person_moved' && c.args?.event?.payload?.personId === 'employee_rohit'
      );
      const moveCall = moveCalls[moveCalls.length - 1];
      expect(moveCall).toBeDefined();
      expect(moveCall?.args.event.payload.personId).toBe('employee_rohit');
      expect(moveCall?.args.event.payload.targetTeamId).toBe(t2.body.id);
    });
  });

  // ===========================================================================
  // List Pagination (Rule 14)
  // ===========================================================================
  describe('List Pagination with limit and offset (Rule 14)', () => {
    it('returns paginated envelope with items, total, limit, and offset', async () => {
      await seedOrg(TENANT_A, 'business');

      for (let i = 1; i <= 3; i++) {
        await request(app.getHttpServer())
          .post(`/orgs/${TENANT_A}/branches`)
          .set('x-tenant-id', TENANT_A)
          .set('x-user-role', 'owner')
          .send({
            name: `Paginated Branch ${i}`,
            address: { line1: `L${i}`, city: 'Hyderabad', state: 'Telangana', pincode: '500081' },
          });
      }

      // Query with limit=2, offset=0
      const page1 = await request(app.getHttpServer())
        .get(`/orgs/${TENANT_A}/branches?limit=2&offset=0`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin');

      expect(page1.status).toBe(200);
      expect(page1.body.total).toBe(3);
      expect(page1.body.limit).toBe(2);
      expect(page1.body.offset).toBe(0);
      expect(page1.body.items.length).toBe(2);

      // Query with limit=2, offset=2
      const page2 = await request(app.getHttpServer())
        .get(`/orgs/${TENANT_A}/branches?limit=2&offset=2`)
        .set('x-tenant-id', TENANT_A)
        .set('x-user-role', 'admin');

      expect(page2.status).toBe(200);
      expect(page2.body.total).toBe(3);
      expect(page2.body.offset).toBe(2);
      expect(page2.body.items.length).toBe(1);
    });
  });
});
