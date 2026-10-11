import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { GlobalExceptionFilter } from '@onebridge/shared';
import { IdentityModule } from './dist/identity.module.js';
import { seedDevDatabase } from './dist/infrastructure/seed.js';

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const tempDir = path.resolve(process.cwd(), '../../.tmp');
fs.mkdirSync(tempDir, { recursive: true });
process.env.TEMP = tempDir;
process.env.TMP = tempDir;

async function start() {
  console.log('[Test Identity Server] Starting in-memory MongoDB for E2E...');
  const mongod = await MongoMemoryServer.create();
  const mongoUri = mongod.getUri();

  process.env.NODE_ENV = 'test';
  process.env.PORT = '4001';
  process.env.APP_URL = 'http://localhost:3000';
  process.env.MONGODB_URI = mongoUri;
  process.env.JWT_SECRET = 'test-jwt-secret-key-at-least-32-chars-long-12345';
  process.env.INTERNAL_SERVICE_KEY = 'test-internal-service-key-at-least-32-chars-12345';
  process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  process.env.ENABLE_FAKE_OTP = 'true';
  process.env.ENABLE_FAKE_OAUTH = 'true';
  process.env.COOKIE_SECURE = 'false';

  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db('test_identity_e2e');

  console.log('[Test Identity Server] Seeding test database...');
  await seedDevDatabase(db);

  const config = {
    nodeEnv: 'test',
    port: 4001,
    appUrl: 'http://localhost:3000',
    mongoUri,
    allowRemoteSeed: false,
    jwtSecret: 'test-jwt-secret-key-at-least-32-chars-long-12345',
    internalServiceKey: 'test-internal-service-key-at-least-32-chars-12345',
    encryptionKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    cookieSecure: false,
    enableFakeOtp: true,
    enableFakeOauth: true,
  };

  const app = await NestFactory.create(IdentityModule.register({ envConfig: config, db }));
  app.use(cookieParser());
  app.enableCors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Id', 'X-CSRF-Token', 'x-service-key', 'Idempotency-Key'],
  });
  app.useGlobalFilters(new GlobalExceptionFilter());

  await app.listen(4001);
  console.log('[Test Identity Server] Ready on port 4001');

  process.on('SIGTERM', async () => {
    await app.close();
    await client.close();
    await mongod.stop();
    process.exit(0);
  });
}

start().catch((err) => {
  console.error('[Test Identity Server] Fatal error:', err);
  process.exit(1);
});
