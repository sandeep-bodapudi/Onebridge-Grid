import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { GlobalExceptionFilter, redactMongoUri } from '@onebridge/shared';
import { IdentityModule } from './identity.module.js';
import { loadAndValidateEnv } from './config/env.js';

export async function bootstrap() {
  const config = loadAndValidateEnv();

  const app = await NestFactory.create(IdentityModule.register({ envConfig: config }));

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

  await app.listen(config.port);
  console.log(
    `[OneBridge Identity] Started on port ${config.port} | Mongo: ${redactMongoUri(
      config.mongoUri
    )} | Env: ${config.nodeEnv}`
  );
  return app;
}

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  bootstrap().catch((err) => {
    console.error('[OneBridge Identity] Fatal startup error:', err);
    process.exit(1);
  });
}
