import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectMongo } from '@onebridge/shared';
import { seedDevDatabase } from './infrastructure/seed.js';
import { createApp } from './app.js';
import { loadAndValidateEnv } from './config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');
const tempDir = path.resolve(repoRoot, '.tmp');
const mongoDownloadDir = path.resolve(tempDir, 'mongodb-binaries');

if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
if (!fs.existsSync(mongoDownloadDir)) fs.mkdirSync(mongoDownloadDir, { recursive: true });

process.env.TEMP = tempDir;
process.env.TMP = tempDir;
process.env.MONGOMS_DOWNLOAD_DIR = mongoDownloadDir;
process.env.MONGOMS_VERSION = process.env.MONGOMS_VERSION || '7.0.14';

async function start() {
  console.log('[OneBridge E2E Launcher] Starting MongoMemoryServer...');
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

  const config = loadAndValidateEnv();
  const handle = await connectMongo(mongoUri);

  console.log('[OneBridge E2E Launcher] Seeding database for E2E...');
  await seedDevDatabase(handle);

  console.log('[OneBridge E2E Launcher] Creating NestJS application using createApp in app.ts...');
  const app = await createApp({
    envConfig: config,
    connectionHandle: handle,
  });

  await app.listen(4001);
  console.log('[OneBridge E2E Launcher] Ready and listening on port 4001');

  const shutdown = async () => {
    console.log('[OneBridge E2E Launcher] Shutting down...');
    await app.close();
    await handle.close();
    await mongod.stop();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((err) => {
  console.error('[OneBridge E2E Launcher] Fatal error:', err);
  process.exit(1);
});
