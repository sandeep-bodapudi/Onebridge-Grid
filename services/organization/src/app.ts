import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { GlobalExceptionFilter, correlationIdMiddleware } from '@onebridge/shared';
import { OrganizationModule, OrganizationModuleOptions } from './organization.module.js';
import { loadAndValidateEnv } from './config/env.js';

export async function createApp(options: OrganizationModuleOptions = {}): Promise<INestApplication> {
  const config = options.envConfig || loadAndValidateEnv();

  const app = await NestFactory.create<NestExpressApplication>(
    OrganizationModule.register({
      envConfig: config,
      connectionHandle: options.connectionHandle,
      identityClient: options.identityClient,
      eventBus: options.eventBus,
      requestAuthenticator: options.requestAuthenticator,
      inviteNotifier: options.inviteNotifier,
      keyVault: options.keyVault,
    })
  );

  // Logos arrive as base64 JSON (up to 5 MB, about 6.7 MB encoded); Express's default limit is 100 KB.
  app.useBodyParser('json', { limit: '8mb' });
  app.use(correlationIdMiddleware);
  app.use(cookieParser());

  // CORS configuration
  app.enableCors({
    origin: [config.appUrl, 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Tenant-Id',
      'X-User-Id',
      'X-User-Role',
      'X-CSRF-Token',
      'x-service-key',
      'Idempotency-Key',
      'X-Correlation-Id',
    ],
  });

  app.useGlobalFilters(new GlobalExceptionFilter());

  return app;
}
