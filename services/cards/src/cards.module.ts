import { Module, DynamicModule, Global, OnModuleInit, Inject, Optional } from '@nestjs/common';
import { MongoConnectionHandle, PublishableEventBus, InMemoryEventBus } from '@onebridge/shared';
import { CardsEnvConfig, loadAndValidateEnv } from './config/env.js';
import { MongoCardRepository } from './infrastructure/mongo-card.repository.js';
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
import { CardsService } from './application/cards.service.js';
import { ReadModelSyncService } from './application/read-model-sync.service.js';
import { CardsController } from './presentation/cards.controller.js';
import { TenantAuthGuard } from './presentation/guards/tenant-auth.guard.js';

export interface CardsModuleOptions {
  envConfig?: CardsEnvConfig;
  connectionHandle?: MongoConnectionHandle;
  eventBus?: PublishableEventBus;
  revalidationNotifier?: RevalidationNotifier;
}

@Global()
@Module({})
export class CardsModule implements OnModuleInit {
  constructor(
    @Optional() private readonly cardRepo?: MongoCardRepository,
    @Optional() private readonly orgReadModelRepo?: MongoOrgReadModelRepository,
    @Optional() private readonly seatReadModelRepo?: MongoSeatReadModelRepository,
    @Optional() private readonly branchReadModelRepo?: MongoBranchReadModelRepository,
    @Optional() private readonly readModelSync?: ReadModelSyncService,
    @Optional() @Inject('EVENT_BUS') private readonly eventBus?: PublishableEventBus
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      if (this.cardRepo) await this.cardRepo.createIndexes();
      if (this.orgReadModelRepo) await this.orgReadModelRepo.createIndexes();
      if (this.seatReadModelRepo) await this.seatReadModelRepo.createIndexes();
      if (this.branchReadModelRepo) await this.branchReadModelRepo.createIndexes();
    } catch (err: unknown) {
      console.error('[CardsModule] Failed to ensure database indexes:', err);
    }

    // Wire the read-model sync consumer to the bus, if it supports subscribe
    // (InMemoryEventBus does; a plain PublishableEventBus fake does not).
    if (this.readModelSync && this.eventBus && 'subscribe' in this.eventBus) {
      this.readModelSync.registerSubscriptions(
        this.eventBus as unknown as Parameters<ReadModelSyncService['registerSubscriptions']>[0]
      );
    }
  }

  static register(options: CardsModuleOptions = {}): DynamicModule {
    const config = options.envConfig || loadAndValidateEnv();

    const envProvider = { provide: 'CARDS_ENV_CONFIG', useValue: config };

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

    const cardRepoProvider = {
      provide: MongoCardRepository,
      useFactory: () => {
        if (!options.connectionHandle) throw new Error('MongoConnectionHandle is required for MongoCardRepository');
        return new MongoCardRepository(options.connectionHandle);
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

    const cardsServiceProvider = {
      provide: CardsService,
      useFactory: (
        cardRepo: MongoCardRepository,
        orgReadModelRepo: MongoOrgReadModelRepository,
        seatReadModelRepo: MongoSeatReadModelRepository,
        eventBus: PublishableEventBus,
        revalidationNotifier: RevalidationNotifier
      ) => new CardsService(cardRepo, orgReadModelRepo, seatReadModelRepo, eventBus, revalidationNotifier),
      inject: [
        MongoCardRepository,
        MongoOrgReadModelRepository,
        MongoSeatReadModelRepository,
        'EVENT_BUS',
        'REVALIDATION_NOTIFIER',
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
      controllers: [CardsController],
      providers: [
        envProvider,
        eventBusProvider,
        revalidationNotifierProvider,
        cardRepoProvider,
        orgReadModelRepoProvider,
        seatReadModelRepoProvider,
        branchReadModelRepoProvider,
        cardsServiceProvider,
        readModelSyncProvider,
        TenantAuthGuard,
      ],
      exports: [
        CardsService,
        ReadModelSyncService,
        MongoCardRepository,
        MongoOrgReadModelRepository,
        MongoSeatReadModelRepository,
        MongoBranchReadModelRepository,
        'EVENT_BUS',
      ],
    };
  }
}
