import crypto from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { EmailSender, EmailTemplate, InMemoryRateLimiter, Logger, RateLimiter, maskEmail, renderEmail } from '@onebridge/shared';
import type { AuthService, IPersonRepository, VerifyOtpResult } from './auth.service.js';
import { Person } from '../domain/person.js';
import {
  CODE_TTL_MS,
  EmailCode,
  EmailCodePurpose,
  IEmailCodeRepository,
  IKnownDeviceRepository,
  MAX_CODE_ATTEMPTS,
  PendingSignup,
  RESEND_AFTER_MS,
  codeMatches,
  hashCode,
  newCode,
  newTicket,
  sha256,
} from '../domain/email-code.js';
import { PASSWORD_PROBLEM_TEXT, checkPasswordPolicy, hashPassword, verifyAgainstDummy, verifyPassword } from '../domain/password.js';

/** D-AUTH-EMAIL D4: a device needs a fresh email code after this long. */
export const DEVICE_CODE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const FIFTEEN_MIN = 15 * 60 * 1000;

/** An event bus that takes IDs-only events (the runner's shared in-process bus in production). */
interface EventPublisher {
  publish(event: { eventId: string; type: string; version: string; tenantId: string; occurredAt: string; correlationId: string; payload?: Record<string, unknown> }): Promise<void>;
}

export interface PasswordAuthDeps {
  persons: IPersonRepository;
  codes: IEmailCodeRepository;
  devices: IKnownDeviceRepository;
  email: EmailSender;
  auth: AuthService;
  events: EventPublisher;
  /** Server secret for code HMACs. */
  codeSecret: string;
  limiter?: RateLimiter;
  now?: () => Date;
  /** Demo and test builds only (ENABLE_FAKE_OTP): every email code is this value. */
  fixedCode?: string;
}

export interface CodeTicketResult {
  status: 'code_sent';
  ticket: string;
  maskedEmail: string;
  resendAfterSeconds: number;
}

export type PasswordSignInResult = Omit<VerifyOtpResult, 'status'> & {
  status: VerifyOtpResult['status'] | 'code_required';
  ticket?: string;
  maskedEmail?: string;
};

export interface SignupInput {
  name: string;
  email: string;
  password: string;
  acceptedTermsVersion: string;
  acceptedPrivacyVersion: string;
  language?: 'en' | 'hi';
}

export interface DeviceContext {
  /** Raw value of the ob_device cookie; only its hash is stored. */
  deviceId: string;
  deviceLabel: string;
  ip: string;
  correlationId?: string;
}

function problem(status: number, title: string, detail: string, code: string, extra: Record<string, unknown> = {}): HttpException {
  return new HttpException({ title, detail, code, ...extra }, status);
}

const TEMPLATE_FOR: Record<EmailCodePurpose, EmailTemplate> = {
  signup: 'verification_code',
  login: 'login_code',
  reset: 'password_reset_code',
  link: 'link_code',
};

export function normaliseEmail(email: unknown): string {
  const value = String(email ?? '').trim().toLowerCase();
  if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw problem(400, 'Bad Request', 'Enter a valid email address.', 'invalid_email');
  }
  return value;
}

/**
 * D-AUTH-EMAIL (VPS plan A5): email + password sign-up, sign-in with a new-device code,
 * forgot / reset / change password. Sessions come from AuthService, so refresh cookies,
 * session lists and sign-out behave exactly like the phone flow.
 */
export class PasswordAuthService {
  private readonly limiter: RateLimiter;
  private readonly now: () => Date;

  constructor(private readonly deps: PasswordAuthDeps) {
    this.limiter = deps.limiter ?? new InMemoryRateLimiter();
    this.now = deps.now ?? (() => new Date());
  }

  // ---- codes -------------------------------------------------------------

  private limit(key: string, limit: number, windowMs: number): void {
    const res = this.limiter.consume(key, { limit, windowMs });
    if (!res.allowed) {
      const retryAfterSeconds = Math.max(1, Math.ceil((res.retryAfterMs ?? windowMs) / 1000));
      throw problem(429, 'Too Many Requests', `Too many attempts. Try again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).`, 'rate_limited', { retryAfterSeconds });
    }
  }

