import { describe, it, expect, vi } from 'vitest';
import crypto from 'node:crypto';
import {
  verifyAccessToken,
  AuthenticationError,
  HttpMembershipRoleLookup,
  RequestAuthenticator,
  MembershipRoleLookup,
  trustTestHeaders,
} from '../src/request-auth';

const SECRET = 'unit-test-jwt-secret-at-least-32-characters';

function b64url(s: string | Buffer): string {
  return Buffer.from(s).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/** Mirrors services/identity TokenService.signJwt. */
function sign(payload: Record<string, unknown>, secret = SECRET, header = { alg: 'HS256', typ: 'JWT' }): string {
  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${h}.${p}.${sig}`;
}

const now = Math.floor(Date.now() / 1000);
const validPayload = { sub: 'person_1', sessionId: 'sess_1', familyId: 'fam_1', type: 'access', iat: now, exp: now + 900 };

describe('verifyAccessToken', () => {
  it('accepts a valid identity access token', () => {
    const v = verifyAccessToken(sign(validPayload), SECRET);
    expect(v.personId).toBe('person_1');
    expect(v.sessionId).toBe('sess_1');
  });

  it('rejects a token signed with a different secret', () => {
    expect(() => verifyAccessToken(sign(validPayload, 'some-other-secret-at-least-32-characters'), SECRET)).toThrow(AuthenticationError);
  });

  it('rejects a tampered payload (e.g. swapped subject)', () => {
    const [h, , s] = sign(validPayload).split('.');
    const forged = `${h}.${b64url(JSON.stringify({ ...validPayload, sub: 'attacker' }))}.${s}`;
    expect(() => verifyAccessToken(forged, SECRET)).toThrow(/signature/);
  });

  it('rejects an expired token', () => {
    expect(() => verifyAccessToken(sign({ ...validPayload, exp: now - 1 }), SECRET)).toThrow(/expired/);
  });

  it('rejects refresh, MFA and link tickets (type must be access)', () => {
    expect(() => verifyAccessToken(sign({ ...validPayload, type: 'refresh' }), SECRET)).toThrow(/Not an access token/);
    expect(() => verifyAccessToken(sign({ ...validPayload, type: 'mfa_ticket' }), SECRET)).toThrow(/Not an access token/);
  });

  it('rejects alg "none" and other algorithms', () => {
    expect(() => verifyAccessToken(sign(validPayload, SECRET, { alg: 'none', typ: 'JWT' }), SECRET)).toThrow(/algorithm/);
  });

  it('rejects malformed tokens', () => {
    expect(() => verifyAccessToken('not-a-jwt', SECRET)).toThrow(AuthenticationError);
    expect(() => verifyAccessToken('a.b.c', SECRET)).toThrow(AuthenticationError);
  });
});

describe('HttpMembershipRoleLookup', () => {
  it('returns the role, sends the service key, and caches the answer', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ role: 'admin' }), { status: 200 }));
    const lookup = new HttpMembershipRoleLookup('http://identity:4001/', 'svc-key', 60_000, fetchMock);

    expect(await lookup.getRole('p1', 't1')).toEqual({ role: 'admin', scope: undefined });
    expect(await lookup.getRole('p1', 't1')).toEqual({ role: 'admin', scope: undefined });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://identity:4001/internal/memberships/role?personId=p1&tenantId=t1');
    expect(init.headers['x-service-key']).toBe('svc-key');
  });

  it('returns null for non-members (404)', async () => {
    const lookup = new HttpMembershipRoleLookup('http://identity:4001', 'k', 60_000, vi.fn().mockResolvedValue(new Response('', { status: 404 })));
    expect(await lookup.getRole('p1', 't2')).toBeNull();
  });

  it('fails closed when identity errors or returns an unknown role', async () => {
    const down = new HttpMembershipRoleLookup('http://identity:4001', 'k', 60_000, vi.fn().mockResolvedValue(new Response('', { status: 500 })));
    await expect(down.getRole('p1', 't1')).rejects.toThrow();
    const weird = new HttpMembershipRoleLookup('http://identity:4001', 'k', 60_000, vi.fn().mockResolvedValue(new Response(JSON.stringify({ role: 'god' }), { status: 200 })));
    await expect(weird.getRole('p1', 't1')).rejects.toThrow(/unknown role/);
  });
});

describe('RequestAuthenticator', () => {
  const lookup: MembershipRoleLookup = {
    getRole: vi.fn(async (personId: string, tenantId: string) =>
      personId === 'person_1' && tenantId === 'tenant_A' ? { role: 'owner' as const } : null
    ),
  };

  it('derives person from the token and role from the membership, ignoring forged headers', async () => {
    const auth = new RequestAuthenticator({ jwtSecret: SECRET, roleLookup: lookup, trustTestHeaders: false });
    const caller = await auth.authenticate({
      authorization: `Bearer ${sign(validPayload)}`,
      'x-tenant-id': 'tenant_A',
      'x-user-role': 'super_admin',
      'x-user-id': 'someone-else',
    });
    expect(caller).toMatchObject({ personId: 'person_1', tenantId: 'tenant_A', role: 'owner', via: 'token' });
  });

  it('gives no role for a company the caller does not belong to', async () => {
    const auth = new RequestAuthenticator({ jwtSecret: SECRET, roleLookup: lookup, trustTestHeaders: false });
    const caller = await auth.authenticate({ authorization: `Bearer ${sign(validPayload)}`, 'x-tenant-id': 'tenant_B' });
    expect(caller.role).toBeUndefined();
  });

  it('rejects requests without a token outside tests, even with role headers', async () => {
    const auth = new RequestAuthenticator({ jwtSecret: SECRET, roleLookup: lookup, trustTestHeaders: false });
    await expect(auth.authenticate({ 'x-tenant-id': 'tenant_A', 'x-user-role': 'owner', 'x-user-id': 'x' })).rejects.toThrow(AuthenticationError);
  });

  it('accepts header identity only when trustTestHeaders is set', async () => {
    const auth = new RequestAuthenticator({ jwtSecret: SECRET, roleLookup: lookup, trustTestHeaders: true });
    const caller = await auth.authenticate({ 'x-tenant-id': 't', 'x-user-role': 'Admin', 'x-user-id': 'p9' });
    expect(caller).toMatchObject({ personId: 'p9', role: 'admin', via: 'test-headers' });
  });

  it('applyToHeaders overwrites client identity headers with verified values', () => {
    const headers: Record<string, string | undefined> = { 'x-user-role': 'owner', 'x-user-id': 'forged', 'x-person-id': 'forged' };
    RequestAuthenticator.applyToHeaders(headers, { personId: 'person_1', tenantId: 't', role: undefined, via: 'token' });
    expect(headers['x-user-id']).toBe('person_1');
    expect(headers['x-user-role']).toBeUndefined();
    expect(headers['x-person-id']).toBeUndefined();
  });

  it('trustTestHeaders is true only for NODE_ENV=test', () => {
    expect(trustTestHeaders('test')).toBe(true);
    expect(trustTestHeaders('development')).toBe(false);
    expect(trustTestHeaders('production')).toBe(false);
    expect(trustTestHeaders(undefined)).toBe(false);
  });
});
