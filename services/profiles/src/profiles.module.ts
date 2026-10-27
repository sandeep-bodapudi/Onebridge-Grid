import { DynamicModule, Global, Inject, Module, OnModuleInit, Optional } from '@nestjs/common';
import {
  createRequestAuthenticator,
  EventBus,
  InMemoryEventBus,
  MongoConnectionHandle,
  RequestAuthenticator,
  SubscribableEventBus,
} from '@onebridge/shared';
import { loadAndValidateEnv, ProfilesEnvConfig } from './config/env.js';
import { ProfilesService } from './application/profiles.service.js';
import {
  MongoMemberProfileRepository,
  MongoOrgRefRepository,
  MongoSeatRefRepository,
  MongoWorkHistoryRepository,
} from './infrastructure/repositories.js';
import { ProfilesController, REQUEST_AUTHENTICATOR } from './presentation/profiles.controller.js';

export interface ProfilesModuleOptions {
  envConfig?: ProfilesEnvConfig;
  connectionHandle?: MongoConnectionHandle;
  /** Shared bus (dev and demo run every service in one process). */
  eventBus?: EventBus;
  requestAuthenticator?: RequestAuthenticator;
}

@Global()
@Module({})
export class ProfilesModule implements OnModuleInit {
  constructor(
    @Optional() private readonly profiles?: MongoMemberProfileRepository,
    @Optional() private readonly work?: MongoWorkHistoryRepository,
    @Optional() private readonly orgRefs?: MongoOrgRefRepository,
    @Optional() private readonly seatRefs?: MongoSeatRefRepository,
    @Optional() private readonly service?: ProfilesService,
    @Optional() @Inject('EVENT_BUS') private readonly eventBus?: EventBus
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.profiles?.createIndexes();
      await this.work?.createIndexes();
      await this.orgRefs?.createIndexes();
      await this.seatRefs?.createIndexes();
    } catch (err) {
      console.error('[ProfilesModule] Failed to ensure indexes:', err);
    }
    const bus = this.eventBus as unknown as SubscribableEventBus | undefined;
    if (this.service && bus && typeof bus.subscribe === 'function') {
      const s = this.service;
      type E = Parameters<ProfilesService['onOrgEvent']>[0];
      bus.subscribe('org.created', (e) => s.onOrgEvent(e as unknown as E));
      bus.subscribe('org.updated', (e) => s.onOrgEvent(e as unknown as E));
      bus.subscribe('seat.created', (e) => s.onSeatCreatedOrUpdated(e as unknown as E));
      bus.subscribe('seat.updated', (e) => s.onSeatCreatedOrUpdated(e as unknown as E));
      bus.subscribe('seat.assigned', (e) => s.onSeatAssigned(e as unknown as E));
      bus.subscribe('seat.status_changed', (e) => s.onSeatStatusChanged(e as unknown as E));
    }
  }

  static register(options: ProfilesModuleOptions = {}): DynamicModule {
    const config = options.envConfig || loadAndValidateEnv();
    const handle = () => {
      if (!options.connectionHandle) throw new Error('MongoConnectionHandle is required for the profiles service');
      return options.connectionHandle;
    };
    return {
      module: ProfilesModule,
      controllers: [ProfilesController],
      providers: [
        { provide: 'PROFILES_ENV_CONFIG', useValue: config },
        { provide: 'INTERNAL_SERVICE_KEY', useValue: config.internalServiceKey },
        { provide: 'EVENT_BUS', useValue: options.eventBus || new InMemoryEventBus() },
        { provide: MongoMemberProfileRepository, useFactory: () => new MongoMemberProfileRepository(handle()) },
        { provide: MongoWorkHistoryRepository, useFactory: () => new MongoWorkHistoryRepository(handle()) },
        { provide: MongoOrgRefRepository, useFactory: () => new MongoOrgRefRepository(handle()) },
        { provide: MongoSeatRefRepository, useFactory: () => new MongoSeatRefRepository(handle()) },
        {
          provide: ProfilesService,
          useFactory: (
            profiles: MongoMemberProfileRepository,
            work: MongoWorkHistoryRepository,
            orgRefs: MongoOrgRefRepository,
            seatRefs: MongoSeatRefRepository,
            bus: EventBus
          ) => new ProfilesService(profiles, work, orgRefs, seatRefs, bus),
          inject: [MongoMemberProfileRepository, MongoWorkHistoryRepository, MongoOrgRefRepository, MongoSeatRefRepository, 'EVENT_BUS'],
        },
        {
          provide: REQUEST_AUTHENTICATOR,
          useValue:
            options.requestAuthenticator ||
            createRequestAuthenticator({
              nodeEnv: config.nodeEnv,
              jwtSecret: config.jwtSecret,
              identityApiUrl: config.identityApiUrl,
              internalServiceKey: config.internalServiceKey,
            }),
        },
      ],
      exports: [ProfilesService],
    };
  }
}
