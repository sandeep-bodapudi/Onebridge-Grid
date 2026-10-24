/**
 * Hosted prototype API: identity, organization and cards in ONE Node process
 * sharing ONE InMemoryEventBus (the same composition as `pnpm dev`,
 * ADR-0003 / D-F10-EVENTBUS), behind a single public port:
 *
 *   $PORT/identity/*      -> identity      (internal :4001)
 *   $PORT/organization/*  -> organization  (internal :4002)
 *   $PORT/cards/*         -> cards         (internal :4003)
 *   $PORT/healthz         -> 200 when all three answer
 *   $PORT/demo/reset      -> POST with X-Demo-Reset-Key: exits so the host restarts it with fresh demo data
 *
 * The admin app reaches it through its own /svc/* rewrites, so the refresh
 * cookie stays first-party (D-DEMO-HOSTING). Data lives in an in-memory MongoDB
 * unless MONGODB_URI is set, and the demo company is seeded on every boot.
 *
 * Build first:  pnpm --filter "@onebridge/shared" --filter "@onebridge/api-contracts" run build
 *               pnpm --filter "@onebridge/identity" --filter "@onebridge/organization" --filter "@onebridge/cards" run build
 * Then:         DEMO_MODE=true node scripts/demo-server.mjs
 */
import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const log = (msg) => console.log(`[demo-server] ${msg}`);

// This launcher runs the fake OTP provider (code 123456) and must never hold real customer data.
if (process.env.DEMO_MODE !== 'true') {
  console.error('[demo-server] Refusing to start: set DEMO_MODE=true. This server is for the hosted prototype only.');
  process.exit(1);
}
if (process.env.NODE_ENV === 'production') {
  console.error('[demo-server] NODE_ENV=production forbids the fake OTP provider; the demo runs NODE_ENV=development (D-DEMO-HOSTING).');
  process.exit(1);
}

