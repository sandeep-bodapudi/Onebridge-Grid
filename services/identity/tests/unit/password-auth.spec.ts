import { describe, it, expect, beforeEach } from 'vitest';
import { ConsoleEmailSender, FakeEventBus, FakeOtpSender } from '@onebridge/shared';
import { AuthService } from '../../src/application/auth.service';
import { PasswordAuthService } from '../../src/application/password-auth.service';
import { InMemoryPersonRepository } from '../../src/infrastructure/repositories/in-memory-person.repository';
import { InMemorySessionRepository } from '../../src/infrastructure/repositories/in-memory-session.repository';
import { InMemoryOtpRepository } from '../../src/infrastructure/repositories/in-memory-otp.repository';
import { InMemoryEmailCodeRepository, InMemoryKnownDeviceRepository } from '../../src/infrastructure/repositories/in-memory-email-code.repository';
import { hashPassword } from '../../src/domain/password';

const PASSWORD = 'a long enough passphrase';
const CONSENT = { acceptedTermsVersion: '2026-10', acceptedPrivacyVersion: '2026-10' };

function lastCode(mail: ConsoleEmailSender, to: string): string {
  const text = mail.lastTo(to)?.text ?? '';
  const m = text.match(/\b(\d{6})\b/);
  if (!m) throw new Error(`no code in the last email to ${to}`);
  return m[1];
}

async function rejects(p: Promise<unknown>): Promise<{ status: number; code?: string; retryAfterSeconds?: number }> {
  try {
    await p;
  } catch (err) {
    const e = err as { getStatus(): number; getResponse(): { code?: string; retryAfterSeconds?: number } };
    return { status: e.getStatus(), ...e.getResponse() };
  }
  throw new Error('expected a rejection');
}

