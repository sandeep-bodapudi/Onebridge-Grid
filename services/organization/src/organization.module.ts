import { Module, DynamicModule, Global, OnModuleInit } from '@nestjs/common';
import { MongoConnectionHandle, FakeEventBus, InMemoryEventBus, EventBus, KeyVaultProvider, LocalKeyVaultProvider, assertNotFakeInProduction, createEmailSender } from '@onebridge/shared';
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
import { FakeMediaStorageService, LocalDiskMediaStorage, MediaStorageService } from './infrastructure/media-storage.service.js';
import { MediaController, MEDIA_DIR } from './presentation/media.controller.js';

export const MEDIA_STORAGE = 'MEDIA_STORAGE';

/** D-VPS-DEPLOY B1: logos on disk when MEDIA_DIR is set (required in production); the checking stand-in otherwise. */
export function selectMediaStorage(config: OrganizationEnvConfig): MediaStorageService {
  if (config.mediaDir) return new LocalDiskMediaStorage(config.mediaDir, config.mediaPublicBase || '/svc/organization');
  if (config.nodeEnv === 'production') throw new Error('MEDIA_DIR is required in production (logo uploads are stored there)');
  return new FakeMediaStorageService();
}
import { BrandKitService } from './application/brand-kit.service.js';
import { AuditLogService } from './application/audit-log.service.js';
import { AuditController } from './presentation/audit.controller.js';
import { InviteService } from './application/invite.service.js';
import { MongoInviteRepository, MongoNoticeAcceptanceRepository } from './infrastructure/mongo-invite.repository.js';
import { EmailInviteNotifier, FakeInviteNotifier, InviteNotifier } from './infrastructure/invite-notifier.js';

/**
 * D-AUTH-EMAIL D11: production (or EMAIL_PROVIDER set) sends invites by real email; development
 * keeps the recording stand-in that hands the link back to the admin (D-INVITE-DEV-LINK).
 */
export function selectInviteNotifier(config: OrganizationEnvConfig): InviteNotifier {
  const realEmail = config.nodeEnv === 'production' || Boolean(config.emailEnv?.EMAIL_PROVIDER);
  const notifier = realEmail ? new EmailInviteNotifier(createEmailSender(config.emailEnv ?? {}, config.nodeEnv)) : new FakeInviteNotifier();
  assertNotFakeInProduction('Invite notifier', notifier, config.nodeEnv);
  return notifier;
}
import { InvitesController, PublicInvitesController } from './presentation/invites.controller.js';
import { AccessRequestService, MongoAccessRequestRepository } from './application/access-request.service.js';
import { AccessRequestsController } from './presentation/access-requests.controller.js';

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
  /** F14 invite delivery; a fake until F22 notifications. */
  inviteNotifier?: InviteNotifier;
  keyVault?: KeyVaultProvider;
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
    private readonly seatRepo?: MongoSeatRepository,
    private readonly inviteRepo?: MongoInviteRepository
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
      if (this.inviteRepo) await this.inviteRepo.createIndexes();
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
      // The runner passes the shared in-process bus; the recording stand-in is for tests only.
      useValue: options.eventBus || (config.nodeEnv === 'production' ? new InMemoryEventBus() : new FakeEventBus()),
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
      provide: MEDIA_STORAGE,
      useFactory: () => selectMediaStorage(config),
    };

    const brandKitServiceProvider = {
      provide: BrandKitService,
      useFactory: (
        orgRepo: MongoOrganizationRepository,
        auditRepo: MongoAuditRepository,
        mediaStorage: MediaStorageService,
        eventBus: EventBus
      ) => {
        return new BrandKitService(orgRepo, auditRepo, mediaStorage, eventBus);
      },
      inject: [
        MongoOrganizationRepository,
        MongoAuditRepository,
        MEDIA_STORAGE,
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

    const requireHandle = (name: string) => {
      if (!options.connectionHandle) throw new Error(`MongoConnectionHandle is required for ${name}`);
      return options.connectionHandle;
    };
    const inviteRepoProvider = { provide: MongoInviteRepository, useFactory: () => new MongoInviteRepository(requireHandle('MongoInviteRepository')) };
    const noticeRepoProvider = {
      provide: MongoNoticeAcceptanceRepository,
      useFactory: () => new MongoNoticeAcceptanceRepository(requireHandle('MongoNoticeAcceptanceRepository')),
    };
    const inviteServiceProvider = {
      provide: InviteService,
      useFactory: (
        inviteRepo: MongoInviteRepository,
        noticeRepo: MongoNoticeAcceptanceRepository,
        seatRepo: MongoSeatRepository,
        seatsService: SeatsService,
        orgRepo: MongoOrganizationRepository,
        auditRepo: MongoAuditRepository,
        identityClient: IdentityInternalClient,
        eventBus: EventBus
      ) =>
        new InviteService(
          inviteRepo,
          noticeRepo,
          seatRepo,
          seatsService,
          orgRepo,
          auditRepo,
          identityClient,
          options.keyVault || new LocalKeyVaultProvider(config.encryptionKey),
          options.inviteNotifier || selectInviteNotifier(config),
          eventBus as EventBus,
          config.appUrl,
          // D-INVITE-DEV-LINK: hand the link back only while invites are not really delivered, never in production.
          config.nodeEnv !== 'production',
          () => new Date(),
          Boolean(config.emailOnlyInvites)
        ),
      inject: [
        MongoInviteRepository,
        MongoNoticeAcceptanceRepository,
        MongoSeatRepository,
        SeatsService,
        MongoOrganizationRepository,
        MongoAuditRepository,
        'IDENTITY_INTERNAL_CLIENT',
        'EVENT_BUS',
      ],
    };

    const accessRepoProvider = { provide: MongoAccessRequestRepository, useFactory: () => new MongoAccessRequestRepository(requireHandle('MongoAccessRequestRepository')) };
    const accessServiceProvider = {
      provide: AccessRequestService,
      useFactory: (
        requests: MongoAccessRequestRepository,
        orgRepo: MongoOrganizationRepository,
        seatRepo: MongoSeatRepository,
        branchRepo: MongoBranchRepository,
        auditRepo: MongoAuditRepository,
        identityClient: IdentityInternalClient,
        eventBus: EventBus
      ) => new AccessRequestService(requests, orgRepo, seatRepo, branchRepo, auditRepo, identityClient, eventBus),
      inject: [MongoAccessRequestRepository, MongoOrganizationRepository, MongoSeatRepository, MongoBranchRepository, MongoAuditRepository, 'IDENTITY_INTERNAL_CLIENT', 'EVENT_BUS'],
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
        InvitesController,
        PublicInvitesController,
        AccessRequestsController,
        MediaController,
      ],
      providers: [
        envProvider,
        { provide: MEDIA_DIR, useValue: config.mediaDir },
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
        inviteRepoProvider,
        noticeRepoProvider,
        inviteServiceProvider,
        accessRepoProvider,
        accessServiceProvider,
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
        MEDIA_STORAGE,
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
