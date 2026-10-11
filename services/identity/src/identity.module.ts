import { Module, DynamicModule, Global } from '@nestjs/common';
import { Db, MongoClient, FakeOtpSender, FakeEventBus } from '@onebridge/shared';
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
  db?: Db;
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
      useFactory: (sessionRepo: MongoSessionRepository) => new TokenService(sessionRepo as any, config.jwtSecret),
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
          provide: 'MONGO_DB',
          useFactory: async () => {
            if (options.db) return options.db;
            const client = new MongoClient(config.mongoUri);
            await client.connect();
            return client.db();
          },
        },
        {
          provide: MongoPersonRepository,
          useFactory: (db: Db, keyService: KeyService) => new MongoPersonRepository(db, keyService),
          inject: ['MONGO_DB', KeyService],
        },
        {
          provide: MongoSessionRepository,
          useFactory: (db: Db) => new MongoSessionRepository(db),
          inject: ['MONGO_DB'],
        },
        {
          provide: MongoOtpRepository,
          useFactory: async (db: Db) => {
            const repo = new MongoOtpRepository(db);
            await repo.createIndexes();
            return repo;
          },
          inject: ['MONGO_DB'],
        },
        {
          provide: MongoMembershipRepository,
          useFactory: (db: Db) => new MongoMembershipRepository(db),
          inject: ['MONGO_DB'],
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
              personRepo: personRepo as any,
              sessionRepo: sessionRepo as any,
              otpRepo: otpRepo as any,
              otpSender: fakeOtpSender,
              eventBus: fakeEventBus,
              oauthVerifier: oauthVerifier as any,
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
            return new RbacService(membershipRepo as any, personRepo as any, fakeEventBus);
          },
          inject: [MongoMembershipRepository, MongoPersonRepository],
        },
      ],
      exports: [AuthService, MfaService, RbacService, TokenService, 'IDENTITY_ENV_CONFIG'],
    };
  }
}
