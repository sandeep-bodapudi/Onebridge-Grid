import { DynamicModule, Global, Inject, Module, OnModuleInit, Optional } from '@nestjs/common';
import {
  createRequestAuthenticator,
  EventBus,
  InMemoryEventBus,
  MongoConnectionHandle,
  RequestAuthenticator,
  SubscribableEventBus,
} from '@onebridge/shared';
import { loadAndValidateEnv, SocialEnvConfig } from './config/env.js';
import { FollowService } from './application/follow.service.js';
import { MongoCompanyRefRepository, MongoFollowRepository } from './infrastructure/repositories.js';
import { HttpProfilesClient, ProfilesClient } from './infrastructure/profiles-client.js';
import { FollowController, REQUEST_AUTHENTICATOR } from './presentation/follow.controller.js';

export interface SocialModuleOptions {
  envConfig?: SocialEnvConfig;
  connectionHandle?: MongoConnectionHandle;
  eventBus?: EventBus;
  requestAuthenticator?: RequestAuthenticator;
  profilesClient?: ProfilesClient;
}

@Global()
@Module({})
export class SocialModule implements OnModuleInit {
  constructor(
    @Optional() private readonly follows?: MongoFollowRepository,
    @Optional() private readonly companies?: MongoCompanyRefRepository,
    @Optional() private readonly service?: FollowService,
    @Optional() @Inject('EVENT_BUS') private readonly eventBus?: EventBus
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.follows?.createIndexes();
      await this.companies?.createIndexes();
    } catch (err) {
      console.error('[SocialModule] Failed to ensure indexes:', err);
    }
    const bus = this.eventBus as unknown as SubscribableEventBus | undefined;
    if (this.service && bus && typeof bus.subscribe === 'function') {
      const s = this.service;
      type E = Parameters<FollowService['onOrgEvent']>[0];
      for (const type of ['org.created', 'org.updated', 'org.branding_updated', 'kyb.status_changed']) {
        bus.subscribe(type, (e) => s.onOrgEvent(e as unknown as E));
      }
    }
  }

  static register(options: SocialModuleOptions = {}): DynamicModule {
    const config = options.envConfig || loadAndValidateEnv();
    const handle = () => {
      if (!options.connectionHandle) throw new Error('MongoConnectionHandle is required for the social service');
      return options.connectionHandle;
    };
    return {
      module: SocialModule,
      controllers: [FollowController],
      providers: [
        { provide: 'SOCIAL_ENV_CONFIG', useValue: config },
        { provide: 'EVENT_BUS', useValue: options.eventBus || new InMemoryEventBus() },
        { provide: MongoFollowRepository, useFactory: () => new MongoFollowRepository(handle()) },
        { provide: MongoCompanyRefRepository, useFactory: () => new MongoCompanyRefRepository(handle()) },
        { provide: 'PROFILES_CLIENT', useValue: options.profilesClient || new HttpProfilesClient(config.profilesApiUrl, config.internalServiceKey) },
        {
          provide: FollowService,
          useFactory: (follows: MongoFollowRepository, companies: MongoCompanyRefRepository, profiles: ProfilesClient, bus: EventBus) =>
            new FollowService(follows, companies, profiles, bus, config.dailyFollowCap),
          inject: [MongoFollowRepository, MongoCompanyRefRepository, 'PROFILES_CLIENT', 'EVENT_BUS'],
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
      exports: [FollowService],
    };
  }
}
