import { DynamicModule, Global, Inject, Module, OnApplicationBootstrap, OnApplicationShutdown, OnModuleInit, Optional } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { WebSocketServer } from 'ws';
import {
  createRequestAuthenticator,
  EventBus,
  InMemoryEventBus,
  KeyVaultProvider,
  LocalKeyVaultProvider,
  MongoConnectionHandle,
  RequestAuthenticator,
  SubscribableEventBus,
} from '@onebridge/shared';
import { loadAndValidateEnv, MessagingEnvConfig } from './config/env.js';
import { MessagingService } from './application/messaging.service.js';
import { RealtimeHub } from './application/realtime-hub.js';
import {
  MongoCompanyRefRepository,
  MongoConversationRepository,
  MongoFollowRefRepository,
  MongoMessageRepository,
  MongoNoteRepository,
  MongoSeatRefRepository,
} from './infrastructure/repositories.js';
import { HttpProfilesClient, ProfilesClient } from './infrastructure/profiles-client.js';
import { MessagingController, REQUEST_AUTHENTICATOR } from './presentation/messaging.controller.js';
import { attachRealtime } from './presentation/realtime.gateway.js';

export interface MessagingModuleOptions {
  envConfig?: MessagingEnvConfig;
  connectionHandle?: MongoConnectionHandle;
  eventBus?: EventBus;
  requestAuthenticator?: RequestAuthenticator;
  profilesClient?: ProfilesClient;
  keyVault?: KeyVaultProvider;
  now?: () => Date;
}

const REPOS = [MongoConversationRepository, MongoMessageRepository, MongoCompanyRefRepository, MongoSeatRefRepository, MongoFollowRefRepository];

@Global()
@Module({})
export class MessagingModule implements OnModuleInit, OnApplicationBootstrap, OnApplicationShutdown {
  private wss?: WebSocketServer;

  constructor(
    @Optional() private readonly service?: MessagingService,
    @Optional() private readonly adapterHost?: HttpAdapterHost,
    @Optional() @Inject('MESSAGING_ENV_CONFIG') private readonly config?: MessagingEnvConfig,
    @Optional() @Inject('EVENT_BUS') private readonly eventBus?: EventBus,
    @Optional() @Inject('REPOS') private readonly repos?: Array<{ createIndexes(): Promise<void> }>
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      for (const repo of this.repos ?? []) await repo.createIndexes();
    } catch (err) {
      console.error('[MessagingModule] Failed to ensure indexes:', err);
    }
    const bus = this.eventBus as unknown as SubscribableEventBus | undefined;
    if (this.service && bus && typeof bus.subscribe === 'function') {
      const s = this.service;
      type E = Parameters<MessagingService['onOrgEvent']>[0];
      for (const type of ['org.created', 'org.updated', 'org.branding_updated', 'kyb.status_changed']) bus.subscribe(type, (e) => s.onOrgEvent(e as unknown as E));
      for (const type of ['seat.created', 'seat.updated', 'seat.assigned', 'seat.status_changed']) bus.subscribe(type, (e) => s.onSeatEvent(e as unknown as E));
      for (const type of ['follow.created', 'follow.removed']) bus.subscribe(type, (e) => s.onFollowEvent(e as unknown as E));
    }
  }

  onApplicationBootstrap(): void {
    const server = this.adapterHost?.httpAdapter?.getHttpServer();
    if (!server || !this.service || !this.config) return;
    const origins = [this.config.appUrl, 'http://localhost:3000', 'http://127.0.0.1:3000'].map((o) => o.replace(/\/+$/, '').toLowerCase());
    this.wss = attachRealtime(server, this.service, origins);
  }

  onApplicationShutdown(): void {
    for (const client of this.wss?.clients ?? []) client.terminate();
    this.wss?.close();
  }

  static register(options: MessagingModuleOptions = {}): DynamicModule {
    const config = options.envConfig || loadAndValidateEnv();
    const handle = () => {
      if (!options.connectionHandle) throw new Error('MongoConnectionHandle is required for the messaging service');
      return options.connectionHandle;
    };
    return {
      module: MessagingModule,
      controllers: [MessagingController],
      providers: [
        { provide: 'MESSAGING_ENV_CONFIG', useValue: config },
        { provide: 'EVENT_BUS', useValue: options.eventBus || new InMemoryEventBus() },
        ...REPOS.map((Repo) => ({ provide: Repo, useFactory: () => new Repo(handle()) })),
        { provide: MongoNoteRepository, useFactory: () => new MongoNoteRepository(handle()) },
        { provide: 'REPOS', useFactory: (...repos: Array<{ createIndexes(): Promise<void> }>) => repos, inject: REPOS },
        { provide: 'PROFILES_CLIENT', useValue: options.profilesClient || new HttpProfilesClient(config.profilesApiUrl, config.internalServiceKey) },
        { provide: 'KEY_VAULT', useValue: options.keyVault || new LocalKeyVaultProvider(config.encryptionKey) },
        { provide: RealtimeHub, useValue: new RealtimeHub(options.now) },
        {
          provide: MessagingService,
          useFactory: (
            conversations: MongoConversationRepository,
            messages: MongoMessageRepository,
            notes: MongoNoteRepository,
            companies: MongoCompanyRefRepository,
            seats: MongoSeatRefRepository,
            follows: MongoFollowRefRepository,
            profiles: ProfilesClient,
            vault: KeyVaultProvider,
            bus: EventBus,
            hub: RealtimeHub
          ) =>
            new MessagingService(
              conversations,
              messages,
              notes,
              companies,
              seats,
              follows,
              profiles,
              vault,
              bus,
              hub,
              { memberRequestsPerMonth: config.memberRequestsPerMonth, dailyNewConversationCap: config.dailyNewConversationCap },
              options.now
            ),
          inject: [
            MongoConversationRepository,
            MongoMessageRepository,
            MongoNoteRepository,
            MongoCompanyRefRepository,
            MongoSeatRefRepository,
            MongoFollowRefRepository,
            'PROFILES_CLIENT',
            'KEY_VAULT',
            'EVENT_BUS',
            RealtimeHub,
          ],
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
      exports: [MessagingService],
    };
  }
}