  /** 5 code emails per address and 20 per network, per hour. */
  limitSends(email: string, ip: string): void {
    this.limit(`code-email:${email}`, 5, HOUR);
    this.limit(`code-ip:${ip}`, 20, HOUR);
  }

  private async sendCodeEmail(purpose: EmailCodePurpose, email: string, code: string, name?: string, language?: string): Promise<void> {
    try {
      await this.deps.email.send(renderEmail(TEMPLATE_FOR[purpose], email, { code, name, minutes: CODE_TTL_MS / 60_000 }, language));
    } catch (err) {
      Logger.error('Code email failed', { tag: TEMPLATE_FOR[purpose], reason: err instanceof Error ? err.message : 'unknown' });
      throw problem(503, 'Service Unavailable', "We couldn't send the email just now. Try again in a minute.", 'email_failed');
    }
  }

  /** A10: security notices never block or fail the sign-in itself. */
  notify(template: EmailTemplate, person: Person, vars: { device?: string } = {}): void {
    if (!person.email) return;
    this.deps.email.send(renderEmail(template, person.email, { name: person.name, ...vars }, person.language)).catch((err: unknown) => {
      Logger.warn('Security email failed', { tag: template, reason: err instanceof Error ? err.message : 'unknown' });
    });
  }

  /** Emails a fresh code for `purpose`. Callers run limitSends first. */
  async issueCode(
    purpose: EmailCodePurpose,
    email: string,
    extra: Partial<Pick<EmailCode, 'personId' | 'pending' | 'deviceIdHash' | 'deviceLabel' | 'googleSub' | 'googleName'>> = {},
    who: { name?: string; language?: string } = {}
  ): Promise<CodeTicketResult> {
    const ticket = newTicket();
    const code = this.deps.fixedCode ?? newCode();
    const now = this.now();
    await this.deps.codes.insert({
      id: `ec_${crypto.randomUUID()}`,
      ticketHash: sha256(ticket),
      purpose,
      email,
      codeHash: hashCode(code, this.deps.codeSecret),
      attempts: 0,
      sentCount: 1,
      lastSentAt: now,
      expiresAt: new Date(now.getTime() + CODE_TTL_MS),
      ...extra,
    });
    await this.sendCodeEmail(purpose, email, code, who.name, who.language);
    return { status: 'code_sent', ticket, maskedEmail: maskEmail(email), resendAfterSeconds: RESEND_AFTER_MS / 1000 };
  }

  /** Same shape as a real ticket, for answers that must not reveal whether an account exists. */
  private decoyTicket(email: string): CodeTicketResult {
    return { status: 'code_sent', ticket: newTicket(), maskedEmail: maskEmail(email), resendAfterSeconds: RESEND_AFTER_MS / 1000 };
  }

  /** Checks a code and consumes it. Wrong codes count; the fifth ends the code. */
  async consumeCode(ticket: string, code: string, purpose: EmailCodePurpose): Promise<EmailCode> {
    const rec = typeof ticket === 'string' && ticket ? await this.deps.codes.findByTicketHash(sha256(ticket)) : undefined;
    const now = this.now();
    if (!rec || rec.purpose !== purpose || rec.consumedAt || rec.expiresAt.getTime() <= now.getTime()) {
      throw problem(400, 'Bad Request', 'This code has expired. Ask for a new one.', 'code_expired');
    }
    if (rec.attempts >= MAX_CODE_ATTEMPTS) {
      throw problem(400, 'Bad Request', 'Too many wrong codes. Ask for a new one.', 'too_many_attempts');
    }
    if (!/^[0-9]{6}$/.test(String(code)) || !codeMatches(String(code), rec.codeHash, this.deps.codeSecret)) {
      rec.attempts += 1;
      if (rec.attempts >= MAX_CODE_ATTEMPTS) rec.consumedAt = now;
      await this.deps.codes.update(rec);
      if (rec.attempts >= MAX_CODE_ATTEMPTS) throw problem(400, 'Bad Request', 'Too many wrong codes. Ask for a new one.', 'too_many_attempts');
      throw problem(400, 'Bad Request', "That code isn't right. Check the email and try again.", 'code_invalid');
    }
    if (!(await this.deps.codes.markConsumed(rec.id, now))) {
      throw problem(400, 'Bad Request', 'This code has expired. Ask for a new one.', 'code_expired');
    }
    return { ...rec, consumedAt: now };
  }

