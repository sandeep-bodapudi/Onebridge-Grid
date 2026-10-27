import crypto from 'node:crypto';
import { HttpException } from '@nestjs/common';
import type { AuthService, IPersonRepository } from './auth.service.js';
import type { IOAuthVerifier } from './oauth-verifier.js';
import type { DeviceContext, PasswordAuthService, PasswordSignInResult } from './password-auth.service.js';

export interface GoogleSignInResult extends PasswordSignInResult {
  linkTicket?: string;
}

/**
 * D-AUTH-EMAIL (VPS plan A6, D6): Continue with Google.
 * - A known Google account signs in.
 * - An account with the same email links automatically only if that email was already proven;
 *   otherwise the owner confirms with a code sent to that email (no masked phone any more).
 * - Otherwise a new account is created with the verified Google email.
 */
export class GoogleSignInService {
  constructor(
    private readonly persons: IPersonRepository,
    private readonly passwords: PasswordAuthService,
    private readonly auth: AuthService,
    private readonly verifier: IOAuthVerifier | undefined,
    private readonly now: () => Date = () => new Date()
  ) {}

  private requireVerifier(): IOAuthVerifier {
    if (!this.verifier) throw new HttpException({ title: 'Forbidden', detail: 'Google sign-in is turned off on this server.', code: 'method_disabled' }, 403);
    return this.verifier;
  }

  async signIn(idToken: string, ctx: DeviceContext): Promise<GoogleSignInResult> {
    const profile = await this.requireVerifier().verifyIdToken('google', idToken);
    const email = profile.email!.toLowerCase();

    const known = await this.persons.findByGoogleSub(profile.sub);
    if (known) return this.auth.signInPerson(known, ctx.deviceLabel, ctx.ip, ctx.correlationId);

    const existing = await this.persons.findByEmail(email);
    if (existing) {
      if (existing.emailVerifiedAt) {
        existing.googleSub = profile.sub;
        existing.authProviders = Array.from(new Set([...(existing.authProviders || []), 'google' as const]));
        await this.persons.update(existing);
        this.passwords.notify('google_linked', existing);
        return this.auth.signInPerson(existing, ctx.deviceLabel, ctx.ip, ctx.correlationId);
      }
      // The email on this account was never proven: its owner confirms by email before Google is added.
      this.passwords.limitSends(email, ctx.ip);
      const sent = await this.passwords.issueCode('link', email, { personId: existing.userId, googleSub: profile.sub, googleName: profile.name }, { name: existing.name, language: existing.language });
      return { status: 'link_confirmation_required', userId: existing.userId, linkTicket: sent.ticket, maskedEmail: sent.maskedEmail };
    }

    const nowIso = this.now().toISOString();
    const person = await this.persons.create({
      userId: `usr_${crypto.randomBytes(12).toString('hex')}`,
      email,
      name: profile.name || email.split('@')[0],
      authProviders: ['google'],
      mfa: { enabled: false },
      emailVerifiedAt: nowIso,
      googleSub: profile.sub,
    });
    return this.auth.signInPerson(person, ctx.deviceLabel, ctx.ip, ctx.correlationId);
  }

  async confirmLink(linkTicket: string, code: string, ctx: DeviceContext): Promise<GoogleSignInResult> {
    this.requireVerifier();
    const rec = await this.passwords.consumeCode(linkTicket, code, 'link');
    const person = rec.personId ? await this.persons.findById(rec.personId) : undefined;
    if (!person || !rec.googleSub) throw new HttpException({ title: 'Bad Request', detail: 'This code has expired. Try Google again.', code: 'code_expired' }, 400);
    const holder = await this.persons.findByGoogleSub(rec.googleSub);
    if (holder && holder.userId !== person.userId) {
      throw new HttpException({ title: 'Conflict', detail: 'That Google account is already connected to another OneBridge account.', code: 'account_exists' }, 409);
    }
    person.googleSub = rec.googleSub;
    person.emailVerifiedAt = person.emailVerifiedAt || this.now().toISOString();
    person.name = person.name || rec.googleName;
    person.authProviders = Array.from(new Set([...(person.authProviders || []), 'google' as const]));
    await this.persons.update(person);
    this.passwords.notify('google_linked', person);
    return this.auth.signInPerson(person, ctx.deviceLabel, ctx.ip, ctx.correlationId);
  }
}
