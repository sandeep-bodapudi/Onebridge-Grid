/**
 * Authenticates calls to tenant-scoped services (organization, cards).
 *
 * The caller's identity comes from the access token issued by the identity
 * service (HS256 with JWT_SECRET, claims { sub, sessionId, type: 'access' }),
 * verified locally with no network call. The caller's role in the requested
 * company (X-Tenant-Id) comes from identity's memberships via an internal
 * endpoint, cached briefly. Client-supplied X-User-Id / X-User-Role headers
 * are never trusted, except in automated tests (NODE_ENV=test), where the
 * existing suites inject them directly. Decision: docs/decisions.md
 * D-SERVICE-AUTH.
 */
import crypto from 'node:crypto';
import { Role, ROLES } from './rbac/roles.js';

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export interface VerifiedAccessToken {
  personId: string;
  sessionId?: string;
  expiresAt: number;
}

function base64UrlToBuffer(input: string): Buffer {
  let b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return Buffer.from(b64, 'base64');
}

function hmacBase64Url(secret: string, data: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/** Verifies an identity-issued access token. Throws AuthenticationError if invalid. */
export function verifyAccessToken(
  token: string,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): VerifiedAccessToken {
  const parts = typeof token === 'string' ? token.split('.') : [];
  if (parts.length !== 3) throw new AuthenticationError('Malformed access token');
  const [headerB64, payloadB64, signature] = parts;

  let header: { alg?: string };
  let payload: { sub?: string; sessionId?: string; type?: string; exp?: number };
  try {
    header = JSON.parse(base64UrlToBuffer(headerB64).toString('utf8'));
    payload = JSON.parse(base64UrlToBuffer(payloadB64).toString('utf8'));
  } catch {
    throw new AuthenticationError('Malformed access token');
  }

  if (header.alg !== 'HS256') throw new AuthenticationError('Unsupported token algorithm');

  const expected = Buffer.from(hmacBase64Url(secret, `${headerB64}.${payloadB64}`));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    throw new AuthenticationError('Invalid access token signature');
  }

  if (payload.type !== 'access') throw new AuthenticationError('Not an access token');
  if (typeof payload.sub !== 'string' || !payload.sub) throw new AuthenticationError('Access token has no subject');
  if (typeof payload.exp !== 'number' || payload.exp < nowSeconds) {
    throw new AuthenticationError('Access token expired');
  }

  return { personId: payload.sub, sessionId: payload.sessionId, expiresAt: payload.exp };
}

export interface MembershipRole {
  role: Role;
  scope?: { branchId?: string; departmentId?: string; teamId?: string };
}

export interface MembershipRoleLookup {
  /** The person's role in the company, or null if they are not a member. */
  getRole(personId: string, tenantId: string): Promise<MembershipRole | null>;
}

/**
 * Looks up roles via identity's GET /internal/memberships/role (service key).
 * Results (including "not a member") are cached for `ttlMs` so a removed
 * membership stops working within that window. Fails closed: if identity
 * cannot be reached the request is rejected, never allowed.
 */
export class HttpMembershipRoleLookup implements MembershipRoleLookup {
  private readonly cache = new Map<string, { value: MembershipRole | null; expiresAt: number }>();

  constructor(
    private readonly identityApiUrl: string,
    private readonly serviceKey: string,
    private readonly ttlMs = 60_000,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args)
  ) {}

  async getRole(personId: string, tenantId: string): Promise<MembershipRole | null> {
    const key = `${personId}|${tenantId}`;
    const hit = this.cache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value;

    const url = `${this.identityApiUrl.replace(/\/+$/, '')}/internal/memberships/role?personId=${encodeURIComponent(
      personId
    )}&tenantId=${encodeURIComponent(tenantId)}`;
    const res = await this.fetchImpl(url, { headers: { 'x-service-key': this.serviceKey } });

    let value: MembershipRole | null;
    if (res.status === 404) {
      value = null;
    } else if (res.ok) {
      const body = (await res.json()) as { role?: string; scope?: MembershipRole['scope'] };
      if (!body.role || !(ROLES as readonly string[]).includes(body.role)) {
        throw new Error('Identity returned an unknown role');
      }
      value = { role: body.role as Role, scope: body.scope };
    } else {
      throw new Error(`Membership lookup failed with status ${res.status}`);
    }

    this.cache.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    return value;
  }
}

