import { DynamicModule, Global, Inject, Module, OnModuleInit, Optional } from '@nestjs/common';
import { createRequestAuthenticator, EventBus, InMemoryEventBus, MongoConnectionHandle, RequestAuthenticator, SubscribableEventBus } from '@onebridge/shared';
import { loadAndValidateEnv, SearchEnvConfig } from './config/env.js';
import { SearchService } from './application/search.service.js';
import { MongoSearchIndex, SearchIndex } from './infrastructure/search-index.js';
import { HttpSources, Sources } from './infrastructure/sources.js';
import { REQUEST_AUTHENTICATOR, SearchController } from './presentation/search.controller.js';

export interface SearchModuleOptions {
  envConfig?: SearchEnvConfig;
  connectionHandle?: MongoConnectionHandle;
  eventBus?: EventBus;
  requestAuthenticator?: RequestAuthenticator;
  sources?: Sources;
  index?: SearchIndex;
}

@Global()
@Module({})
export class SearchModule implements OnModuleInit {
  constructor(
    @Optional() @Inject('SEARCH_INDEX') private readonly index?: SearchIndex,
    @Optional() private readonly service?: SearchService,
    @Optional() @Inject('EVENT_BUS') private readonly eventBus?: EventBus
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await (this.index as unknown as { createIndexes?: () => Promise<void> })?.createIndexes?.();
    } catch (err) {
      console.error('[SearchModule] Failed to ensure indexes:', err);
    }
    const bus = this.eventBus as unknown as SubscribableEventBus | undefined;
    if (!this.service || !bus || typeof bus.subscribe !== 'function') return;
    const s = this.service;
    type E = Parameters<SearchService['onOrgEvent']>[0];
    const on = (types: string[], handler: (e: E) => Promise<void>) =>
      types.forEach((t) => bus.subscribe(t, (e) => handler(e as unknown as E).catch((err) => console.error(`[SearchModule] ${t} failed:`, err))));
    on(['org.created', 'org.updated', 'org.branding_updated', 'kyb.status_changed'], (e) => s.onOrgEvent(e));
    on(['company_profile.updated'], (e) => s.onCompanyProfileUpdated(e));
    on(['member.registered', 'member.profile_updated', 'member.work_history_changed', 'member.privacy_changed'], (e) => s.onMemberEvent(e));
    on(['member.deleted'], (e) => s.onRemoved(e));
  }

  static register(options: SearchModuleOptions = {}): DynamicModule {
    const config = options.envConfig || loadAndValidateEnv();
    return {
      module: SearchModule,
      controllers: [SearchController],
      providers: [
        { provide: 'SEARCH_ENV_CONFIG', useValue: config },
        { provide: 'ANON_SEARCH_PER_MINUTE', useValue: config.anonSearchPerMinute },
        { provide: 'EVENT_BUS', useValue: options.eventBus || new InMemoryEventBus() },
        {
          provide: 'SEARCH_INDEX',
          useFactory: () => {
            if (options.index) return options.index;
            if (!options.connectionHandle) throw new Error('MongoConnectionHandle is required for the search service');
            return new MongoSearchIndex(options.connectionHandle);
          },
        },
        { provide: 'SEARCH_SOURCES', useValue: options.sources || new HttpSources(config.cardsApiUrl, config.profilesApiUrl, config.internalServiceKey) },
        {
          provide: SearchService,
          useFactory: (index: SearchIndex, sources: Sources) => new SearchService(index, sources),
          inject: ['SEARCH_INDEX', 'SEARCH_SOURCES'],
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
      exports: [SearchService],
    };
  }
}
