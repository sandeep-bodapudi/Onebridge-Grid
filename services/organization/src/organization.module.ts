import { Module, DynamicModule, Global, OnModuleInit } from '@nestjs/common';
import { MongoConnectionHandle, FakeEventBus, EventBus } from '@onebridge/shared';
import { OrganizationEnvConfig, loadAndValidateEnv } from './config/env.js';
import { OrganizationService } from './application/organization.service.js';
import { MongoOrganizationRepository } from './infrastructure/mongo-organization.repository.js';
import { MongoIssuedIdRepository } from './infrastructure/mongo-issued-id.repository.js';
import {
  HttpIdentityInternalClient,
  IdentityInternalClient,
} from './infrastructure/identity-internal.client.js';
import { NestOrganizationController } from './presentation/nest-organization.controller.js';
import { TenantAuthGuard, REQUEST_AUTHENTICATOR } from './presentation/guards/tenant-auth.guard.js';
import { createRequestAuthenticator, resolveServiceJwtSecret, RequestAuthenticator } from '@onebridge/shared';

import { MongoCounterRepository } from './infrastructure/mongo-counter.repository.js';
import { CounterService } from './application/counter.service.js';
import { MongoBranchRepository } from './infrastructure/mongo-branch.repository.js';
import { MongoDepartmentRepository } from './infrastructure/mongo-department.repository.js';
import { MongoTeamRepository } from './infrastructure/mongo-team.repository.js';
import { MongoAuditRepository } from './infrastructure/mongo-audit.repository.js';
import { OrgStructureService } from './application/org-structure.service.js';
import { StructureController } from './presentation/structure.controller.js';
import { MongoSeatRepository } from './infrastructure/mongo-seat.repository.js';
import { SeatsService } from './application/seats.service.js';
import { SeatsController } from './presentation/seats.controller.js';
import { FakeMediaStorageService } from './infrastructure/media-storage.service.js';
import { BrandKitService } from './application/brand-kit.service.js';
import { AuditLogService } from './application/audit-log.service.js';
import { AuditController } from './presentation/audit.controller.js';

export interface EventBusLike {
  publish: (event: unknown) => Promise<void>;
}

export interface OrganizationModuleOptions {
  envConfig?: OrganizationEnvConfig;
  connectionHandle?: MongoConnectionHandle;
  identityClient?: IdentityInternalClient;
  eventBus?: EventBusLike;
  /** Overrides the token-verifying authenticator (tests). */
  requestAuthenticator?: RequestAuthenticator;
}

