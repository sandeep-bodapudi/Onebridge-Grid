import crypto from 'node:crypto';
import { FakeOtpSender, FakeEventBus, Logger } from '@onebridge/shared';
import { InMemoryPersonRepository } from '../infrastructure/repositories/in-memory-person.repository.js';
import { InMemorySessionRepository } from '../infrastructure/repositories/in-memory-session.repository.js';
import { InMemoryOtpRepository } from '../infrastructure/repositories/in-memory-otp.repository.js';
import { OtpService } from './otp.service.js';
import { TokenService } from './token.service.js';
import { MfaService } from './mfa.service.js';
import { Person } from '../domain/person.js';

import { IOAuthVerifier } from './oauth-verifier.js';

export interface AuthServiceConfig {
  personRepo: any;
  sessionRepo: any;
  otpRepo: any;
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
  private personRepo: any;
  private sessionRepo: any;
  public otpService: OtpService;
  public tokenService: TokenService;
  public mfaService: MfaService;
  private eventBus: FakeEventBus;
  private oauthVerifier?: IOAuthVerifier;

  constructor(config: AuthServiceConfig) {
    this.personRepo = config.personRepo;
    this.sessionRepo = config.sessionRepo;
    this.otpService = new OtpService(config.otpRepo, config.otpSender);
    this.tokenService = new TokenService(config.sessionRepo, config.jwtSecret);
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
    ipAddress: string
  ): Promise<VerifyOtpResult> {
    if (!this.oauthVerifier) {
      throw new Error('OAuth verifier is not configured');
    }
    const user = await this.oauthVerifier.verifyIdToken(provider, idToken);
    const result = await this.handleOAuthLogin(
      provider,
      {
        sub: user.sub,
        email: user.email,
        emailVerified: user.emailVerified,
        name: user.name,
      },
      deviceLabel,
      ipAddress
    );
    return {
      status: 'authenticated',
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      userId: result.userId,
    };
  }

