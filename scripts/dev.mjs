/**
 * pnpm dev: start the whole Phase 1 stack locally with fake providers.
 *
 *   :4001 identity      :4002 organization      :4003 cards     (one Node process)
 *   :3000 web-app (admin dashboard)              :3001 web-public (visitor cards)
 *
 * The three services run in ONE process and share ONE InMemoryEventBus, so
 * organization events (org.*, branch.*, seat.*) reach the cards read model
 * and a new seat gets its draft card (ADR-0003, docs/decisions.md
 * D-F10-EVENTBUS). Production uses the SNS/SQS adapter (Step 12) instead.
 *
 * Services are built with tsc first (NestJS needs decorator metadata, which
 * tsx/esbuild does not emit), then loaded from their dist output.
 */
import { spawn, spawnSync } from 'node:child_process';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';

dotenv.config({ path: path.join(rootDir, '.env') });

// Web ports are configurable when 3000/3001 are taken by another project:
//   WEB_APP_PORT=3002 WEB_PUBLIC_PORT=3003 pnpm dev
const WEB_APP_PORT = process.env.WEB_APP_PORT || '3000';
const WEB_PUBLIC_PORT = process.env.WEB_PUBLIC_PORT || '3001';

// Local development defaults. Values already set (e.g. from .env) win.
// NODE_ENV must be explicit: identity treats an unset NODE_ENV as production
// and (correctly) refuses fake OTP/OAuth providers there.
const DEV_DEFAULTS = {
  NODE_ENV: 'development',
  APP_URL: `http://localhost:${WEB_APP_PORT}`,
  WEB_PUBLIC_URL: `http://localhost:${WEB_PUBLIC_PORT}`,
  SHORT_LINK_BASE_URL: `http://localhost:${WEB_PUBLIC_PORT}/r`,
  NEXT_PUBLIC_WEB_PUBLIC_URL: `http://localhost:${WEB_PUBLIC_PORT}`,
  JWT_SECRET: 'dev-jwt-secret-key-at-least-32-characters-long',
  INTERNAL_SERVICE_KEY: 'dev-internal-service-key-at-least-32-chars',
  ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  COOKIE_SECURE: 'false',
  ENABLE_FAKE_OTP: 'true',
  ENABLE_FAKE_OAUTH: 'true',
  IDENTITY_API_URL: 'http://localhost:4001',
  CARDS_SERVICE_URL: 'http://localhost:4003',
  NEXT_PUBLIC_CARDS_API_URL: 'http://localhost:4003',
  DEMO_LEADS_PANEL: 'true',
  NEXT_PUBLIC_DEMO_LEADS_PANEL: 'true',
};
for (const [key, value] of Object.entries(DEV_DEFAULTS)) {
  if (!process.env[key]) process.env[key] = value;
}

const PORTS = { identity: 4001, organization: 4002, cards: 4003 };

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/onebridge_dev';
const isLocal = mongoUri.includes('localhost') || mongoUri.includes('127.0.0.1') || mongoUri.includes('::1');
if (!isLocal && process.env.ALLOW_REMOTE_SEED !== 'true') {
  console.error(`[OneBridge Dev] ERROR: Refusing non-local MONGODB_URI "${mongoUri}" without ALLOW_REMOTE_SEED=true`);
  process.exit(1);
}

let mongodInstance = null;
let activeMongoUri = mongoUri;
const childProcesses = [];
const nestApps = [];
let mongoHandle = null;

function log(msg) {
  console.log(`[OneBridge Dev] ${msg}`);
}

function runSync(label, args) {
  log(`${label}...`);
  const result = spawnSync('pnpm', args, { cwd: rootDir, stdio: 'inherit', shell: isWindows });
  if (result.status !== 0) {
    throw new Error(`${label} failed (exit ${result.status})`);
  }
}

async function ensureMongo() {
  log(`Checking MongoDB at ${activeMongoUri}...`);
  try {
    const client = new MongoClient(activeMongoUri, { serverSelectionTimeoutMS: 2000 });
    await client.connect();
    await client.close();
    log('Connected to existing MongoDB.');
  } catch {
    log('Local MongoDB not detected. Starting in-memory MongoDB on port 27017...');
    mongodInstance = await MongoMemoryServer.create({ instance: { port: 27017, dbName: 'onebridge_dev' } });
    activeMongoUri = `${mongodInstance.getUri()}onebridge_dev`;
  }
  process.env.MONGODB_URI = activeMongoUri;
}