export interface AuthenticatedCaller {
  personId: string;
  tenantId?: string;
  /** Undefined when the caller is not a member of tenantId (or no tenant was requested). */
  role?: Role;
  scope?: MembershipRole['scope'];
  /** 'token' in normal operation; 'test-headers' only under NODE_ENV=test. */
  via: 'token' | 'test-headers';
}

type HeaderBag = Record<string, string | string[] | undefined>;

function headerValue(headers: HeaderBag, name: string): string | undefined {
  const v = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(v) ? v[0] : v;
}

export class RequestAuthenticator {
  constructor(
    private readonly options: {
      jwtSecret: string;
      roleLookup: MembershipRoleLookup;
      /** Only true under NODE_ENV=test. See trustTestHeaders(). */
      trustTestHeaders: boolean;
    }
  ) {}

  async authenticate(headers: HeaderBag): Promise<AuthenticatedCaller> {
    const authorization = headerValue(headers, 'authorization');
    const tenantId = headerValue(headers, 'x-tenant-id') || undefined;

    if (authorization && authorization.startsWith('Bearer ')) {
      const { personId } = verifyAccessToken(authorization.slice('Bearer '.length).trim(), this.options.jwtSecret);
      const membership = tenantId ? await this.options.roleLookup.getRole(personId, tenantId) : null;
      return { personId, tenantId, role: membership?.role, scope: membership?.scope, via: 'token' };
    }

    if (this.options.trustTestHeaders) {
      const role = headerValue(headers, 'x-user-role');
      return {
        personId: headerValue(headers, 'x-user-id') || headerValue(headers, 'x-person-id') || 'system',
        tenantId,
        role: role && (ROLES as readonly string[]).includes(role.toLowerCase()) ? (role.toLowerCase() as Role) : undefined,
        via: 'test-headers',
      };
    }

    throw new AuthenticationError('Sign in required');
  }

  /**
   * Replaces client-controlled identity headers with verified values, so any
   * controller that reads X-User-Id / X-User-Role directly sees only what the
   * token and membership lookup established.
   */
  static applyToHeaders(headers: HeaderBag, caller: AuthenticatedCaller): void {
    if (caller.via !== 'token') return;
    headers['x-user-id'] = caller.personId;
    delete headers['x-person-id'];
    if (caller.role) headers['x-user-role'] = caller.role;
    else delete headers['x-user-role'];
  }
}

/** Header-based identity is accepted only in automated tests. */
export function trustTestHeaders(nodeEnv: string | undefined): boolean {
  return nodeEnv === 'test';
}

/** Same non-production default as services/identity/src/config/env.ts, so tokens verify locally out of the box. */
export const DEV_JWT_SECRET = 'test-jwt-secret-key-at-least-32-chars-long-12345';

/**
 * Resolves the JWT secret for a service that verifies identity tokens.
 * Production requires an explicit JWT_SECRET (same value as identity's).
 */
export function resolveServiceJwtSecret(nodeEnv: string | undefined, jwtSecret: string | undefined): string {
  const secret = (jwtSecret || '').trim();
  if (nodeEnv === 'production') {
    if (secret.length < 32 || secret === DEV_JWT_SECRET) {
      throw new Error('JWT_SECRET (min 32 chars, not the development default) is required in production');
    }
    return secret;
  }
  return secret || DEV_JWT_SECRET;
}

export function createRequestAuthenticator(config: {
  nodeEnv: string;
  jwtSecret: string;
  identityApiUrl: string;
  internalServiceKey: string;
}): RequestAuthenticator {
  return new RequestAuthenticator({
    jwtSecret: config.jwtSecret,
    roleLookup: new HttpMembershipRoleLookup(config.identityApiUrl, config.internalServiceKey),
    trustTestHeaders: trustTestHeaders(config.nodeEnv),
  });
}
