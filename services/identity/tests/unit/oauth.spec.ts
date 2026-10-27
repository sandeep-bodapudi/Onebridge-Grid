import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { SignJWT, exportJWK, generateKeyPair, createLocalJWKSet, type JWTVerifyGetKey } from 'jose';
import { ConsoleEmailSender, FakeEventBus, FakeOtpSender } from '@onebridge/shared';
import { AuthService } from '../../src/application/auth.service';
import { GoogleOAuthVerifier } from '../../src/application/google-oauth-verifier';
import { GoogleSignInService } from '../../src/application/google-sign-in.service';
import { PasswordAuthService } from '../../src/application/password-auth.service';
import { InMemoryPersonRepository } from '../../src/infrastructure/repositories/in-memory-person.repository';
import { InMemorySessionRepository } from '../../src/infrastructure/repositories/in-memory-session.repository';
import { InMemoryOtpRepository } from '../../src/infrastructure/repositories/in-memory-otp.repository';
import { InMemoryEmailCodeRepository, InMemoryKnownDeviceRepository } from '../../src/infrastructure/repositories/in-memory-email-code.repository';
import { selectOAuthVerifier } from '../../src/identity.module';
import type { IdentityEnvConfig } from '../../src/config/env';

const CLIENT_ID = 'client-123.apps.googleusercontent.com';
let privateKey: CryptoKey;
let keys: JWTVerifyGetKey;
let otherPrivateKey: CryptoKey;

async function googleToken(claims: Record<string, unknown> = {}, opts: { aud?: string; iss?: string; exp?: string | number; key?: CryptoKey } = {}) {
  return new SignJWT({ email: 'meera@example.com', email_verified: true, name: 'Meera Iyer', ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setIssuer(opts.iss ?? 'https://accounts.google.com')
    .setAudience(opts.aud ?? CLIENT_ID)
    .setSubject((claims.sub as string) ?? 'google-sub-1')
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? '1h')
    .sign(opts.key ?? privateKey);
}

async function problemOf(p: Promise<unknown>): Promise<{ status: number; code?: string }> {
  try {
    await p;
  } catch (err) {
    const e = err as { getStatus(): number; getResponse(): { code?: string } };
    return { status: e.getStatus(), ...e.getResponse() };
  }
  throw new Error('expected a rejection');
}

beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  privateKey = pair.privateKey as CryptoKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  keys = createLocalJWKSet({ keys: [jwk] });
  otherPrivateKey = (await generateKeyPair('RS256')).privateKey as CryptoKey;
});

describe('D-AUTH-EMAIL Google ID token verifier (A6)', () => {
  let verifier: GoogleOAuthVerifier;
  beforeEach(() => {
    verifier = new GoogleOAuthVerifier(CLIENT_ID, keys);
  });

  it('accepts a valid token and returns the verified, lowercased email', async () => {
    const info = await verifier.verifyIdToken('google', await googleToken({ email: 'Meera@Example.com' }));
    expect(info).toEqual({ sub: 'google-sub-1', email: 'meera@example.com', emailVerified: true, name: 'Meera Iyer' });
  });

  it('accepts the short issuer form too', async () => {
    expect((await verifier.verifyIdToken('google', await googleToken({}, { iss: 'accounts.google.com' }))).sub).toBe('google-sub-1');
  });

  it('refuses a wrong audience, a wrong issuer, an expired token and a foreign signature', async () => {
    for (const token of [
      await googleToken({}, { aud: 'someone-else.apps.googleusercontent.com' }),
      await googleToken({}, { iss: 'https://evil.example' }),
      await googleToken({}, { exp: Math.floor(Date.now() / 1000) - 3600 }),
      await googleToken({}, { key: otherPrivateKey }),
      'not-a-jwt',
    ]) {
      expect(await problemOf(verifier.verifyIdToken('google', token))).toMatchObject({ status: 401, code: 'invalid_token' });
    }
  });

  it('refuses an unverified Google email', async () => {
    expect((await problemOf(verifier.verifyIdToken('google', await googleToken({ email_verified: false })))).code).toBe('invalid_token');
  });

  it('refuses other providers', async () => {
    expect((await problemOf(verifier.verifyIdToken('microsoft', await googleToken()))).code).toBe('method_disabled');
  });
});