/** Import a built module by repo-relative path (Windows needs file:// URLs). */
function importDist(relPath) {
  return import(pathToFileURL(path.join(rootDir, relPath)).href);
}

function startNextApp(name, filter, port) {
  // shell: true on Windows: Node refuses to spawn .cmd shims without a shell (EINVAL).
  const child = spawn('pnpm', ['--filter', filter, 'exec', 'next', 'dev', '-p', port], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: isWindows,
    env: process.env,
  });
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) console.error(`[OneBridge Dev] ${name} exited with code ${code}`);
  });
  childProcesses.push(child);
}

async function main() {
  runSync('Building shared packages', ['--filter', '@onebridge/shared', '--filter', '@onebridge/api-contracts', 'run', 'build']);
  runSync('Building services', ['--filter', '@onebridge/identity', '--filter', '@onebridge/organization', '--filter', '@onebridge/cards', 'run', 'build']);

  await ensureMongo();

  // Imported after env defaults are set: config modules read env at load.
  const shared = await importDist('packages/shared/dist/index.js');
  const identity = await importDist('services/identity/dist/app.js');
  const identityEnv = await importDist('services/identity/dist/config/env.js');
  const { seedDevDatabase } = await importDist('services/identity/dist/infrastructure/seed.js');
  const organization = await importDist('services/organization/dist/app.js');
  const organizationEnv = await importDist('services/organization/dist/config/env.js');
  const cards = await importDist('services/cards/dist/app.js');
  const cardsEnv = await importDist('services/cards/dist/config/env.js');

  mongoHandle = await shared.connectMongo(activeMongoUri);

  const seedResult = await seedDevDatabase(mongoHandle);
  log(`Identity seed: ${seedResult.message}`);

  const eventBus = new shared.InMemoryEventBus();

  const identityApp = await identity.createApp({
    envConfig: { ...identityEnv.loadAndValidateEnv(), port: PORTS.identity },
    connectionHandle: mongoHandle,
  });
  await identityApp.listen(PORTS.identity);
  nestApps.push(identityApp);

  // Cards starts before organization so its read-model subscriptions exist
  // before any organization event is published.
  const cardsApp = await cards.createApp({
    envConfig: { ...cardsEnv.loadAndValidateEnv(), port: PORTS.cards },
    connectionHandle: mongoHandle,
    eventBus,
  });
  await cardsApp.listen(PORTS.cards);
  nestApps.push(cardsApp);

  const organizationApp = await organization.createApp({
    envConfig: { ...organizationEnv.loadAndValidateEnv(), port: PORTS.organization },
    connectionHandle: mongoHandle,
    eventBus,
  });
  await organizationApp.listen(PORTS.organization);
  nestApps.push(organizationApp);

  // Well-formed companies for the tenants identity's seed gives memberships
  // to, published as org.created so the cards read model has them too.
  const { seedDevOrganizations } = await importDist('services/organization/dist/infrastructure/dev-seed.js');
  const { SEED_DATA } = await importDist('services/identity/dist/infrastructure/seed.data.js');
  const orgSeed = await seedDevOrganizations(
    mongoHandle,
    eventBus,
    Object.values(SEED_DATA.tenants).map((t) => ({ id: t.id, name: t.name, plan: t.plan })),
    process.env.NODE_ENV
  );
  log(`Organization seed: created ${orgSeed.created.length}, already present ${orgSeed.skipped.length}`);

  log(`Services ready: identity :${PORTS.identity}, organization :${PORTS.organization}, cards :${PORTS.cards} (shared event bus)`);

  startNextApp('web-app', '@onebridge/web-app', WEB_APP_PORT);
  startNextApp('web-public', '@onebridge/web-public', WEB_PUBLIC_PORT);
  log(`Admin dashboard: http://localhost:${WEB_APP_PORT}   Visitor cards: http://localhost:${WEB_PUBLIC_PORT}`);
}

async function cleanup() {
  log('Shutting down...');
  for (const child of childProcesses) {
    try {
      child.kill('SIGINT');
    } catch {
      // already exited
    }
  }
  for (const app of nestApps) {
    await app.close().catch(() => {});
  }
  if (mongoHandle) await mongoHandle.close().catch(() => {});
  if (mongodInstance) await mongodInstance.stop().catch(() => {});
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

main().catch(async (err) => {
  console.error('[OneBridge Dev] Startup error:', err);
  await cleanup();
});