  async resendCode(ticket: string, ip: string): Promise<CodeTicketResult> {
    const rec = typeof ticket === 'string' && ticket ? await this.deps.codes.findByTicketHash(sha256(ticket)) : undefined;
    const now = this.now();
    if (!rec || rec.consumedAt || rec.expiresAt.getTime() <= now.getTime()) {
      throw problem(400, 'Bad Request', 'This code has expired. Start again.', 'code_expired');
    }
    const wait = rec.lastSentAt.getTime() + RESEND_AFTER_MS - now.getTime();
    if (wait > 0) {
      const retryAfterSeconds = Math.ceil(wait / 1000);
      throw problem(429, 'Too Many Requests', `Wait ${retryAfterSeconds} seconds before asking for another code.`, 'rate_limited', { retryAfterSeconds });
    }
    this.limitSends(rec.email, ip);
    const code = this.deps.fixedCode ?? newCode();
    await this.deps.codes.update({
      ...rec,
      codeHash: hashCode(code, this.deps.codeSecret),
      attempts: 0,
      sentCount: rec.sentCount + 1,
      lastSentAt: now,
      expiresAt: new Date(now.getTime() + CODE_TTL_MS),
    });
    const person = rec.personId ? await this.deps.persons.findById(rec.personId) : undefined;
    await this.sendCodeEmail(rec.purpose, rec.email, code, person?.name ?? rec.pending?.name, person?.language ?? rec.pending?.language);
    return { status: 'code_sent', ticket, maskedEmail: maskEmail(rec.email), resendAfterSeconds: RESEND_AFTER_MS / 1000 };
  }

  // ---- sign-up -----------------------------------------------------------

  private checkPassword(password: unknown, who: { email?: string; name?: string }): string {
    if (typeof password !== 'string') throw problem(400, 'Bad Request', PASSWORD_PROBLEM_TEXT.too_short, 'weak_password');
    const issue = checkPasswordPolicy(password, who);
    if (issue) throw problem(400, 'Bad Request', PASSWORD_PROBLEM_TEXT[issue], 'weak_password', { reason: issue });
    return password;
  }

  async signup(input: SignupInput, ip: string): Promise<CodeTicketResult> {
    const email = normaliseEmail(input?.email);
    const name = String(input?.name ?? '').trim();
    if (!name || name.length > 120) throw problem(400, 'Bad Request', 'Enter your name.', 'invalid_name');
    if (!input.acceptedTermsVersion || !input.acceptedPrivacyVersion) {
      throw problem(400, 'Bad Request', 'Accept the terms and the privacy policy to continue.', 'consent_required');
    }
    const password = this.checkPassword(input.password, { email, name });
    const language = input.language === 'hi' ? 'hi' : 'en';
    // Limits come before scrypt, so a limited caller cannot make the server hash for free.
    this.limitSends(email, ip);

    const existing = await this.deps.persons.findByEmail(email);
    if (existing && (existing.emailVerifiedAt || existing.passwordHash || existing.googleSub)) {
      // No enumeration: the same answer, and the owner is told instead of getting a code.
      this.notify('signup_on_existing_account', existing);
      return this.decoyTicket(email);
    }
    const pending: PendingSignup = {
      name,
      passwordHash: await hashPassword(password),
      acceptedTermsVersion: String(input.acceptedTermsVersion),
      acceptedPrivacyVersion: String(input.acceptedPrivacyVersion),
      language,
    };
    return this.issueCode('signup', email, { pending, personId: existing?.userId }, { name, language });
  }

