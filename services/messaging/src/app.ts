import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { GlobalExceptionFilter, correlationIdMiddleware } from '@onebridge/shared';
import { MessagingModule, MessagingModuleOptions } from './messaging.module.js';
import { loadAndValidateEnv } from './config/env.js';

export async function createApp(options: MessagingModuleOptions = {}): Promise<INestApplication> {
  const config = options.envConfig || loadAndValidateEnv();

  const app = await NestFactory.create(
    MessagingModule.register({
      envConfig: config,
      ...options,
    })
  );

  app.use(correlationIdMiddleware);
  app.use(cookieParser());

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
      'Idempotency-Key',
      'X-Correlation-Id',
      'X-Act-As-Company',
    ],
  });

  app.useGlobalFilters(new GlobalExceptionFilter());

  return app;
}