  verifyAccessToken(authHeader?: string) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Missing or invalid Authorization header');
    }
    const token = authHeader.substring(7);
    const decoded = this.tokenService.verifyAccessToken(token);
    if (!decoded) {
      throw new Error('Expired or invalid access token');
    }
    return decoded;
  }

  async rotateTokens(oldRefreshToken?: string, deviceLabel = 'Unknown', ipAddress = '127.0.0.1') {
    if (!oldRefreshToken) {
      throw new Error('Missing refresh token');
    }
    return this.tokenService.rotateRefreshToken(oldRefreshToken, deviceLabel, ipAddress);
  }

  async logout(refreshToken: string) {
    return this.tokenService.revokeRefreshToken(refreshToken);
  }

  async revokeSession(sessionId: string, userId: string) {
    return this.revokeUserSession(userId, sessionId);
  }

  async verifyOtpAndLogin(
    phone: string,
    code: string,
    deviceLabel: string,
    ipAddress: string,
    correlationId = 'corr-unknown'
  ): Promise<VerifyOtpResult> {
    // 1. Verify OTP
    await this.otpService.verifyOtp(phone, code, ipAddress);

    // 2. Find or create Person
    let person = await this.personRepo.findByPhone(phone);
    let isNewUser = false;

    if (!person) {
      isNewUser = true;
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
        aggregateVersion: 1,
        payload: {
          userId: person.userId,
          phone: person.phone,
          authProvider: 'otp',
        },
      });

      Logger.log('User registered via OTP', { correlationId });
    }

    // 3. Check MFA policy
    const mfaRequired = this.checkUserMfaRequirement(person);
    if (mfaRequired && !person.mfa.enabled) {
      const mfaTicket = this.generateMfaTicket(person.userId);
      return { status: 'mfa_setup_required', mfaTicket, userId: person.userId };
    }

    if (person.mfa.enabled) {
      const mfaTicket = this.generateMfaTicket(person.userId);
      return { status: 'mfa_required', mfaTicket, userId: person.userId };
    }

    // 4. Create Session & Tokens
    const sessionResult = await this.tokenService.createSessionFamily(person.userId, deviceLabel, ipAddress);
    return {
      status: 'authenticated',
      accessToken: sessionResult.accessToken,
      refreshToken: sessionResult.refreshToken,
      userId: person.userId,
    };
  }

  async handleOAuthLogin(
    provider: 'google' | 'microsoft',
    profile: {
      sub: string;
      email?: string;
      emailVerified?: boolean;
      phone?: string;
      phoneVerified?: boolean;
      name?: string;
    },
    deviceLabel: string,
    ipAddress = '127.0.0.1',
    correlationId = 'corr-unknown'
  ): Promise<{ userId: string; accessToken: string; refreshToken: string }> {
    const hasVerifiedEmail = Boolean(profile.email && profile.emailVerified);
    const hasVerifiedPhone = Boolean(profile.phone && profile.phoneVerified);

    if (!hasVerifiedEmail && !hasVerifiedPhone) {
      throw new Error('Cannot link unverified OAuth identity');
    }

    // AC-4: Link to an existing person by verified email or phone only
    let person: Person | undefined;
    if (hasVerifiedEmail && profile.email) {
      person = await this.personRepo.findByEmail(profile.email);
    }
    if (!person && hasVerifiedPhone && profile.phone) {
      person = await this.personRepo.findByPhone(profile.phone);
    }

    if (person) {
      if (!person.authProviders.includes(provider)) {
        person.authProviders.push(provider);
        await this.personRepo.update(person);
      }
    } else {
      const userId = `usr_${crypto.randomBytes(12).toString('hex')}`;
      person = await this.personRepo.create({
        userId,
        email: hasVerifiedEmail ? profile.email : undefined,
        phone: hasVerifiedPhone ? profile.phone : undefined,
        name: profile.name,
        authProviders: [provider],
        mfa: { enabled: false },
      });

      if (!person) {
        throw new Error('Failed to create person');
      }

      await this.eventBus.publish({
        eventId: crypto.randomUUID(),
        type: 'user.registered',
        version: '1.0.0',
        tenantId: 'global',
        occurredAt: new Date().toISOString(),
        correlationId,
        aggregateVersion: 1,
        payload: {
          userId: person.userId,
          phone: person.phone || 'none',
          authProvider: provider,
        },
      });
    }

    if (!person) {
      throw new Error('User profile could not be determined');
    }

    const sessionResult = await this.tokenService.createSessionFamily(person.userId, deviceLabel, ipAddress);
    return {
      userId: person.userId,
      accessToken: sessionResult.accessToken,
      refreshToken: sessionResult.refreshToken,
    };
  }

  private generateMfaTicket(userId: string): string {
    return crypto.randomBytes(24).toString('hex') + ':' + userId;
  }

  private parseMfaTicket(ticket: string): string {
    const parts = ticket.split(':');
    if (parts.length !== 2 || !parts[1]) {
      throw new Error('Invalid MFA ticket');
    }
    return parts[1];
  }

  async verifyMfaChallenge(ticket: string, code: string, deviceLabel: string, ipAddress: string): Promise<{ accessToken: string; refreshToken: string }> {
    const userId = this.parseMfaTicket(ticket);
    const person = await this.personRepo.findById(userId);
    if (!person || !person.mfa.enabled || !person.mfa.secret) {
      throw new Error('MFA is not enabled for this user');
    }

    const isValid = this.mfaService.verifyTotp(person.mfa.secret, code);
    if (!isValid) {
      throw new Error('Invalid TOTP code');
    }

    const session = await this.tokenService.createSessionFamily(person.userId, deviceLabel, ipAddress);
    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    };
  }

  async setupMfaForUser(userId: string): Promise<{ secret: string; qrUri: string }> {
    const person = await this.personRepo.findById(userId);
    if (!person) {
      throw new Error('User not found');
    }

    const setup = this.mfaService.generateSetup(person.phone || person.email || person.userId);
    person.mfa.secret = setup.secret;
    await this.personRepo.update(person);

    return setup;
  }

  async confirmMfaSetup(userId: string, code: string): Promise<boolean> {
    const person = await this.personRepo.findById(userId);
    if (!person || !person.mfa.secret) {
      throw new Error('MFA setup not initialized');
    }

    const isValid = this.mfaService.verifyTotp(person.mfa.secret, code);
    if (!isValid) {
      throw new Error('Invalid TOTP code');
    }

    person.mfa.enabled = true;
    person.mfa.verifiedAt = new Date().toISOString();
    await this.personRepo.update(person);
    return true;
  }

  private checkUserMfaRequirement(person: Person): boolean {
    if (!person.roles || person.roles.length === 0) {
      return false;
    }
    return person.roles.some((r: { role: 'Owner' | 'Admin' | 'Member'; plan: string }) =>
      this.mfaService.isMfaMandatory({ role: r.role, plan: r.plan })
    );
  }

  async createSessionForUser(userId: string, deviceLabel: string, ipAddress: string) {
    const result = await this.tokenService.createSessionFamily(userId, deviceLabel, ipAddress);
    return {
      sessionId: result.session.sessionId,
      familyId: result.session.familyId,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }

  async listUserSessions(userId: string, limit = 20, offset = 0) {
    return this.sessionRepo.findSessionsByUserId(userId, limit, offset);
  }

  async revokeUserSession(userId: string, sessionId: string) {
    const session = await this.sessionRepo.findSessionById(sessionId);
    if (!session || session.userId !== userId) {
      throw new Error('Session not found or not owned by user');
    }
    await this.sessionRepo.revokeSession(sessionId);
  }
}
