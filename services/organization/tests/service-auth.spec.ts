import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  connectMongo,
  MongoConnectionHandle,
  FakeEventBus,
  RequestAuthenticator,
  MembershipRoleLookup,
} from '@onebridge/shared';
import { createApp } from '../src/app.js';
import { OrganizationEnvConfig } from '../src/config/env.js';
import { IdentityInternalClient } from '../src/infrastructure/identity-internal.client.js';
import { OrganizationProps } from '../src/domain/organization.js';

/**
 * D-SERVICE-AUTH: outside NODE_ENV=test the organization service must
 * derive the caller from a verified identity access token and their role
 * from identity's memberships, never from client-sent headers.
 */
describe('D-SERVICE-AUTH: organization requires a verified access token', () => {
  const JWT_SECRET = 'service-auth-spec-jwt-secret-at-least-32-chars';
  const TENANT_A = '01JAUTHTENANTA0000000000000';
  const OWNER = 'person_owner';
  const OUTSIDER = 'person_outsider';

  let mongod: MongoMemoryServer;
  let connectionHandle: MongoConnectionHandle;
  let app: INestApplication;
  const roleLookup: MembershipRoleLookup = {
    getRole: vi.fn(async (personId: string, tenantId: string) =>
      personId === OWNER && tenantId === TENANT_A ? { role: 'owner' as const } : null
    ),
  };

  function b64url(s: string): string {
    return Buffer.from(s).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }
  /** Same format as services/identity TokenService.signJwt. */
  function accessToken(personId: string, secret = JWT_SECRET): string {
    const now = Math.floor(Date.now() / 1000);
    const h = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const p = b64url(JSON.stringify({ sub: personId, sessionId: 's1', familyId: 'f1', type: 'access', iat: now, exp: now + 900 }));
    const sig = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return `${h}.${p}.${sig}`;
  }

  const config: OrganizationEnvConfig = {
    nodeEnv: 'development', // NOT 'test': header identity must be rejected
    port: 4099,
    appUrl: 'http://localhost:3000',
    mongoUri: '',
    identityApiUrl: 'http://localhost:4001',
    internalServiceKey: 'test-key',
    jwtSecret: JWT_SECRET,
  };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    config.mongoUri = mongod.getUri();
    connectionHandle = await connectMongo(mongod.getUri());
    const identityClient: IdentityInternalClient = {
      createMembership: vi.fn().mockResolvedValue({ id: 'mem_1', role: 'owner' }),
    };
    app = await createApp({
      envConfig: config,
      connectionHandle,
      identityClient,
      eventBus: new FakeEventBus(),
      requestAuthenticator: new RequestAuthenticator({ jwtSecret: JWT_SECRET, roleLookup, trustTestHeaders: false }),
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
    await db.collection('seats').deleteMany({});
    await db.collection('counters').deleteMany({});
    const org: OrganizationProps = {
      id: TENANT_A,
      tenantId: TENANT_A,
      businessId: 'OB-AUTH01',
      name: 'Auth Test Co',
      slug: 'auth-test-co',
      previousSlugs: [],
      industry: 'Technology',
      size: '11-50',
      city: 'Hyderabad',
      plan: 'business',
      verifiedBadge: false,
      onboardingStartedAt: new Date().toISOString(),
      aggregateVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.collection('organizations').insertOne(org);
  });

  it('rejects forged role headers without a token (401)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/orgs/${TENANT_A}/seats`)
      .set('x-tenant-id', TENANT_A)
      .set('x-user-role', 'owner')
      .set('x-user-id', 'attacker')
      .send({ title: 'Forged seat' });

    expect(res.status).toBe(401);
    const seats = await connectionHandle._getInternalDb().collection('seats').countDocuments({});
    expect(seats).toBe(0);
  });

  it('rejects a token signed with the wrong secret (401)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/orgs/${TENANT_A}/seats`)
      .set('Authorization', `Bearer ${accessToken(OWNER, 'a-different-secret-at-least-32-characters')}`)
      .set('x-tenant-id', TENANT_A)
      .send({ title: 'Seat' });

    expect(res.status).toBe(401);
  });

  it('allows the owner with a valid token, without any role header (as the dashboard sends it)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/orgs/${TENANT_A}/seats`)
      .set('Authorization', `Bearer ${accessToken(OWNER)}`)
      .set('x-tenant-id', TENANT_A)
      .send({ title: 'Sales Executive' });

    expect(res.status).toBe(201);
  });

  it('denies a signed-in non-member even with a forged owner header (403)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/orgs/${TENANT_A}/seats`)
      .set('Authorization', `Bearer ${accessToken(OUTSIDER)}`)
      .set('x-tenant-id', TENANT_A)
      .set('x-user-role', 'owner')
      .send({ title: 'Sneaky seat' });

    expect(res.status).toBe(403);
  });

  it('records the verified person as company creator, ignoring creatorPersonId in the body', async () => {
    const res = await request(app.getHttpServer())
      .post('/orgs')
      .set('Authorization', `Bearer ${accessToken(OUTSIDER)}`)
      .send({ name: 'New Co', industry: 'Retail', size: '1-10', city: 'Pune', creatorPersonId: 'someone-else' });

    expect(res.status).toBe(201);
    const identityClient = (app.get('IDENTITY_INTERNAL_CLIENT') as IdentityInternalClient);
    expect(identityClient.createMembership).toHaveBeenLastCalledWith(
      expect.objectContaining({ personId: OUTSIDER, role: 'owner' })
    );
  });
});
