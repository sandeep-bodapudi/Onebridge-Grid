import crypto from 'node:crypto';
import { FakeOtpSender, PublishableEventBus, ProblemException, normalizePhoneToE164 } from '@onebridge/shared';
import { OtpService } from './otp.service.js';
import { TokenService } from './token.service.js';
import { MfaService } from './mfa.service.js';
import { Person } from '../domain/person.js';
import { Session, SessionFamily } from '../domain/session.js';
import { OtpChallenge, RateLimitEntry } from '../domain/otp-challenge.js';

export interface IPersonRepository {
  create(person: Omit<Person, 'createdAt' | 'updatedAt'>): Promise<Person>;
  createPerson(personData: Omit<Person, 'userId' | 'createdAt' | 'updatedAt'>, idGenerator?: () => string): Promise<Person>;
  findById(userId: string): Promise<Person | undefined>;
  findByPhone(phone: string): Promise<Person | undefined>;
  findByEmail(email: string): Promise<Person | undefined>;
  findByGoogleSub(googleSub: string): Promise<Person | undefined>;
  update(person: Person): Promise<void>;
}

export interface ISessionRepository {
  saveFamily(family: SessionFamily): Promise<void>;
  findFamilyById(familyId: string): Promise<SessionFamily | undefined>;
  saveSession(session: Session): Promise<void>;
  findSessionById(sessionId: string): Promise<Session | undefined>;
  findSessionsByUserId(userId: string, limit?: number, offset?: number): Promise<{ items: Session[]; total: number }>;
  revokeSession(sessionId: string): Promise<void>;
  revokeFamily(familyId: string): Promise<void>;
}

export interface IOtpRepository {
  save(challenge: OtpChallenge): Promise<void>;
  findLatestByPhone(phone: string): Promise<OtpChallenge | undefined>;
  getPhoneRateLimit(phone: string): Promise<RateLimitEntry>;
  savePhoneRateLimit(phone: string, entry: RateLimitEntry): Promise<void>;
  getIpRateLimit(ip: string): Promise<RateLimitEntry>;
  saveIpRateLimit(ip: string, entry: RateLimitEntry): Promise<void>;
}

export interface AuthServiceConfig {
  personRepo?: IPersonRepository;
  persons?: IPersonRepository;
  sessionRepo?: ISessionRepository;
  sessions?: ISessionRepository;
  otpRepo?: IOtpRepository;
  otpChallenges?: IOtpRepository;
  otpSender: FakeOtpSender;
  eventBus: PublishableEventBus;
  jwtSecret: string;
  /** Demo and test builds only: every one-time code is this value instead of a random one. */
  fixedOtpCode?: string;
}

export interface VerifyOtpResult {
  status: 'authenticated' | 'mfa_required' | 'mfa_setup_required' | 'link_confirmation_required';
  accessToken?: string;
  refreshToken?: string;
  mfaTicket?: string;
  linkTicket?: string;
  provider?: string;
  message?: string;
  userId: string;
}

export class AuthService {
  private personRepo: IPersonRepository;
  private sessionRepo: ISessionRepository;
  public otpService: OtpService;
  public tokenService: TokenService;
  public mfaService: MfaService;
  private eventBus: PublishableEventBus;

  constructor(config: AuthServiceConfig) {
    const personRepo = config.persons || config.personRepo;
    const sessionRepo = config.sessions || config.sessionRepo;
    const otpRepo = config.otpChallenges || config.otpRepo;

    if (!personRepo || !sessionRepo || !otpRepo) {
      throw new Error('AuthService requires personRepo, sessionRepo, and otpRepo.');
    }

    this.personRepo = personRepo;
    this.sessionRepo = sessionRepo;
    this.otpService = new OtpService(otpRepo, config.otpSender, config.fixedOtpCode);
    this.tokenService = new TokenService(sessionRepo, config.jwtSecret);
    this.mfaService = new MfaService();
    this.eventBus = config.eventBus;
  }