describe('D-AUTH-EMAIL email + password sign-in (A5)', () => {
  let persons: InMemoryPersonRepository;
  let sessions: InMemorySessionRepository;
  let devices: InMemoryKnownDeviceRepository;
  let codes: InMemoryEmailCodeRepository;
  let mail: ConsoleEmailSender;
  let events: FakeEventBus;
  let auth: AuthService;
  let svc: PasswordAuthService;
  let clock: Date;
  let ipCounter = 0;
  // A fresh network per test keeps the per-network limit out of tests that are not about it.
  let ip: string;
  const device = (id = 'device-1') => ({ deviceId: id, deviceLabel: 'Chrome on Windows', ip });

  beforeEach(() => {
    persons = new InMemoryPersonRepository();
    sessions = new InMemorySessionRepository();
    devices = new InMemoryKnownDeviceRepository();
    codes = new InMemoryEmailCodeRepository();
    mail = new ConsoleEmailSender('test');
    events = new FakeEventBus();
    clock = new Date('2026-10-27T10:00:00Z');
    ip = `10.0.0.${++ipCounter}`;
    auth = new AuthService({ personRepo: persons, sessionRepo: sessions, otpRepo: new InMemoryOtpRepository(), otpSender: new FakeOtpSender(), eventBus: events, jwtSecret: 'test-secret-key-32-chars-long-12345' });
    svc = new PasswordAuthService({ persons, codes, devices, email: mail, auth, events, codeSecret: 'code-secret', now: () => clock });
  });

  async function signUp(email = 'meera@example.com', name = 'Meera Iyer') {
    const sent = await svc.signup({ name, email, password: PASSWORD, ...CONSENT }, ip);
    return svc.verifySignup(sent.ticket, lastCode(mail, email.trim().toLowerCase()), device());
  }

  describe('sign-up', () => {
    it('emails a code and creates the account only when the code is entered', async () => {
      const sent = await svc.signup({ name: 'Meera Iyer', email: ' Meera@Example.com ', password: PASSWORD, ...CONSENT }, ip);
      expect(sent).toMatchObject({ status: 'code_sent', maskedEmail: 'm•••@example.com', resendAfterSeconds: 60 });
      expect(mail.lastTo('meera@example.com')?.tag).toBe('verification_code');
      expect(await persons.findByEmail('meera@example.com')).toBeUndefined();

      const result = await svc.verifySignup(sent.ticket, lastCode(mail, 'meera@example.com'), device());
      expect(result.status).toBe('authenticated');
      expect(result.accessToken).toBeTruthy();
      const person = await persons.findByEmail('meera@example.com');
      expect(person).toMatchObject({ email: 'meera@example.com', name: 'Meera Iyer', authProviders: ['password'] });
      expect(person?.emailVerifiedAt).toBeTruthy();
      expect(person?.passwordHash).toMatch(/^scrypt\$/);
    });

    it('publishes IDs and consent versions only', async () => {
      await signUp();
      const registered = events.calls.filter((c) => c.name === 'publish').map((c) => (c.args as { event: { type: string } }).event).find((e) => e.type === 'user.registered');
      expect(registered).toBeDefined();
      const text = JSON.stringify(registered);
      expect(text).not.toContain('meera@example.com');
      expect(text).not.toContain(PASSWORD);
      expect(text).toContain('2026-10');
    });

    it('gives a taken email the same answer and tells its owner instead of sending a code', async () => {
      await signUp();
      const before = mail.sent.length;
      const again = await svc.signup({ name: 'Someone', email: 'meera@example.com', password: 'another passphrase', ...CONSENT }, ip);
      expect(again).toMatchObject({ status: 'code_sent', maskedEmail: 'm•••@example.com' });
      await new Promise((r) => setTimeout(r, 0));
      expect(mail.sent.length).toBe(before + 1);
      expect(mail.lastTo('meera@example.com')?.tag).toBe('signup_on_existing_account');
      expect(mail.lastTo('meera@example.com')?.text).not.toMatch(/\b\d{6}\b/);
      expect((await rejects(svc.verifySignup(again.ticket, '000000', device()))).code).toBe('code_expired');
    });

    it('refuses weak passwords, a missing name and missing consent', async () => {
      expect(await rejects(svc.signup({ name: 'Meera', email: 'meera@example.com', password: 'short', ...CONSENT }, ip))).toMatchObject({ status: 400, code: 'weak_password' });
      expect(await rejects(svc.signup({ name: 'Meera', email: 'meera@example.com', password: 'meera@example.com', ...CONSENT }, ip))).toMatchObject({ code: 'weak_password' });
      expect(await rejects(svc.signup({ name: ' ', email: 'meera@example.com', password: PASSWORD, ...CONSENT }, ip))).toMatchObject({ code: 'invalid_name' });
      expect(await rejects(svc.signup({ name: 'Meera', email: 'not-an-email', password: PASSWORD, ...CONSENT }, ip))).toMatchObject({ code: 'invalid_email' });
      expect(await rejects(svc.signup({ name: 'Meera', email: 'meera@example.com', password: PASSWORD, acceptedTermsVersion: '', acceptedPrivacyVersion: '2026-10' }, ip))).toMatchObject({ code: 'consent_required' });
    });

    it('lets an older account with this unproven email add a password once the code proves it', async () => {
      await persons.create({ userId: 'usr_old', phone: '+919700000001', email: 'meera@example.com', authProviders: ['otp'], mfa: { enabled: false } });
      const sent = await svc.signup({ name: 'Meera', email: 'meera@example.com', password: PASSWORD, ...CONSENT }, ip);
      const result = await svc.verifySignup(sent.ticket, lastCode(mail, 'meera@example.com'), device());
      expect(result.userId).toBe('usr_old');
      const person = await persons.findById('usr_old');
      expect(person?.authProviders).toEqual(['otp', 'password']);
      expect(person?.phone).toBe('+919700000001');
    });
  });

  describe('codes', () => {
    it('ends a code after 5 wrong tries', async () => {
      const sent = await svc.signup({ name: 'Meera', email: 'meera@example.com', password: PASSWORD, ...CONSENT }, ip);
      const right = lastCode(mail, 'meera@example.com');
      const wrong = right === '000000' ? '000001' : '000000';
      for (let i = 0; i < 4; i++) expect((await rejects(svc.verifySignup(sent.ticket, wrong, device()))).code).toBe('code_invalid');
      expect((await rejects(svc.verifySignup(sent.ticket, wrong, device()))).code).toBe('too_many_attempts');
      expect((await rejects(svc.verifySignup(sent.ticket, right, device()))).code).toBe('code_expired');
    });

    it('expires a code after 10 minutes', async () => {
      const sent = await svc.signup({ name: 'Meera', email: 'meera@example.com', password: PASSWORD, ...CONSENT }, ip);
      clock = new Date(clock.getTime() + 10 * 60_000 + 1);
      expect((await rejects(svc.verifySignup(sent.ticket, lastCode(mail, 'meera@example.com'), device()))).code).toBe('code_expired');
    });

    it('resends only after 60 seconds, and the new code replaces the old one', async () => {
      const sent = await svc.signup({ name: 'Meera', email: 'meera@example.com', password: PASSWORD, ...CONSENT }, ip);
      const first = lastCode(mail, 'meera@example.com');
      expect(await rejects(svc.resendCode(sent.ticket, ip))).toMatchObject({ status: 429, code: 'rate_limited', retryAfterSeconds: 60 });
      clock = new Date(clock.getTime() + 61_000);
      await svc.resendCode(sent.ticket, ip);
      const second = lastCode(mail, 'meera@example.com');
      if (second !== first) expect((await rejects(svc.verifySignup(sent.ticket, first, device()))).code).toBe('code_invalid');
      expect((await svc.verifySignup(sent.ticket, second, device())).status).toBe('authenticated');
    });

    it('sends at most 5 codes per email and 20 per network in an hour', async () => {
      for (let i = 0; i < 5; i++) await svc.signup({ name: 'Meera', email: 'meera@example.com', password: PASSWORD, ...CONSENT }, ip);
      expect(await rejects(svc.signup({ name: 'Meera', email: 'meera@example.com', password: PASSWORD, ...CONSENT }, ip))).toMatchObject({ status: 429, code: 'rate_limited' });

      const busyNetwork = '10.9.9.9';
      for (let i = 0; i < 20; i++) await svc.signup({ name: 'P', email: `person${i}@example.com`, password: PASSWORD, ...CONSENT }, busyNetwork);
      expect((await rejects(svc.signup({ name: 'P', email: 'person99@example.com', password: PASSWORD, ...CONSENT }, busyNetwork))).code).toBe('rate_limited');
    }, 30_000); // 25 scrypt hashes

    it('never accepts a code meant for something else', async () => {
      await signUp();
      const reset = await svc.forgotPassword('meera@example.com', ip);
      expect((await rejects(svc.verifyLogin(reset.ticket, lastCode(mail, 'meera@example.com'), device()))).code).toBe('code_expired');
    });

    it('lets only one of two requests use the same code', async () => {
      const sent = await svc.signup({ name: 'Meera', email: 'meera@example.com', password: PASSWORD, ...CONSENT }, ip);
      const code = lastCode(mail, 'meera@example.com');
      const [a, b] = await Promise.allSettled([svc.consumeCode(sent.ticket, code, 'signup'), svc.consumeCode(sent.ticket, code, 'signup')]);
      expect([a.status, b.status].sort()).toEqual(['fulfilled', 'rejected']);
    });
  });

  describe('sign-in', () => {
    it('gives the same error for an unknown email and a wrong password', async () => {
      await signUp();
      const unknown = await rejects(svc.login({ email: 'nobody@example.com', password: PASSWORD }, device()));
      const wrong = await rejects(svc.login({ email: 'meera@example.com', password: 'wrong passphrase!' }, device()));
      expect(unknown).toMatchObject({ status: 401, code: 'invalid_credentials' });
      expect(wrong).toEqual(unknown);
    });

    it('signs in on the device that entered the sign-up code without another code', async () => {
      await signUp();
      const result = await svc.login({ email: 'MEERA@example.com', password: PASSWORD }, device());
      expect(result.status).toBe('authenticated');
    });

    it('asks a new device for an emailed code, then remembers it and sends a notice', async () => {
      await signUp();
      const first = await svc.login({ email: 'meera@example.com', password: PASSWORD }, device('laptop-2'));
      expect(first).toMatchObject({ status: 'code_required', maskedEmail: 'm•••@example.com' });
      expect(first.accessToken).toBeUndefined();
      expect(mail.lastTo('meera@example.com')?.tag).toBe('login_code');

      const done = await svc.verifyLogin(first.ticket!, lastCode(mail, 'meera@example.com'), device('laptop-2'));
      expect(done.status).toBe('authenticated');
      await new Promise((r) => setTimeout(r, 0));
      expect(mail.lastTo('meera@example.com')?.tag).toBe('new_device_sign_in');

      expect((await svc.login({ email: 'meera@example.com', password: PASSWORD }, device('laptop-2'))).status).toBe('authenticated');
    });

    it('asks for a code again after 30 days without one on that device', async () => {
      await signUp();
      clock = new Date(clock.getTime() + 31 * 24 * 60 * 60 * 1000);
      expect((await svc.login({ email: 'meera@example.com', password: PASSWORD }, device())).status).toBe('code_required');
    });

    it('locks an account for 15 minutes after 5 wrong passwords, and a success clears the count', async () => {
      await signUp();
      for (let i = 0; i < 4; i++) await rejects(svc.login({ email: 'meera@example.com', password: 'wrong passphrase!' }, device()));
      expect((await svc.login({ email: 'meera@example.com', password: PASSWORD }, device())).status).toBe('authenticated');
      for (let i = 0; i < 5; i++) await rejects(svc.login({ email: 'meera@example.com', password: 'wrong passphrase!' }, device()));
      const locked = await rejects(svc.login({ email: 'meera@example.com', password: PASSWORD }, device()));
      expect(locked).toMatchObject({ status: 429, code: 'rate_limited' });
      expect(locked.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('still asks for MFA after the password and code when TOTP is on', async () => {
      await persons.create({
        userId: 'usr_mfa',
        email: 'owner@example.com',
        authProviders: ['password'],
        mfa: { enabled: true, secret: 'JBSWY3DPEHPK3PXP' },
        emailVerifiedAt: '2026-10-01T00:00:00Z',
        passwordHash: await hashPassword(PASSWORD),
      });
      const first = await svc.login({ email: 'owner@example.com', password: PASSWORD }, device());
      const done = await svc.verifyLogin(first.ticket!, lastCode(mail, 'owner@example.com'), device());
      expect(done.status).toBe('mfa_required');
      expect(done.mfaTicket).toBeTruthy();
      expect(done.accessToken).toBeUndefined();
    });
  });

  describe('passwords', () => {
    it('answers forgot-password the same for unknown emails and sends nothing', async () => {
      const res = await svc.forgotPassword('nobody@example.com', ip);
      expect(res).toMatchObject({ status: 'code_sent', maskedEmail: 'n•••@example.com' });
      expect(mail.sent).toHaveLength(0);
    });

    it('resets the password with the emailed code and signs out every session', async () => {
      const signedIn = await signUp();
      expect((await sessions.findSessionsByUserId(signedIn.userId)).total).toBe(1);
      const forgot = await svc.forgotPassword('meera@example.com', ip);
      expect(mail.lastTo('meera@example.com')?.tag).toBe('password_reset_code');
      expect(await rejects(svc.resetPassword(forgot.ticket, lastCode(mail, 'meera@example.com'), 'short'))).toMatchObject({ code: 'weak_password' });

      const again = await svc.forgotPassword('meera@example.com', ip);
      await svc.resetPassword(again.ticket, lastCode(mail, 'meera@example.com'), 'a brand new passphrase');
      expect((await sessions.findSessionsByUserId(signedIn.userId)).total).toBe(0);
      await new Promise((r) => setTimeout(r, 0));
      expect(mail.lastTo('meera@example.com')?.tag).toBe('password_changed');
      expect((await rejects(svc.login({ email: 'meera@example.com', password: PASSWORD }, device()))).code).toBe('invalid_credentials');
      expect((await svc.login({ email: 'meera@example.com', password: 'a brand new passphrase' }, device())).status).toBe('authenticated');
    });

    it('changes the password only with the current one, keeping this session and ending the others', async () => {
      const first = await signUp();
      await svc.login({ email: 'meera@example.com', password: PASSWORD }, device());
      const current = (await sessions.findSessionsByUserId(first.userId)).items[0];
      expect((await sessions.findSessionsByUserId(first.userId)).total).toBe(2);

      expect((await rejects(svc.changePassword(first.userId, current.familyId, 'wrong passphrase!', 'a brand new passphrase'))).code).toBe('invalid_credentials');
      await svc.changePassword(first.userId, current.familyId, PASSWORD, 'a brand new passphrase');
      const left = await sessions.findSessionsByUserId(first.userId);
      expect(left.items.map((s) => s.familyId)).toEqual([current.familyId]);
    });
  });
});
