import crypto from 'node:crypto';
import { FakeOtpSender, FakeEventBus } from '@onebridge/shared';
import { OtpService } from './otp.service.js';
import { TokenService } from './token.service.js';
import { MfaService } from './mfa.service.js';
import { Person } from '../domain/person.js';
import { Session, SessionFamily } from '../domain/session.js';
import { OtpChallenge, RateLimitEntry } from '../domain/otp-challenge.js';
import { IOAuthVerifier } from './oauth-verifier.js';

export interface IPersonRepository {
  create(person: Omit<Person, 'createdAt' | 'updatedAt'>): Promise<Person>;
  createPerson(personData: Omit<Person, 'userId' | 'createdAt' | 'updatedAt'>, idGenerator?: () => string): Promise<Person>;
  findById(userId: string): Promise<Person | undefined>;
  findByPhone(phone: string): Promise<Person | undefined>;
  findByEmail(email: string): Promise<Person | undefined>;
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
  eventBus: FakeEventBus;
  jwtSecret: string;
  oauthVerifier?: IOAuthVerifier;
}

export interface VerifyOtpResult {
  status: 'authenticated' | 'mfa_required' | 'mfa_setup_required';
  accessToken?: string;
  refreshToken?: string;
  mfaTicket?: string;
  userId: string;
}

export class AuthService {
  private personRepo: IPersonRepository;
  private sessionRepo: ISessionRepository;
  public otpService: OtpService;
  public tokenService: TokenService;
  public mfaService: MfaService;
  private eventBus: FakeEventBus;
  private oauthVerifier?: IOAuthVerifier;

  constructor(config: AuthServiceConfig) {
    const personRepo = config.persons || config.personRepo;
    const sessionRepo = config.sessions || config.sessionRepo;
    const otpRepo = config.otpChallenges || config.otpRepo;

    if (!personRepo || !sessionRepo || !otpRepo) {
      throw new Error('AuthService requires personRepo, sessionRepo, and otpRepo.');
    }

    this.personRepo = personRepo;
    this.sessionRepo = sessionRepo;
    this.otpService = new OtpService(otpRepo, config.otpSender);
    this.tokenService = new TokenService(sessionRepo, config.jwtSecret);
    this.mfaService = new MfaService();
    this.eventBus = config.eventBus;
    this.oauthVerifier = config.oauthVerifier;
  }

  async requestOtp(phone: string, ipAddress: string) {
    return this.otpService.requestOtp(phone, ipAddress);
  }

  async verifyOtp(phone: string, code: string, deviceLabel: string, ipAddress: string) {
    return this.verifyOtpAndLogin(phone, code, deviceLabel, ipAddress);
  }

  async loginWithOAuth(
    provider: 'google' | 'microsoft',
    idToken: string,
    deviceLabel: string,
    ipAddress: string,
    correlationId = 'unknown'
  ): Promise<VerifyOtpResult> {
    if (!this.oauthVerifier) {
      throw new Error('OAuthVerifier is not configured.');
    }

    // 1. Verify idToken with provider
    const profile = await this.oauthVerifier.verifyIdToken(provider, idToken);

    // 2. Link or create Person (Rule AC-4)
    let person: Person | undefined;

    if (profile.email && profile.emailVerified) {
      person = await this.personRepo.findByEmail(profile.email);
    }

    if (!person && profile.phone && profile.phoneVerified) {
      person = await this.personRepo.findByPhone(profile.phone);
    }

    if (person) {
      // Link provider if not already linked
      const providers = person.authProviders || [];
      if (!providers.includes(provider)) {
        providers.push(provider);
        person.authProviders = providers;
        await this.personRepo.update(person);
      }
    } else {
      // Create new Person
      const userId = `usr_${crypto.randomBytes(12).toString('hex')}`;
      person = await this.personRepo.create({
        userId,
        email: profile.emailVerified ? profile.email : undefined,
        phone: profile.phoneVerified ? profile.phone : undefined,
        name: profile.name,
        authProviders: [provider],
        mfa: { enabled: false },
      });

      await this.eventBus.publish({
        eventId: crypto.randomUUID(),
        type: 'user.registered',
        version: '1.0.0',
        tenantId: 'global',
        occurredAt: new Date().toISOString(),
        correlationId,
      });
    }

    // Check MFA requirements
    const isOwnerOrAdmin = (person.roles || []).some(
      (r) => (r.role === 'Owner' || r.role === 'Admin') && r.plan === 'Business'
    );
    const mfaEnforced = isOwnerOrAdmin || (person.mfa && person.mfa.enabled);

    if (mfaEnforced) {
      if (!person.mfa || !person.mfa.enabled) {
        const mfaTicket = this.tokenService.generateMfaTicket(person.userId);
        return {
          status: 'mfa_setup_required',
          mfaTicket,
          userId: person.userId,
        };
      } else {
        const mfaTicket = this.tokenService.generateMfaTicket(person.userId);
        return {
          status: 'mfa_required',
          mfaTicket,
          userId: person.userId,
        };
      }
    }

    // Issue tokens and session
    const familyId = `fam_${crypto.randomBytes(12).toString('hex')}`;
    const sessionId = `ses_${crypto.randomBytes(12).toString('hex')}`;

    const tokens = await this.tokenService.createSessionFamily(
      person.userId,
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

    return {
      status: 'authenticated',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      userId: person.userId,
    };
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
      });
    }

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

  async refreshToken(refreshToken: string, deviceLabel: string, ipAddress: string) {
    return this.tokenService.rotateRefreshToken(refreshToken, deviceLabel, ipAddress);
  }

  async logout(refreshToken: string) {
    return this.tokenService.revokeRefreshToken(refreshToken);
  }

  async listSessions(userId: string, limit = 20, offset = 0) {
    return this.sessionRepo.findSessionsByUserId(userId, limit, offset);
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.sessionRepo.findSessionById(sessionId);
    if (!session || session.userId !== userId) {
      throw new Error('Session not found or not owned by user');
    }
    await this.sessionRepo.revokeSession(sessionId);
  }
}