  /**
   * One person per phone number: "98220 12345", "09822012345" and "+919822012345"
   * must all reach the same account (ADR-0002 point 4: default +91).
   */
  private toE164(phone: string): string {
    try {
      return normalizePhoneToE164(phone);
    } catch {
      return phone; // OtpService rejects malformed numbers with a proper 400
    }
  }

  async requestOtp(phone: string, ipAddress: string) {
    return this.otpService.requestOtp(this.toE164(phone), ipAddress);
  }

  async verifyOtp(phone: string, code: string, deviceLabel: string, ipAddress: string) {
    return this.verifyOtpAndLogin(this.toE164(phone), code, deviceLabel, ipAddress);
  }

  /** F14: email one-time codes, so an invitee can verify the email an invite was sent to. */
  private normaliseEmail(email: string): string {
    const value = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > 254) throw new Error('Invalid email address');
    return value;
  }

  async requestEmailOtp(email: string, ipAddress: string) {
    const normalised = this.normaliseEmail(email);
    // Challenges are keyed by an identifier string; emails use an "email:" prefix so they never collide with phones.
    return this.otpService.requestOtp(`email:${normalised}`, ipAddress, normalised);
  }

  async verifyEmailOtp(email: string, code: string, deviceLabel: string, ipAddress: string, correlationId = 'unknown'): Promise<VerifyOtpResult> {
    const normalised = this.normaliseEmail(email);
    await this.otpService.verifyOtp(`email:${normalised}`, code, ipAddress);
    let person = await this.personRepo.findByEmail(normalised);
    if (!person) {
      const userId = `usr_${crypto.randomBytes(12).toString('hex')}`;
      person = await this.personRepo.create({ userId, email: normalised, authProviders: ['otp'], mfa: { enabled: false }, emailVerifiedAt: new Date().toISOString() });
      await this.eventBus.publish({
        eventId: crypto.randomUUID(),
        type: 'user.registered',
        version: '1.0.0',
        tenantId: 'global',
        occurredAt: new Date().toISOString(),
        correlationId,
        payload: { userId },
      });
    }
    return this.completeLogin(person, deviceLabel, ipAddress, correlationId);
  }

  async verifyOtpAndLogin(
    phone: string,
    code: string,
    deviceLabel: string,
    ipAddress: string,
    correlationId = 'unknown'
  ): Promise<VerifyOtpResult> {
    // 1. Verify OTP
    await this.otpService.verifyOtp(phone, code, ipAddress);

    // 2. Find or create Person
    let person = await this.personRepo.findByPhone(phone);

    if (!person) {
      const userId = `usr_${crypto.randomBytes(12).toString('hex')}`;
      person = await this.personRepo.create({
        userId,
        phone,
        authProviders: ['otp'],
        mfa: { enabled: false },
      });

      // Emit user.registered domain event
      await this.eventBus.publish({
        eventId: crypto.randomUUID(),
        type: 'user.registered',
        version: '1.0.0',
        tenantId: 'global',
        occurredAt: new Date().toISOString(),
        correlationId,
        payload: {
          userId,
        },
      });
    }

    return this.completeLogin(person, deviceLabel, ipAddress, correlationId);
  }

  /** D-AUTH-EMAIL: sign in a person whose password, email code or Google token was already checked. */
  async signInPerson(person: Person, deviceLabel: string, ipAddress: string, correlationId = 'unknown'): Promise<VerifyOtpResult> {
    return this.completeLogin(person, deviceLabel, ipAddress, correlationId);
  }

  /** Ends every session of a person (password reset), or every one but `keepFamilyId` (password change). */
  async revokeAllSessions(userId: string, keepFamilyId?: string): Promise<void> {
    const families = new Set<string>();
    for (let offset = 0; ; offset += 100) {
      const page = await this.sessionRepo.findSessionsByUserId(userId, 100, offset);
      for (const s of page.items) families.add(s.familyId);
      if (page.items.length < 100) break;
    }
    for (const familyId of families) if (familyId !== keepFamilyId) await this.sessionRepo.revokeFamily(familyId);
  }

  /** MFA checks and session issuance after a verified one-time code (phone or email). */
  private async completeLogin(
    person: NonNullable<Awaited<ReturnType<AuthService['personRepo']['findByPhone']>>>,
    deviceLabel: string,
    ipAddress: string,
    correlationId: string
  ): Promise<VerifyOtpResult> {
    // 3. Check MFA Requirements (AC-8: Mandatory for Owner/Admin on Business plan)
    const isOwnerOrAdmin = (person.roles || []).some(
      (r) => (r.role === 'Owner' || r.role === 'Admin') && r.plan === 'Business'
    );
    const mfaEnforced = isOwnerOrAdmin || (person.mfa && person.mfa.enabled);

    if (mfaEnforced) {
      if (!person.mfa || !person.mfa.enabled) {
        // Enforce setup before completing login
        const mfaTicket = this.tokenService.generateMfaTicket(person.userId);
        return {
          status: 'mfa_setup_required',
          mfaTicket,
          userId: person.userId,
        };
      } else {
        // Standard MFA challenge
        const mfaTicket = this.tokenService.generateMfaTicket(person.userId);
        return {
          status: 'mfa_required',
          mfaTicket,
          userId: person.userId,
        };
      }
    }

    // 4. Issue standard tokens and establish session family
    const familyId = `fam_${crypto.randomBytes(12).toString('hex')}`;
    const sessionId = `ses_${crypto.randomBytes(12).toString('hex')}`;

    const tokens = await this.tokenService.createSessionFamily(
      person.userId,
      deviceLabel,
      ipAddress,
      familyId,
      sessionId
    );

    // Emit user.authenticated domain event
    await this.eventBus.publish({
      eventId: crypto.randomUUID(),
      type: 'user.authenticated',
      version: '1.0.0',
      tenantId: 'global',
      occurredAt: new Date().toISOString(),
      correlationId,
    });

    return {
      status: 'authenticated',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      userId: person.userId,
    };
  }

  async verifyMfaAndCompleteLogin(
    mfaTicket: string,
    totpCode: string,
    deviceLabel: string,
    ipAddress: string,
    correlationId = 'unknown'
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const userId = this.tokenService.verifyMfaTicket(mfaTicket);
    const person = await this.personRepo.findById(userId);

    if (!person || !person.mfa || !person.mfa.secret) {
      throw new Error('MFA not configured for user');
    }

    const isValid = this.mfaService.verifyTotp(person.mfa.secret, totpCode);
    if (!isValid) {
      throw new Error('Invalid MFA verification code');
    }

    const familyId = `fam_${crypto.randomBytes(12).toString('hex')}`;
    const sessionId = `ses_${crypto.randomBytes(12).toString('hex')}`;

    const tokens = await this.tokenService.createSessionFamily(
      userId,
      deviceLabel,
      ipAddress,
      familyId,
      sessionId
    );

    await this.eventBus.publish({
      eventId: crypto.randomUUID(),
      type: 'user.authenticated',
      version: '1.0.0',
      tenantId: 'global',
      occurredAt: new Date().toISOString(),
      correlationId,
    });

    return tokens;
  }

  async completeMfaSetupAndLogin(
    mfaTicket: string,
    totpSecret: string,
    totpCode: string,
    deviceLabel: string,
    ipAddress: string,
    correlationId = 'unknown'
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const userId = this.tokenService.verifyMfaTicket(mfaTicket);
    const person = await this.personRepo.findById(userId);

    if (!person) {
      throw new Error('User not found');
    }

    const isValid = this.mfaService.verifyTotp(totpSecret, totpCode);
    if (!isValid) {
      throw new Error('Invalid MFA verification code');
    }

    person.mfa = {
      enabled: true,
      secret: totpSecret,
    };
    await this.personRepo.update(person);

    const familyId = `fam_${crypto.randomBytes(12).toString('hex')}`;
    const sessionId = `ses_${crypto.randomBytes(12).toString('hex')}`;

    const tokens = await this.tokenService.createSessionFamily(
      userId,
      deviceLabel,
      ipAddress,
      familyId,
      sessionId
    );

    await this.eventBus.publish({
      eventId: crypto.randomUUID(),
      type: 'user.authenticated',
      version: '1.0.0',
      tenantId: 'global',
      occurredAt: new Date().toISOString(),
      correlationId,
    });

    return tokens;
  }

  async rotateTokens(oldRefreshToken: string, deviceLabel?: string, ipAddress?: string) {
    return this.tokenService.rotateRefreshToken(oldRefreshToken, deviceLabel, ipAddress);
  }

  verifyAccessToken(token: string) {
    return this.tokenService.verifyAccessToken(token);
  }

  async refreshToken(refreshToken: string, deviceLabel: string, ipAddress: string) {
    return this.tokenService.rotateRefreshToken(refreshToken, deviceLabel, ipAddress);
  }

  async logout(refreshToken: string) {
    return this.tokenService.revokeRefreshToken(refreshToken);
  }

  async listSessions(userId: string, limit = 20, offset = 0) {
    return this.sessionRepo.findSessionsByUserId(userId, limit, offset);
  }

  async listUserSessions(userId: string, limit = 20, offset = 0) {
    return this.sessionRepo.findSessionsByUserId(userId, limit, offset);
  }

  async revokeSession(userIdOrSessionId: string, maybeSessionId?: string) {
    const sessionId = maybeSessionId || userIdOrSessionId;
    await this.sessionRepo.revokeSession(sessionId);
  }

  async revokeUserSession(userId: string, sessionId: string) {
    const session = await this.sessionRepo.findSessionById(sessionId);
    if (!session || session.userId !== userId) {
      throw new ProblemException(
        403,
        'Forbidden',
        'Cannot revoke session belonging to another user',
        'unknown'
      );
    }
    await this.sessionRepo.revokeSession(sessionId);
  }

  async createSessionForUser(
    userId: string,
    userAgent = 'Default Device',
    ipAddress = '127.0.0.1'
  ): Promise<{ sessionId: string; familyId: string; refreshToken: string; accessToken: string }> {
    const res = await this.tokenService.createSessionFamily(userId, userAgent, ipAddress);
    return {
      sessionId: res.session.sessionId,
      familyId: res.session.familyId,
      refreshToken: res.refreshToken,
      accessToken: res.accessToken,
    };
  }

  async setupMfaForUser(userId: string) {
    const setup = this.mfaService.generateSetup(userId);
    const person = await this.personRepo.findById(userId);
    if (person) {
      person.mfa = { enabled: false, secret: setup.secret };
      await this.personRepo.update(person);
    }
    return setup;
  }

  async verifyMfaChallenge(mfaTicket: string, totpCode: string, deviceLabel = 'Default Device', ipAddress = '127.0.0.1') {
    return this.verifyMfaAndCompleteLogin(mfaTicket, totpCode, deviceLabel, ipAddress);
  }

  async confirmMfaSetup(userId: string, totpCodeOrSecret: string, maybeTotpCode?: string) {
    const person = await this.personRepo.findById(userId);
    if (!person) throw new Error('User not found');
    const secret = maybeTotpCode ? totpCodeOrSecret : person.mfa?.secret || totpCodeOrSecret;
    const code = maybeTotpCode ? maybeTotpCode : totpCodeOrSecret;
    const isValid = this.mfaService.verifyTotp(secret, code);
    if (!isValid) throw new Error('Invalid MFA verification code');
    person.mfa = { enabled: true, secret };
    await this.personRepo.update(person);
    return { success: true };
  }
}
