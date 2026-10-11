import { Module, DynamicModule, Global } from '@nestjs/common';
import { MongoConnectionHandle, connectMongo, FakeOtpSender, FakeEventBus } from '@onebridge/shared';
import { IdentityEnvConfig, loadAndValidateEnv } from './config/env.js';
import { KeyService } from './application/key.service.js';
import { TokenService } from './application/token.service.js';
import { MfaService } from './application/mfa.service.js';
import { AuthService } from './application/auth.service.js';
import { RbacService } from './application/rbac.service.js';
import { FakeOAuthVerifier } from './application/oauth-verifier.js';
import { MongoPersonRepository } from './infrastructure/repositories/mongo-person.repository.js';
import { MongoSessionRepository } from './infrastructure/repositories/mongo-session.repository.js';
import { MongoOtpRepository } from './infrastructure/repositories/mongo-otp.repository.js';
import { MongoMembershipRepository } from './infrastructure/repositories/mongo-membership.repository.js';
import { NestAuthController } from './presentation/nest-auth.controller.js';
import { NestMeController } from './presentation/nest-me.controller.js';
import { NestInternalController } from './presentation/nest-internal.controller.js';
import { ServiceKeyGuard } from './presentation/guards/service-key.guard.js';
import { CsrfOriginGuard } from './presentation/guards/csrf-origin.guard.js';

export interface IdentityModuleOptions {
  envConfig?: IdentityEnvConfig;
  connectionHandle?: MongoConnectionHandle;
}

@Global()
@Module({})
export class IdentityModule {
  static register(options: IdentityModuleOptions = {}): DynamicModule {
    const config = options.envConfig || loadAndValidateEnv();

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
      controllers: [NestAuthController, NestMeController, NestInternalController],
      providers: [
        envProvider,
        keyServiceProvider,
        tokenServiceProvider,
        serviceKeyGuardProvider,
        csrfOriginGuardProvider,
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
          provide: AuthService,
          useFactory: (
            personRepo: MongoPersonRepository,
            sessionRepo: MongoSessionRepository,
            otpRepo: MongoOtpRepository
          ) => {
            const fakeOtpSender = new FakeOtpSender();
            const fakeEventBus = new FakeEventBus();
            const oauthVerifier = new FakeOAuthVerifier(config.nodeEnv === 'production');
            return new AuthService({
              persons: personRepo,
              sessions: sessionRepo,
              otpChallenges: otpRepo,
              otpSender: fakeOtpSender,
              eventBus: fakeEventBus,
              oauthVerifier: oauthVerifier,
              jwtSecret: config.jwtSecret,
            });
          },
          inject: [MongoPersonRepository, MongoSessionRepository, MongoOtpRepository],
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
      exports: [AuthService, MfaService, RbacService, TokenService, 'IDENTITY_ENV_CONFIG', MongoConnectionHandle],
    };
  }
}
