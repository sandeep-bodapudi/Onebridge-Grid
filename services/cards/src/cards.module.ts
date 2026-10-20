import { Module, DynamicModule, Global, OnModuleInit, Inject, Optional } from '@nestjs/common';
import {
  MongoConnectionHandle,
  PublishableEventBus,
  SubscribableEventBus,
  InMemoryEventBus,
  LocalKeyVaultProvider,
  InMemoryRateLimiter,
  KeyVaultProvider,
  RateLimiter,
} from '@onebridge/shared';
import { CardsEnvConfig, loadAndValidateEnv } from './config/env.js';
import { MongoCardRepository } from './infrastructure/mongo-card.repository.js';
import { MongoShortLinkRepository } from './infrastructure/mongo-short-link.repository.js';
import { MongoLeadRepository } from './infrastructure/mongo-lead.repository.js';
import {
  MongoOrgReadModelRepository,
  MongoSeatReadModelRepository,
  MongoBranchReadModelRepository,
} from './infrastructure/mongo-read-model.repositories.js';
import {
  RevalidationNotifier,
  FakeRevalidationNotifier,
  HttpRevalidationNotifier,
} from './infrastructure/revalidation-notifier.js';
import {
  EdgeShortLinkNotifier,
  FakeEdgeShortLinkNotifier,
} from './infrastructure/edge-kv-sync.js';
import { TurnstileValidator, BypassTurnstileValidator } from './application/turnstile-validator.js';
import { LeadNotifier, FakeLeadNotifier } from './domain/notifier.js';
import { CardsService } from './application/cards.service.js';
import { ShortLinkService } from './application/short-link.service.js';
import { SharebackService } from './application/shareback.service.js';
import { ReadModelSyncService } from './application/read-model-sync.service.js';
import { CardsController } from './presentation/cards.controller.js';
import { ShortLinkController } from './presentation/short-link.controller.js';
import { AnalyticsStubController } from './presentation/analytics-stub.controller.js';
import { PublicCardsController } from './presentation/public-cards.controller.js';
import { TenantAuthGuard } from './presentation/guards/tenant-auth.guard.js';

export interface CardsModuleOptions {
  envConfig?: CardsEnvConfig;
  connectionHandle?: MongoConnectionHandle;
  eventBus?: PublishableEventBus;
  revalidationNotifier?: RevalidationNotifier;
  edgeNotifier?: EdgeShortLinkNotifier;
  keyVault?: KeyVaultProvider;
  rateLimiter?: RateLimiter;
  turnstileValidator?: TurnstileValidator;
  leadNotifier?: LeadNotifier;
}

@Global()
@Module({})
export class CardsModule implements OnModuleInit {
  constructor(
    @Optional() private readonly cardRepo?: MongoCardRepository,
    @Optional() private readonly shortLinkRepo?: MongoShortLinkRepository,
    @Optional() private readonly leadRepo?: MongoLeadRepository,
    @Optional() private readonly orgReadModelRepo?: MongoOrgReadModelRepository,
    @Optional() private readonly seatReadModelRepo?: MongoSeatReadModelRepository,
    @Optional() private readonly branchReadModelRepo?: MongoBranchReadModelRepository,
    @Optional() private readonly readModelSync?: ReadModelSyncService,
    @Optional() @Inject('EVENT_BUS') private readonly eventBus?: PublishableEventBus
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      if (this.cardRepo) await this.cardRepo.createIndexes();
      if (this.shortLinkRepo) await this.shortLinkRepo.createIndexes();
      if (this.leadRepo) await this.leadRepo.ensureIndexes();
      if (this.orgReadModelRepo) await this.orgReadModelRepo.createIndexes();
      if (this.seatReadModelRepo) await this.seatReadModelRepo.createIndexes();
      if (this.branchReadModelRepo) await this.branchReadModelRepo.createIndexes();
    } catch (err: unknown) {
      console.error('[CardsModule] Failed to ensure database indexes:', err);
    }

