import { APP_GUARD } from '@nestjs/core';
import { Module, DynamicModule, Global } from '@nestjs/common';
import crypto from 'node:crypto';
import { MongoConnectionHandle, connectMongo, FakeOtpSender, FakeEventBus, EmailSender, createEmailSender, assertNotFakeInProduction } from '@onebridge/shared';
import { IdentityEnvConfig, loadAndValidateEnv } from './config/env.js';
import { KeyService } from './application/key.service.js';
import { TokenService } from './application/token.service.js';
import { MfaService } from './application/mfa.service.js';
import { AuthService } from './application/auth.service.js';
import { RbacService } from './application/rbac.service.js';
import { FakeOAuthVerifier, IOAuthVerifier } from './application/oauth-verifier.js';
import { GoogleOAuthVerifier } from './application/google-oauth-verifier.js';
import { GoogleSignInService } from './application/google-sign-in.service.js';
import { defaultAuthMethods } from './config/env.js';
import { PasswordAuthService } from './application/password-auth.service.js';
import { MongoPersonRepository } from './infrastructure/repositories/mongo-person.repository.js';
import { MongoSessionRepository } from './infrastructure/repositories/mongo-session.repository.js';
import { MongoOtpRepository } from './infrastructure/repositories/mongo-otp.repository.js';
import { MongoMembershipRepository } from './infrastructure/repositories/mongo-membership.repository.js';
import { MongoEmailCodeRepository, MongoKnownDeviceRepository } from './infrastructure/repositories/mongo-email-code.repository.js';
import { NestAuthController } from './presentation/nest-auth.controller.js';
import { NestMeController } from './presentation/nest-me.controller.js';
import { NestInternalController } from './presentation/nest-internal.controller.js';
import { PasswordAuthController } from './presentation/password-auth.controller.js';
import { ServiceKeyGuard } from './presentation/guards/service-key.guard.js';
import { CsrfOriginGuard } from './presentation/guards/csrf-origin.guard.js';

export interface IdentityModuleOptions {
  envConfig?: IdentityEnvConfig;
  connectionHandle?: MongoConnectionHandle;
  useInMemoryRepositories?: boolean;
  /** Tests pass a ConsoleEmailSender to read codes; otherwise built from EMAIL_PROVIDER. */
  emailSender?: EmailSender;
  /** Tests pass a Google verifier backed by a local key set. */
  oauthVerifier?: IOAuthVerifier;
}

/**
 * D-AUTH-EMAIL A6/A7: the real Google verifier when GOOGLE_CLIENT_ID is set; the stand-in only
 * outside production (env refuses production without a client ID); none when Google is off.
 */
export function selectOAuthVerifier(config: IdentityEnvConfig): IOAuthVerifier | undefined {
  const methods = config.authMethods ?? defaultAuthMethods(config.nodeEnv);
  if (!methods.includes('google')) return undefined;
  if (config.googleClientId) return new GoogleOAuthVerifier(config.googleClientId);
  if (config.nodeEnv === 'production') throw new Error('GOOGLE_CLIENT_ID is required in production while AUTH_METHODS includes google');
  return new FakeOAuthVerifier(false);
}

export const EMAIL_SENDER = 'IDENTITY_EMAIL_SENDER';
export const IDENTITY_EVENT_BUS = 'IDENTITY_EVENT_BUS';

