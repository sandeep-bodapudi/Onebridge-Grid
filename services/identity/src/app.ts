import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { GlobalExceptionFilter, correlationIdMiddleware } from '@onebridge/shared';
import { IdentityModule, IdentityModuleOptions } from './identity.module.js';
import { loadAndValidateEnv } from './config/env.js';

export async function createApp(options: IdentityModuleOptions = {}): Promise<INestApplication> {
  const config = options.envConfig || loadAndValidateEnv();

  const app = await NestFactory.create(
    IdentityModule.register({
      envConfig: config,
      connectionHandle: options.connectionHandle,
      emailSender: options.emailSender,
    })
  );

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
      'X-CSRF-Token',
      'x-service-key',
      'Idempotency-Key',
      'X-Correlation-Id',
    ],
  });

  app.useGlobalFilters(new GlobalExceptionFilter());

  return app;
}
