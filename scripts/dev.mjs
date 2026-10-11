import { spawn } from 'node:child_process';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(rootDir, '.env') });

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/onebridge_dev';
const isLocal = mongoUri.includes('localhost') || mongoUri.includes('127.0.0.1') || mongoUri.includes('::1');
const allowRemoteSeed = process.env.ALLOW_REMOTE_SEED === 'true';

if (!isLocal && !allowRemoteSeed) {
  console.error(`[OneBridge Dev] ERROR: Refusing non-local MONGODB_URI "${mongoUri}" without ALLOW_REMOTE_SEED=true`);
  process.exit(1);
}

let mongodInstance = null;
let activeMongoUri = mongoUri;

async function ensureMongo() {
  console.log(`[OneBridge Dev] Checking MongoDB connection at ${activeMongoUri}...`);
  try {
    const client = new MongoClient(activeMongoUri, { serverSelectionTimeoutMS: 2000 });
    await client.connect();
    await client.close();
    console.log('[OneBridge Dev] Connected to existing MongoDB service.');
  } catch {
    console.log('[OneBridge Dev] Local MongoDB not detected. Starting in-memory MongoDB on port 27017...');
    try {
      mongodInstance = await MongoMemoryServer.create({
        instance: { port: 27017, dbName: 'onebridge_dev' },
      });
      activeMongoUri = mongodInstance.getUri();
      console.log(`[OneBridge Dev] In-memory MongoDB running at ${activeMongoUri}`);
    } catch (err) {
      console.error('[OneBridge Dev] Failed to start MongoDB:', err);
      process.exit(1);
    }
  }
}

async function checkAndSeed() {
  const client = new MongoClient(activeMongoUri);
  await client.connect();
  const db = client.db();

  try {
    const count = await db.collection('organizations').countDocuments({});
    if (count === 0) {
      console.log('[OneBridge Dev] Dev database is empty. Running initial seed...');
      // Dynamic import of seed
      const { seedDevDatabase } = await import('../services/identity/src/infrastructure/seed.js').catch(async () => {
        // Fallback or compiled
        return await import('../services/identity/src/infrastructure/seed.ts');
      });
      await seedDevDatabase(db);
    } else {
      console.log(`[OneBridge Dev] Dev database already initialized (${count} organizations). Skipping seed.`);
    }
  } catch (err) {
    console.warn('[OneBridge Dev] Note during seed check:', err.message);
  } finally {
    await client.close();
  }
}

const childProcesses = [];

function startProcess(name, command, args, cwd, env = {}) {
  const isWindows = process.platform === 'win32';
  const child = spawn(isWindows ? `${command}.cmd` : command, args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...env, MONGODB_URI: activeMongoUri },
  });

  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[OneBridge Dev] Process "${name}" exited with code ${code}`);
    }
  });

  childProcesses.push(child);
  return child;
}

function cleanup() {
  console.log('\n[OneBridge Dev] Shutting down dev services...');
  for (const child of childProcesses) {
    try {
      child.kill('SIGINT');
    } catch {
      // Child process may already have exited
    }
  }
  if (mongodInstance) {
    mongodInstance.stop().then(() => process.exit(0)).catch(() => process.exit(0));
  } else {
    process.exit(0);
  }
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

async function main() {
  await ensureMongo();
  await checkAndSeed();

  console.log('[OneBridge Dev] Starting Identity Service and Web-App...');
  startProcess('identity', 'pnpm', ['--filter', '@onebridge/identity', 'run', 'dev'], rootDir);
  startProcess('web-app', 'pnpm', ['--filter', '@onebridge/web-app', 'run', 'dev'], rootDir);
}

main().catch((err) => {
  console.error('[OneBridge Dev] Startup error:', err);
  cleanup();
});