  async verifySignup(ticket: string, code: string, ctx: DeviceContext): Promise<PasswordSignInResult> {
    const rec = await this.consumeCode(ticket, code, 'signup');
    if (!rec.pending) throw problem(400, 'Bad Request', 'This code has expired. Start again.', 'code_expired');
    const nowIso = this.now().toISOString();
    let person = await this.deps.persons.findByEmail(rec.email);
    if (person && (person.passwordHash || person.googleSub)) {
      // Someone finished another sign-up for this email meanwhile: never overwrite it.
      throw problem(409, 'Conflict', 'An account with this email already exists. Sign in instead.', 'account_exists');
    }
    if (person) {
      // An older account (phone or invite) with this unproven email: the code proves it.
      person.passwordHash = rec.pending.passwordHash;
      person.passwordUpdatedAt = nowIso;
      person.emailVerifiedAt = nowIso;
      person.name = person.name || rec.pending.name;
      person.language = rec.pending.language;
      person.authProviders = Array.from(new Set([...(person.authProviders || []), 'password' as const]));
      await this.deps.persons.update(person);
    } else {
      person = await this.deps.persons.create({
        userId: `usr_${crypto.randomBytes(12).toString('hex')}`,
        email: rec.email,
        name: rec.pending.name,
        authProviders: ['password'],
        mfa: { enabled: false },
        emailVerifiedAt: nowIso,
        passwordHash: rec.pending.passwordHash,
        passwordUpdatedAt: nowIso,
        language: rec.pending.language,
      });
      await this.publish('user.registered', person.userId, ctx.correlationId, {
        method: 'password',
        termsVersion: rec.pending.acceptedTermsVersion,
        privacyVersion: rec.pending.acceptedPrivacyVersion,
      });
    }
    await this.rememberDevice(person.userId, ctx, true);
    return this.deps.auth.signInPerson(person, ctx.deviceLabel, ctx.ip, ctx.correlationId);
  }

  // ---- sign-in -----------------------------------------------------------

  private async rememberDevice(personId: string, ctx: DeviceContext, codeJustEntered: boolean): Promise<void> {
    if (!ctx.deviceId) return;
    const now = this.now();
    const deviceIdHash = sha256(ctx.deviceId);
    const existing = await this.deps.devices.find(personId, deviceIdHash);
    await this.deps.devices.upsert({
      personId,
      deviceIdHash,
      label: ctx.deviceLabel.slice(0, 200),
      lastCodeAt: codeJustEntered ? now : (existing?.lastCodeAt ?? now),
      lastSeenAt: now,
    });
  }

  private invalidCredentials(): HttpException {
    return problem(401, 'Unauthorized', "That email and password don't match. Try again or reset your password.", 'invalid_credentials');
  }

  async login(input: { email: string; password: string }, ctx: DeviceContext): Promise<PasswordSignInResult> {
    const email = normaliseEmail(input?.email);
    const password = typeof input?.password === 'string' ? input.password : '';
    // Failures are limited per account and per network; a success clears the account's count.
    const accountKey = `login-fail:${email}`;
    const ipKey = `login-fail-ip:${ctx.ip}`;
    this.assertNotLocked(accountKey, 5, FIFTEEN_MIN);
    this.assertNotLocked(ipKey, 30, FIFTEEN_MIN);

    const person = await this.deps.persons.findByEmail(email);
    const ok = person?.passwordHash && password ? await verifyPassword(password, person.passwordHash) : await verifyAgainstDummy(password);
    if (!person || !ok) {
      this.limiter.consume(accountKey, { limit: 5, windowMs: FIFTEEN_MIN });
      this.limiter.consume(ipKey, { limit: 30, windowMs: FIFTEEN_MIN });
      throw this.invalidCredentials();
    }
    this.limiter.reset(accountKey);

    const device = ctx.deviceId ? await this.deps.devices.find(person.userId, sha256(ctx.deviceId)) : undefined;
    const fresh = device && this.now().getTime() - new Date(device.lastCodeAt).getTime() < DEVICE_CODE_MAX_AGE_MS;
    if (!fresh || !person.emailVerifiedAt) {
      // D4: a new device, 30 days without a code there, or an unproven email: confirm by email first.
      this.limitSends(email, ctx.ip);
      const sent = await this.issueCode(
        'login',
        email,
        { personId: person.userId, deviceIdHash: ctx.deviceId ? sha256(ctx.deviceId) : undefined, deviceLabel: ctx.deviceLabel.slice(0, 200) },
        { name: person.name, language: person.language }
      );
      return { status: 'code_required', userId: person.userId, ticket: sent.ticket, maskedEmail: sent.maskedEmail };
    }
    await this.rememberDevice(person.userId, ctx, false);
    return this.deps.auth.signInPerson(person, ctx.deviceLabel, ctx.ip, ctx.correlationId);
  }