    if (this.readModelSync && this.eventBus) {
      this.readModelSync.registerSubscriptions(this.eventBus as unknown as SubscribableEventBus);
    }
  }

  static register(options: CardsModuleOptions = {}): DynamicModule {
    return this.forRoot(options);
  }

  static forRoot(options: CardsModuleOptions = {}): DynamicModule {
    const config = options.envConfig || loadAndValidateEnv();

    const envProvider = {
      provide: 'CARDS_ENV_CONFIG',
      useValue: config,
    };

    const eventBusProvider = {
      provide: 'EVENT_BUS',
      useValue: options.eventBus || new InMemoryEventBus(),
    };

    const revalidationNotifierProvider = {
      provide: 'REVALIDATION_NOTIFIER',
      useValue:
        options.revalidationNotifier ||
        (config.nodeEnv === 'production'
          ? new HttpRevalidationNotifier(config.webPublicUrl, config.revalidationSigningSecret)
          : new FakeRevalidationNotifier()),
    };

    const edgeNotifierProvider = {
      provide: 'EDGE_SHORTLINK_NOTIFIER',
      useValue: options.edgeNotifier || new FakeEdgeShortLinkNotifier(),
    };

    const keyVaultProvider = {
      provide: 'KEY_VAULT_PROVIDER',
      useValue: options.keyVault || new LocalKeyVaultProvider(),
    };

    const rateLimiterProvider = {
      provide: 'RATE_LIMITER',
      useValue: options.rateLimiter || new InMemoryRateLimiter(),
    };

    const turnstileValidatorProvider = {
      provide: 'TURNSTILE_VALIDATOR',
      useValue: options.turnstileValidator || new BypassTurnstileValidator(),
    };

    const leadNotifierProvider = {
      provide: 'LEAD_NOTIFIER',
      useValue: options.leadNotifier || new FakeLeadNotifier(),
    };

    const cardRepoProvider = {
      provide: MongoCardRepository,
      useFactory: () => {
        if (!options.connectionHandle) throw new Error('MongoConnectionHandle is required for MongoCardRepository');
        return new MongoCardRepository(options.connectionHandle);
      },
    };

    const shortLinkRepoProvider = {
      provide: MongoShortLinkRepository,
      useFactory: () => {
        if (!options.connectionHandle) throw new Error('MongoConnectionHandle is required for MongoShortLinkRepository');
        return new MongoShortLinkRepository(options.connectionHandle);
      },
    };

    const leadRepoProvider = {
      provide: MongoLeadRepository,
      useFactory: () => {
        if (!options.connectionHandle) throw new Error('MongoConnectionHandle is required for MongoLeadRepository');
        return new MongoLeadRepository(options.connectionHandle);
      },
    };

    const orgReadModelRepoProvider = {
      provide: MongoOrgReadModelRepository,
      useFactory: () => {
        if (!options.connectionHandle) throw new Error('MongoConnectionHandle is required for MongoOrgReadModelRepository');
        return new MongoOrgReadModelRepository(options.connectionHandle);
      },
    };

    const seatReadModelRepoProvider = {
      provide: MongoSeatReadModelRepository,
      useFactory: () => {
        if (!options.connectionHandle) throw new Error('MongoConnectionHandle is required for MongoSeatReadModelRepository');
        return new MongoSeatReadModelRepository(options.connectionHandle);
      },
    };

    const branchReadModelRepoProvider = {
      provide: MongoBranchReadModelRepository,
      useFactory: () => {
        if (!options.connectionHandle) throw new Error('MongoConnectionHandle is required for MongoBranchReadModelRepository');
        return new MongoBranchReadModelRepository(options.connectionHandle);
      },
    };

    const shortLinkServiceProvider = {
      provide: ShortLinkService,
      useFactory: (
        shortLinkRepo: MongoShortLinkRepository,
        cardRepo: MongoCardRepository,
        orgReadModelRepo: MongoOrgReadModelRepository,
        branchReadModelRepo: MongoBranchReadModelRepository,
        eventBus: PublishableEventBus,
        edgeNotifier: EdgeShortLinkNotifier
      ) =>
        new ShortLinkService(
          shortLinkRepo,
          cardRepo,
          orgReadModelRepo,
          branchReadModelRepo,
          eventBus,
          edgeNotifier,
          config.webPublicUrl || 'https://grid.onebridge.in',
          config.shortLinkBaseUrl
        ),
      inject: [
        MongoShortLinkRepository,
        MongoCardRepository,
        MongoOrgReadModelRepository,
        MongoBranchReadModelRepository,
        'EVENT_BUS',
        'EDGE_SHORTLINK_NOTIFIER',
      ],
    };

    const cardsServiceProvider = {
      provide: CardsService,
      useFactory: (
        cardRepo: MongoCardRepository,
        orgReadModelRepo: MongoOrgReadModelRepository,
        seatReadModelRepo: MongoSeatReadModelRepository,
        eventBus: PublishableEventBus,
        revalidationNotifier: RevalidationNotifier,
        shortLinkService: ShortLinkService,
        branchReadModelRepo?: MongoBranchReadModelRepository
      ) =>
        new CardsService(
          cardRepo,
          orgReadModelRepo,
          seatReadModelRepo,
          eventBus,
          revalidationNotifier,
          shortLinkService,
          branchReadModelRepo,
          config.webPublicUrl
        ),
      inject: [
        MongoCardRepository,
        MongoOrgReadModelRepository,
        MongoSeatReadModelRepository,
        'EVENT_BUS',
        'REVALIDATION_NOTIFIER',
        ShortLinkService,
        MongoBranchReadModelRepository,
      ],
    };

    const sharebackServiceProvider = {
      provide: SharebackService,
      useFactory: (
        cardRepo: MongoCardRepository,
        leadRepo: MongoLeadRepository,
        keyVault: KeyVaultProvider,
        rateLimiter: RateLimiter,
        turnstileValidator: TurnstileValidator,
        eventBus: PublishableEventBus,
        notifier: LeadNotifier
      ) =>
        new SharebackService(
          cardRepo,
          leadRepo,
          keyVault,
          rateLimiter,
          turnstileValidator,
          eventBus,
          notifier
        ),
      inject: [
        MongoCardRepository,
        MongoLeadRepository,
        'KEY_VAULT_PROVIDER',
        'RATE_LIMITER',
        'TURNSTILE_VALIDATOR',
        'EVENT_BUS',
        'LEAD_NOTIFIER',
      ],
    };

    const readModelSyncProvider = {
      provide: ReadModelSyncService,
      useFactory: (
        orgReadModelRepo: MongoOrgReadModelRepository,
        seatReadModelRepo: MongoSeatReadModelRepository,
        branchReadModelRepo: MongoBranchReadModelRepository,
        cardsService: CardsService,
        revalidationNotifier: RevalidationNotifier
      ) =>
        new ReadModelSyncService(
          orgReadModelRepo,
          seatReadModelRepo,
          branchReadModelRepo,
          cardsService,
          revalidationNotifier
        ),
      inject: [
        MongoOrgReadModelRepository,
        MongoSeatReadModelRepository,
        MongoBranchReadModelRepository,
        CardsService,
        'REVALIDATION_NOTIFIER',
      ],
    };

    return {
      module: CardsModule,
      controllers: [CardsController, ShortLinkController, AnalyticsStubController, PublicCardsController],
      providers: [
        envProvider,
        eventBusProvider,
        revalidationNotifierProvider,
        edgeNotifierProvider,
        keyVaultProvider,
        rateLimiterProvider,
        turnstileValidatorProvider,
        leadNotifierProvider,
        cardRepoProvider,
        shortLinkRepoProvider,
        leadRepoProvider,
        orgReadModelRepoProvider,
        seatReadModelRepoProvider,
        branchReadModelRepoProvider,
        shortLinkServiceProvider,
        cardsServiceProvider,
        sharebackServiceProvider,
        readModelSyncProvider,
        TenantAuthGuard,
      ],
      exports: [
        CardsService,
        ShortLinkService,
        SharebackService,
        ReadModelSyncService,
        MongoCardRepository,
        MongoShortLinkRepository,
        MongoLeadRepository,
        MongoOrgReadModelRepository,
        MongoSeatReadModelRepository,
        MongoBranchReadModelRepository,
        'EVENT_BUS',
        'KEY_VAULT_PROVIDER',
        'RATE_LIMITER',
        'TURNSTILE_VALIDATOR',
        'LEAD_NOTIFIER',
      ],
    };
  }
}