const required = ['APP_URL', 'WEB_PUBLIC_URL', 'JWT_SECRET', 'INTERNAL_SERVICE_KEY', 'REVALIDATION_SIGNING_SECRET'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`[demo-server] Missing environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const DEFAULTS = {
  NODE_ENV: 'development',
  ENABLE_FAKE_OTP: 'true',
  COOKIE_SECURE: 'true',
  // The admin app reaches identity at /svc/identity/*, so the refresh cookie must be scoped to that path.
  COOKIE_PATH: '/svc/identity/auth',
  DEMO_LEADS_PANEL: 'true',
  REVALIDATE_WEB_PUBLIC: 'true',
  IDENTITY_API_URL: 'http://127.0.0.1:4001',
  SHORT_LINK_BASE_URL: `${process.env.WEB_PUBLIC_URL}/r`,
  ALLOW_REMOTE_SEED: process.env.MONGODB_URI ? 'true' : 'false',
};
for (const [k, v] of Object.entries(DEFAULTS)) if (!process.env[k]) process.env[k] = v;

const PORT = Number(process.env.PORT || 8080);
const TARGETS = { identity: 4001, organization: 4002, cards: 4003 };
const apps = [];
let mongod = null;
let handle = null;

const importDist = (rel) => import(pathToFileURL(path.join(rootDir, rel)).href);

async function startServices() {
  if (!process.env.MONGODB_URI) {
    log('Starting in-memory MongoDB (data resets on restart)...');
    mongod = await MongoMemoryServer.create({ instance: { dbName: 'onebridge_demo' } });
    process.env.MONGODB_URI = `${mongod.getUri()}onebridge_demo`;
  }

  const shared = await importDist('packages/shared/dist/index.js');
  const identity = await importDist('services/identity/dist/app.js');
  const identityEnv = await importDist('services/identity/dist/config/env.js');
  const organization = await importDist('services/organization/dist/app.js');
  const organizationEnv = await importDist('services/organization/dist/config/env.js');
  const cards = await importDist('services/cards/dist/app.js');
  const cardsEnv = await importDist('services/cards/dist/config/env.js');

  handle = await shared.connectMongo(process.env.MONGODB_URI);
  const eventBus = new shared.InMemoryEventBus();

  const identityApp = await identity.createApp({
    envConfig: { ...identityEnv.loadAndValidateEnv(), port: TARGETS.identity },
    connectionHandle: handle,
  });
  await identityApp.listen(TARGETS.identity, '127.0.0.1');
  apps.push(identityApp);

  // Cards subscribes to organization events, so it starts first.
  const cardsApp = await cards.createApp({
    envConfig: { ...cardsEnv.loadAndValidateEnv(), port: TARGETS.cards },
    connectionHandle: handle,
    eventBus,
  });
  await cardsApp.listen(TARGETS.cards, '127.0.0.1');
  apps.push(cardsApp);

  const organizationApp = await organization.createApp({
    envConfig: { ...organizationEnv.loadAndValidateEnv(), port: TARGETS.organization },
    connectionHandle: handle,
    eventBus,
  });
  await organizationApp.listen(TARGETS.organization, '127.0.0.1');
  apps.push(organizationApp);
  log('identity, organization and cards are running (shared event bus)');
}

function proxy(req, res, port, upstreamPath) {
  const headers = { ...req.headers, host: `127.0.0.1:${port}` };
  const forwardedFor = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  headers['x-forwarded-for'] = String(forwardedFor);
  const upstream = http.request({ host: '127.0.0.1', port, path: upstreamPath, method: req.method, headers }, (up) => {
    res.writeHead(up.statusCode || 502, up.headers);
    up.pipe(res);
  });
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/problem+json' });
    res.end(JSON.stringify({ title: 'Bad Gateway', status: 502, detail: 'The service is starting. Try again in a moment.' }));
  });
  req.pipe(upstream);
}

async function healthy() {
  const checks = await Promise.all(
    Object.values(TARGETS).map(
      (port) =>
        new Promise((resolve) => {
          const r = http.get({ host: '127.0.0.1', port, path: '/health', timeout: 2000 }, (res) => {
            res.resume();
            resolve(res.statusCode !== undefined && res.statusCode < 500);
          });
          r.on('error', () => resolve(false));
          r.on('timeout', () => {
            r.destroy();
            resolve(false);
          });
        })
    )
  );
  return checks.every(Boolean);
}

let ready = false;

const router = http.createServer(async (req, res) => {
  const url = req.url || '/';
  if (url === '/healthz') {
    const ok = ready && (await healthy());
    res.writeHead(ok ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: ok ? 'ok' : 'starting' }));
    return;
  }
  if (url === '/demo/reset' && req.method === 'POST') {
    const key = process.env.DEMO_RESET_KEY;
    if (!key || req.headers['x-demo-reset-key'] !== key) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ title: 'Forbidden', status: 403 }));
      return;
    }
    res.writeHead(202, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'restarting', detail: 'Fresh demo data in about a minute.' }));
    log('Reset requested: exiting so the host restarts with fresh demo data');
    setTimeout(() => shutdown(0), 300);
    return;
  }
  const match = url.match(/^\/(identity|organization|cards)(\/.*)?$/);
  if (!match) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ title: 'Not Found', status: 404 }));
    return;
  }
  if (!ready) {
    res.writeHead(503, { 'Content-Type': 'application/problem+json', 'Retry-After': '10' });
    res.end(JSON.stringify({ title: 'Service Unavailable', status: 503, detail: 'The demo is starting. Try again in a moment.' }));
    return;
  }
  proxy(req, res, TARGETS[match[1]], match[2] || '/');
});

function runSeed() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(rootDir, 'scripts/demo-seed.mjs')], {
      stdio: 'inherit',
      env: {
        ...process.env,
        IDENTITY_URL: `http://127.0.0.1:${TARGETS.identity}`,
        ORGANIZATION_URL: `http://127.0.0.1:${TARGETS.organization}`,
        CARDS_URL: `http://127.0.0.1:${TARGETS.cards}`,
      },
    });
    child.on('exit', (code) => resolve(code === 0));
  });
}

async function shutdown(code = 0) {
  router.close();
  for (const app of apps) await app.close().catch(() => undefined);
  if (handle) await handle.close().catch(() => undefined);
  if (mongod) await mongod.stop().catch(() => undefined);
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

router.listen(PORT, () => log(`Listening on :${PORT}`));
startServices()
  .then(async () => {
    ready = true;
    if (process.env.DEMO_SEED !== 'false') {
      const ok = await runSeed();
      log(ok ? 'Demo data ready' : 'Demo seed failed; the services are still up');
    }
  })
  .catch(async (err) => {
    console.error('[demo-server] Startup failed:', err);
    await shutdown(1);
  });