  /** Refuses while a failure counter is over its limit; checking does not count as a failure. */
  private assertNotLocked(key: string, limit: number, windowMs: number): void {
    const res = this.limiter.peek(key, { limit, windowMs });
    if (!res.allowed) {
      const retryAfterSeconds = Math.max(1, Math.ceil((res.retryAfterMs ?? windowMs) / 1000));
      throw problem(429, 'Too Many Requests', `Too many attempts. Try again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).`, 'rate_limited', { retryAfterSeconds });
    }
  }

  async verifyLogin(ticket: string, code: string, ctx: DeviceContext): Promise<PasswordSignInResult> {
    const rec = await this.consumeCode(ticket, code, 'login');
    const person = rec.personId ? await this.deps.persons.findById(rec.personId) : undefined;
    if (!person) throw problem(400, 'Bad Request', 'This code has expired. Sign in again.', 'code_expired');
    if (!person.emailVerifiedAt) {
      person.emailVerifiedAt = this.now().toISOString();
      await this.deps.persons.update(person);
    }
    const label = rec.deviceLabel || ctx.deviceLabel;
    await this.rememberDevice(person.userId, { ...ctx, deviceLabel: label }, true);
    this.notify('new_device_sign_in', person, { device: label });
    return this.deps.auth.signInPerson(person, label, ctx.ip, ctx.correlationId);
  }

  // ---- passwords ---------------------------------------------------------

  async forgotPassword(emailInput: string, ip: string): Promise<CodeTicketResult> {
    const email = normaliseEmail(emailInput);
    this.limitSends(email, ip);
    const person = await this.deps.persons.findByEmail(email);
    if (!person) return this.decoyTicket(email);
    return this.issueCode('reset', email, { personId: person.userId }, { name: person.name, language: person.language });
  }

  async resetPassword(ticket: string, code: string, newPassword: string, correlationId?: string): Promise<void> {
    const rec = await this.consumeCode(ticket, code, 'reset');
    const person = rec.personId ? await this.deps.persons.findById(rec.personId) : undefined;
    if (!person) throw problem(400, 'Bad Request', 'This code has expired. Start again.', 'code_expired');
    const password = this.checkPassword(newPassword, { email: person.email, name: person.name });
    await this.setPassword(person, password);
    // The code proved the email, and a reset means the old password may be known: sign out everywhere.
    await this.deps.auth.revokeAllSessions(person.userId);
    this.notify('password_changed', person);
    await this.publish('auth.password_changed', person.userId, correlationId);
  }

  async changePassword(userId: string, currentFamilyId: string | undefined, currentPassword: string, newPassword: string, correlationId?: string): Promise<void> {
    const person = await this.deps.persons.findById(userId);
    const ok = person?.passwordHash && typeof currentPassword === 'string' ? await verifyPassword(currentPassword, person.passwordHash) : false;
    if (!person || !ok) {
      throw problem(400, 'Bad Request', "Your current password isn't right.", 'invalid_credentials');
    }
    const password = this.checkPassword(newPassword, { email: person.email, name: person.name });
    await this.setPassword(person, password);
    await this.deps.auth.revokeAllSessions(person.userId, currentFamilyId);
    this.notify('password_changed', person);
    await this.publish('auth.password_changed', person.userId, correlationId);
  }

  private async setPassword(person: Person, password: string): Promise<void> {
    const nowIso = this.now().toISOString();
    person.passwordHash = await hashPassword(password);
    person.passwordUpdatedAt = nowIso;
    person.emailVerifiedAt = person.emailVerifiedAt || nowIso;
    person.authProviders = Array.from(new Set([...(person.authProviders || []), 'password' as const]));
    await this.deps.persons.update(person);
  }

  private async publish(type: string, userId: string, correlationId = 'unknown', extra: Record<string, unknown> = {}): Promise<void> {
    await this.deps.events.publish({
      eventId: crypto.randomUUID(),
      type,
      version: '1.0.0',
      tenantId: 'global',
      occurredAt: this.now().toISOString(),
      correlationId,
      payload: { userId, ...extra },
    });
  }
}