describe('D-AUTH-EMAIL Continue with Google: accounts and linking (A6, D6)', () => {
  let persons: InMemoryPersonRepository;
  let mail: ConsoleEmailSender;
  let google: GoogleSignInService;
  const ctx = { deviceId: '', deviceLabel: 'Chrome', ip: '10.1.1.1' };

  beforeEach(() => {
    persons = new InMemoryPersonRepository();
    mail = new ConsoleEmailSender('test');
    const events = new FakeEventBus();
    const auth = new AuthService({ personRepo: persons, sessionRepo: new InMemorySessionRepository(), otpRepo: new InMemoryOtpRepository(), otpSender: new FakeOtpSender(), eventBus: events, jwtSecret: 'test-secret-key-32-chars-long-12345' });
    const passwords = new PasswordAuthService({ persons, codes: new InMemoryEmailCodeRepository(), devices: new InMemoryKnownDeviceRepository(), email: mail, auth, events, codeSecret: 's' });
    google = new GoogleSignInService(persons, passwords, auth, new GoogleOAuthVerifier(CLIENT_ID, keys));
  });

  it('creates an account with the verified Google email, then signs the same Google account in again', async () => {
    const first = await google.signIn(await googleToken(), ctx);
    expect(first.status).toBe('authenticated');
    const person = await persons.findByGoogleSub('google-sub-1');
    expect(person).toMatchObject({ email: 'meera@example.com', name: 'Meera Iyer', authProviders: ['google'] });
    expect(person?.emailVerifiedAt).toBeTruthy();
    expect(mail.sent).toHaveLength(0);

    const again = await google.signIn(await googleToken(), ctx);
    expect(again.userId).toBe(first.userId);
  });

  it('links automatically to an account whose email was already proven, and tells its owner', async () => {
    await persons.create({ userId: 'usr_pw', email: 'meera@example.com', authProviders: ['password'], mfa: { enabled: false }, emailVerifiedAt: '2026-10-01T00:00:00Z' });
    const res = await google.signIn(await googleToken(), ctx);
    expect(res).toMatchObject({ status: 'authenticated', userId: 'usr_pw' });
    expect((await persons.findById('usr_pw'))?.authProviders).toEqual(['password', 'google']);
    await new Promise((r) => setTimeout(r, 0));
    expect(mail.lastTo('meera@example.com')?.tag).toBe('google_linked');
  });

  it('asks for an emailed code before linking to an account whose email was never proven', async () => {
    await persons.create({ userId: 'usr_old', phone: '+919700000002', email: 'meera@example.com', authProviders: ['otp'], mfa: { enabled: false } });
    const res = await google.signIn(await googleToken(), ctx);
    expect(res).toMatchObject({ status: 'link_confirmation_required', maskedEmail: 'm•••@example.com' });
    expect(res.accessToken).toBeUndefined();
    expect((await persons.findById('usr_old'))?.googleSub).toBeUndefined();
    expect(mail.lastTo('meera@example.com')?.tag).toBe('link_code');

    const code = (mail.lastTo('meera@example.com')!.text.match(/\b(\d{6})\b/) as RegExpMatchArray)[1];
    expect((await problemOf(google.confirmLink(res.linkTicket!, code === '000000' ? '000001' : '000000', ctx))).code).toBe('code_invalid');
    const done = await google.confirmLink(res.linkTicket!, code, ctx);
    expect(done).toMatchObject({ status: 'authenticated', userId: 'usr_old' });
    const linked = await persons.findById('usr_old');
    expect(linked).toMatchObject({ googleSub: 'google-sub-1', authProviders: ['otp', 'google'] });
    expect(linked?.emailVerifiedAt).toBeTruthy();
  });

  it('is off when no verifier is configured', async () => {
    const off = new GoogleSignInService(persons, {} as PasswordAuthService, {} as AuthService, undefined);
    expect((await problemOf(off.signIn('token', ctx))).code).toBe('method_disabled');
  });
});

describe('D-AUTH-EMAIL Google verifier selection (A6 step 2)', () => {
  const base = { port: 4001, appUrl: '', mongoUri: '', allowRemoteSeed: false, jwtSecret: 'x', internalServiceKey: 'x', encryptionKey: 'x', cookieSecure: false, cookiePath: '/auth', enableFakeOtp: false, enableFakeOauth: false } as const;

  it('uses the real verifier with a client ID, the stand-in in development without one, and none when Google is off', () => {
    expect(selectOAuthVerifier({ ...base, nodeEnv: 'development', googleClientId: CLIENT_ID } as IdentityEnvConfig)?.constructor.name).toBe('GoogleOAuthVerifier');
    expect(selectOAuthVerifier({ ...base, nodeEnv: 'development' } as IdentityEnvConfig)?.constructor.name).toBe('FakeOAuthVerifier');
    expect(selectOAuthVerifier({ ...base, nodeEnv: 'production', authMethods: ['email'] } as IdentityEnvConfig)).toBeUndefined();
  });

  it('refuses to start production with Google on and no client ID', () => {
    expect(() => selectOAuthVerifier({ ...base, nodeEnv: 'production', authMethods: ['google', 'email'] } as IdentityEnvConfig)).toThrow(/GOOGLE_CLIENT_ID is required/);
  });
});