@Global()
@Module({})
export class IdentityModule {
  static register(options: IdentityModuleOptions = {}): DynamicModule {
    const config = options.envConfig || loadAndValidateEnv();

    if (config.nodeEnv === 'production' && options.useInMemoryRepositories) {
      throw new Error('In-memory repositories are strictly prohibited in production!');
    }

    const envProvider = {
      provide: 'IDENTITY_ENV_CONFIG',
      useValue: config,
    };

    const keyServiceProvider = {
      provide: KeyService,
      useFactory: () => new KeyService(config.encryptionKey),
    };

    const tokenServiceProvider = {
      provide: TokenService,
      useFactory: (sessionRepo: MongoSessionRepository) => new TokenService(sessionRepo, config.jwtSecret),
      inject: [MongoSessionRepository],
    };

    const serviceKeyGuardProvider = {
      provide: ServiceKeyGuard,
      useFactory: () => new ServiceKeyGuard(config.internalServiceKey),
    };

    const csrfOriginGuardProvider = {
      provide: CsrfOriginGuard,
      useFactory: () => new CsrfOriginGuard(config.appUrl),
    };

    return {
      module: IdentityModule,
      controllers: [NestAuthController, PasswordAuthController, NestMeController, NestInternalController],
      providers: [
        envProvider,
        keyServiceProvider,
        tokenServiceProvider,
        serviceKeyGuardProvider,
        csrfOriginGuardProvider,
        {
          provide: APP_GUARD,
          useExisting: CsrfOriginGuard,
        },
        {
          provide: MongoConnectionHandle,
          useFactory: async () => {
            if (options.connectionHandle) return options.connectionHandle;
            return connectMongo(config.mongoUri);
          },
        },
        {
          provide: MongoPersonRepository,
          useFactory: async (handle: MongoConnectionHandle, keyService: KeyService) => {
            const repo = new MongoPersonRepository(handle, keyService);
            await repo.ensureIndexes();
            return repo;
          },
          inject: [MongoConnectionHandle, KeyService],
        },
        {
          provide: MongoSessionRepository,
          useFactory: async (handle: MongoConnectionHandle) => {
            const repo = new MongoSessionRepository(handle);
            await repo.ensureIndexes();
            return repo;
          },
          inject: [MongoConnectionHandle],
        },
        {
          provide: MongoOtpRepository,
          useFactory: async (handle: MongoConnectionHandle) => {
            const repo = new MongoOtpRepository(handle);
            await repo.ensureIndexes();
            return repo;
          },
          inject: [MongoConnectionHandle],
        },
        {
          provide: MongoMembershipRepository,
          useFactory: async (handle: MongoConnectionHandle) => {
            const repo = new MongoMembershipRepository(handle);
            await repo.ensureIndexes();
            return repo;
          },
          inject: [MongoConnectionHandle],
        },
        {
          provide: EMAIL_SENDER,
          useFactory: () => {
            const sender = options.emailSender ?? createEmailSender(config.emailEnv ?? {}, config.nodeEnv);
            assertNotFakeInProduction('Identity email sender', sender, config.nodeEnv);
            return sender;
          },
        },
        {
          provide: IDENTITY_EVENT_BUS,
          useFactory: () => new FakeEventBus(),
        },
        {
          provide: MongoEmailCodeRepository,
          useFactory: async (handle: MongoConnectionHandle) => {
            const repo = new MongoEmailCodeRepository(handle);
            await repo.ensureIndexes();
            return repo;
          },
          inject: [MongoConnectionHandle],
        },
        {
          provide: MongoKnownDeviceRepository,
          useFactory: async (handle: MongoConnectionHandle) => {
            const repo = new MongoKnownDeviceRepository(handle);
            await repo.ensureIndexes();
            return repo;
          },
          inject: [MongoConnectionHandle],
        },
        {
          provide: PasswordAuthService,
          useFactory: (
            persons: MongoPersonRepository,
            codes: MongoEmailCodeRepository,
            devices: MongoKnownDeviceRepository,
            email: EmailSender,
            auth: AuthService,
            events: FakeEventBus
          ) =>
            new PasswordAuthService({
              persons,
              codes,
              devices,
              email,
              auth,
              events,
              // A separate key from the JWT secret, derived so no new secret is needed.
              codeSecret: crypto.createHash('sha256').update(`email-code:${config.jwtSecret}`).digest('hex'),
              fixedCode: config.enableFakeOtp ? '123456' : undefined,
            }),
          inject: [MongoPersonRepository, MongoEmailCodeRepository, MongoKnownDeviceRepository, EMAIL_SENDER, AuthService, IDENTITY_EVENT_BUS],
        },
        {
          provide: AuthService,
          useFactory: (
            personRepo: MongoPersonRepository,
            sessionRepo: MongoSessionRepository,
            otpRepo: MongoOtpRepository,
            fakeEventBus: FakeEventBus
          ) => {
            const fakeOtpSender = new FakeOtpSender();
            return new AuthService({
              persons: personRepo,
              sessions: sessionRepo,
              otpChallenges: otpRepo,
              otpSender: fakeOtpSender,
              eventBus: fakeEventBus,
              jwtSecret: config.jwtSecret,
              // ENABLE_FAKE_OTP is refused in production, so real builds always send random codes.
              fixedOtpCode: config.enableFakeOtp ? '123456' : undefined,
            });
          },
          inject: [MongoPersonRepository, MongoSessionRepository, MongoOtpRepository, IDENTITY_EVENT_BUS],
        },
        {
          provide: GoogleSignInService,
          useFactory: (persons: MongoPersonRepository, passwords: PasswordAuthService, auth: AuthService) => {
            const verifier = options.oauthVerifier ?? selectOAuthVerifier(config);
            assertNotFakeInProduction('Google sign-in verifier', verifier, config.nodeEnv);
            return new GoogleSignInService(persons, passwords, auth, verifier);
          },
          inject: [MongoPersonRepository, PasswordAuthService, AuthService],
        },
        {
          provide: MfaService,
          useFactory: () => new MfaService(),
        },
        {
          provide: RbacService,
          useFactory: (membershipRepo: MongoMembershipRepository, personRepo: MongoPersonRepository) => {
            const fakeEventBus = new FakeEventBus();
            return new RbacService(membershipRepo, personRepo, fakeEventBus);
          },
          inject: [MongoMembershipRepository, MongoPersonRepository],
        },
      ],
      exports: [AuthService, PasswordAuthService, MfaService, RbacService, TokenService, 'IDENTITY_ENV_CONFIG', MongoConnectionHandle, EMAIL_SENDER],
    };
  }
}