@Global()
@Module({})
export class OrganizationModule implements OnModuleInit {
  constructor(
    private readonly orgRepo?: MongoOrganizationRepository,
    private readonly issuedIdRepo?: MongoIssuedIdRepository,
    private readonly counterRepo?: MongoCounterRepository,
    private readonly branchRepo?: MongoBranchRepository,
    private readonly deptRepo?: MongoDepartmentRepository,
    private readonly teamRepo?: MongoTeamRepository,
    private readonly auditRepo?: MongoAuditRepository,
    private readonly seatRepo?: MongoSeatRepository
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      if (this.orgRepo) await this.orgRepo.createIndexes();
      if (this.issuedIdRepo) await this.issuedIdRepo.createIndexes();
      if (this.counterRepo) await this.counterRepo.createIndexes();
      if (this.branchRepo) await this.branchRepo.createIndexes();
      if (this.deptRepo) await this.deptRepo.createIndexes();
      if (this.teamRepo) await this.teamRepo.createIndexes();
      if (this.auditRepo) await this.auditRepo.createIndexes();
      if (this.seatRepo) await this.seatRepo.createIndexes();
    } catch (err: unknown) {
      console.error('[OrganizationModule] Failed to ensure database indexes:', err);
    }
  }

  static register(options: OrganizationModuleOptions = {}): DynamicModule {
    const config = options.envConfig || loadAndValidateEnv();

    const envProvider = {
      provide: 'ORGANIZATION_ENV_CONFIG',
      useValue: config,
    };

    const eventBusProvider = {
      provide: 'EVENT_BUS',
      useValue: options.eventBus || new FakeEventBus(),
    };

    const identityClientProvider = {
      provide: 'IDENTITY_INTERNAL_CLIENT',
      useValue:
        options.identityClient ||
        new HttpIdentityInternalClient(config.identityApiUrl, config.internalServiceKey),
    };

    const orgRepoProvider = {
      provide: MongoOrganizationRepository,
      useFactory: () => {
        if (!options.connectionHandle) {
          throw new Error('MongoConnectionHandle is required for MongoOrganizationRepository');
        }
        return new MongoOrganizationRepository(options.connectionHandle);
      },
    };

    const issuedIdRepoProvider = {
      provide: MongoIssuedIdRepository,
      useFactory: () => {
        if (!options.connectionHandle) {
          throw new Error('MongoConnectionHandle is required for MongoIssuedIdRepository');
        }
        return new MongoIssuedIdRepository(options.connectionHandle);
      },
    };

    const counterRepoProvider = {
      provide: MongoCounterRepository,
      useFactory: () => {
        if (!options.connectionHandle) {
          throw new Error('MongoConnectionHandle is required for MongoCounterRepository');
        }
        return new MongoCounterRepository(options.connectionHandle);
      },
    };

    const branchRepoProvider = {
      provide: MongoBranchRepository,
      useFactory: () => {
        if (!options.connectionHandle) {
          throw new Error('MongoConnectionHandle is required for MongoBranchRepository');
        }
        return new MongoBranchRepository(options.connectionHandle);
      },
    };

    const deptRepoProvider = {
      provide: MongoDepartmentRepository,
      useFactory: () => {
        if (!options.connectionHandle) {
          throw new Error('MongoConnectionHandle is required for MongoDepartmentRepository');
        }
        return new MongoDepartmentRepository(options.connectionHandle);
      },
    };

    const teamRepoProvider = {
      provide: MongoTeamRepository,
      useFactory: () => {
        if (!options.connectionHandle) {
          throw new Error('MongoConnectionHandle is required for MongoTeamRepository');
        }
        return new MongoTeamRepository(options.connectionHandle);
      },
    };

    const auditRepoProvider = {
      provide: MongoAuditRepository,
      useFactory: () => {
        if (!options.connectionHandle) {
          throw new Error('MongoConnectionHandle is required for MongoAuditRepository');
        }
        return new MongoAuditRepository(options.connectionHandle);
      },
    };

    const counterServiceProvider = {
      provide: CounterService,
      useFactory: (counterRepo: MongoCounterRepository, orgRepo: MongoOrganizationRepository) => {
        return new CounterService(counterRepo, orgRepo);
      },
      inject: [MongoCounterRepository, MongoOrganizationRepository],
    };

    const orgServiceProvider = {
      provide: OrganizationService,
      useFactory: (
        orgRepo: MongoOrganizationRepository,
        issuedIdRepo: MongoIssuedIdRepository,
        identityClient: IdentityInternalClient,
        eventBus: EventBusLike,
        counterService: CounterService
      ) => {
        return new OrganizationService(
          orgRepo,
          issuedIdRepo,
          identityClient,
          eventBus,
          counterService
        );
      },
      inject: [
        MongoOrganizationRepository,
        MongoIssuedIdRepository,
        'IDENTITY_INTERNAL_CLIENT',
        'EVENT_BUS',
        CounterService,
      ],
    };

    const orgStructureServiceProvider = {
      provide: OrgStructureService,
      useFactory: (
        branchRepo: MongoBranchRepository,
        deptRepo: MongoDepartmentRepository,
        teamRepo: MongoTeamRepository,
        auditRepo: MongoAuditRepository,
        orgRepo: MongoOrganizationRepository,
        counterService: CounterService,
        eventBus: EventBus
      ) => {
        return new OrgStructureService(
          branchRepo,
          deptRepo,
          teamRepo,
          auditRepo,
          orgRepo,
          counterService,
          eventBus
        );
      },
      inject: [
        MongoBranchRepository,
        MongoDepartmentRepository,
        MongoTeamRepository,
        MongoAuditRepository,
        MongoOrganizationRepository,
        CounterService,
        'EVENT_BUS',
      ],
    };

    const seatRepoProvider = {
      provide: MongoSeatRepository,
      useFactory: () => {
        if (!options.connectionHandle) {
          throw new Error('MongoConnectionHandle is required for MongoSeatRepository');
        }
        return new MongoSeatRepository(options.connectionHandle);
      },
    };

    const seatsServiceProvider = {
      provide: SeatsService,
      useFactory: (
        seatRepo: MongoSeatRepository,
        orgRepo: MongoOrganizationRepository,
        counterService: CounterService,
        auditRepo: MongoAuditRepository,
        eventBus: EventBus
      ) => {
        return new SeatsService(
          seatRepo,
          orgRepo,
          counterService,
          auditRepo,
          eventBus
        );
      },
      inject: [
        MongoSeatRepository,
        MongoOrganizationRepository,
        CounterService,
        MongoAuditRepository,
        'EVENT_BUS',
      ],
    };

    const mediaStorageServiceProvider = {
      provide: FakeMediaStorageService,
      useFactory: () => new FakeMediaStorageService(),
    };

    const brandKitServiceProvider = {
      provide: BrandKitService,
      useFactory: (
        orgRepo: MongoOrganizationRepository,
        auditRepo: MongoAuditRepository,
        mediaStorage: FakeMediaStorageService,
        eventBus: EventBus
      ) => {
        return new BrandKitService(orgRepo, auditRepo, mediaStorage, eventBus);
      },
      inject: [
        MongoOrganizationRepository,
        MongoAuditRepository,
        FakeMediaStorageService,
        'EVENT_BUS',
      ],
    };

    const auditLogServiceProvider = {
      provide: AuditLogService,
      useFactory: (
        auditRepo: MongoAuditRepository,
        orgRepo: MongoOrganizationRepository,
        eventBus: EventBusLike
      ) => {
        return new AuditLogService(auditRepo, orgRepo, eventBus);
      },
      inject: [MongoAuditRepository, MongoOrganizationRepository, 'EVENT_BUS'],
    };

    // D-SERVICE-AUTH: verifies identity access tokens and resolves the caller's role.
    const requestAuthenticatorProvider = {
      provide: REQUEST_AUTHENTICATOR,
      useValue:
        options.requestAuthenticator ||
        createRequestAuthenticator({
          nodeEnv: config.nodeEnv,
          jwtSecret: config.jwtSecret || resolveServiceJwtSecret(config.nodeEnv, undefined),
          identityApiUrl: config.identityApiUrl || 'http://localhost:4001',
          internalServiceKey: config.internalServiceKey || 'test-internal-service-key-at-least-32-chars-12345',
        }),
    };

    return {
      module: OrganizationModule,
      controllers: [
        NestOrganizationController,
        StructureController,
        SeatsController,
        AuditController,
      ],
      providers: [
        envProvider,
        eventBusProvider,
        identityClientProvider,
        orgRepoProvider,
        issuedIdRepoProvider,
        counterRepoProvider,
        counterServiceProvider,
        orgServiceProvider,
        branchRepoProvider,
        deptRepoProvider,
        teamRepoProvider,
        auditRepoProvider,
        orgStructureServiceProvider,
        seatRepoProvider,
        seatsServiceProvider,
        mediaStorageServiceProvider,
        brandKitServiceProvider,
        auditLogServiceProvider,
        requestAuthenticatorProvider,
        TenantAuthGuard,
      ],
      exports: [
        OrganizationService,
        CounterService,
        OrgStructureService,
        SeatsService,
        BrandKitService,
        AuditLogService,
        FakeMediaStorageService,
        MongoOrganizationRepository,
        MongoIssuedIdRepository,
        MongoCounterRepository,
        MongoBranchRepository,
        MongoDepartmentRepository,
        MongoTeamRepository,
        MongoAuditRepository,
        MongoSeatRepository,
      ],
    };
  }
}
