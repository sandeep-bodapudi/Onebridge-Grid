/**
 * Production API for the VPS (D-VPS-DEPLOY B2): every service in ONE Node process sharing ONE
 * InMemoryEventBus (the composition `pnpm dev` and the demo use, ADR-0003), behind one port.
 * Caddy strips /svc and forwards here:
 *
 *   $PORT/<service>/*        -> identity 4001, organization 4002, cards 4003, profiles 4004,
 *                               social 4005, search 4006, messaging 4007 (127.0.0.1 only)
 *   $PORT/messaging/realtime -> WebSocket upgrade to messaging
 *   $PORT/healthz            -> 200 only when every service answers and MongoDB pings
 *
 * Unlike demo-server.mjs: a real MongoDB is required, nothing is seeded, there is no reset
 * endpoint, demo switches are refused, and NODE_ENV is production.
 *
 * Build first (the Docker image does): shared, api-contracts and every service's dist.
 * Run: node scripts/prod-api.mjs
 */
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { proxy, proxyUpgrade, servicesAnswer } from './lib/proxy.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const log = (msg) => console.log(JSON.stringify({ level: 'info', source: 'prod-api', message: msg }));
const fail = (msg) => {
  console.error(JSON.stringify({ level: 'error', source: 'prod-api', message: msg }));
  process.exit(1);
};

// ---- B3: demo features are off in production ------------------------------------------------
process.env.NODE_ENV = 'production';
const DEMO_SWITCHES = ['ENABLE_FAKE_OTP', 'ALLOW_FAKE_OTP', 'ENABLE_FAKE_OAUTH', 'DEMO_LEADS_PANEL', 'DEMO_MODE', 'DEMO_ACCESS_PASSCODE', 'ALLOW_REMOTE_SEED'];
const onSwitches = DEMO_SWITCHES.filter((k) => process.env[k] && process.env[k] !== 'false');
if (onSwitches.length) fail(`Demo or development switches must be unset or false in production: ${onSwitches.join(', ')}`);

// ---- Required settings (names only in messages, never values) --------------------------------
const methods = (process.env.AUTH_METHODS || 'google,email').split(',').map((m) => m.trim().toLowerCase());
const required = [
  'MONGODB_URI',
  'APP_URL',
  'WEB_PUBLIC_URL',
  'JWT_SECRET',
  'INTERNAL_SERVICE_KEY',
  'ENCRYPTION_KEY',
  'REVALIDATION_SIGNING_SECRET',
  'MEDIA_DIR',
  'SMTP_HOST',
  'EMAIL_FROM',
  ...(methods.includes('google') ? ['GOOGLE_CLIENT_ID'] : []),
];
const missing = required.filter((k) => !(process.env[k] || '').trim());
if (missing.length) fail(`Missing environment variables: ${missing.join(', ')}`);

const DEFAULTS = {
  EMAIL_PROVIDER: 'smtp',
  COOKIE_SECURE: 'true',
  // The browser reaches identity at /svc/identity/*, so the refresh and device cookies are scoped there.
  COOKIE_PATH: '/svc/identity/auth',
  IDENTITY_API_URL: 'http://127.0.0.1:4001',
  SHORT_LINK_BASE_URL: `${process.env.WEB_PUBLIC_URL}/r`,
};
for (const [k, v] of Object.entries(DEFAULTS)) if (!process.env[k]) process.env[k] = v;

const PORT = Number(process.env.PORT || 8080);
const TARGETS = { identity: 4001, organization: 4002, cards: 4003, profiles: 4004, social: 4005, search: 4006, messaging: 4007 };
const apps = [];
let handle = null;
let ready = false;
let stopping = false;

const importDist = (rel) => import(pathToFileURL(path.join(rootDir, rel)).href);

async function startServices() {
  const shared = await importDist('packages/shared/dist/index.js');
  const load = async (name) => ({
    app: await importDist(`services/${name}/dist/app.js`),
    env: await importDist(`services/${name}/dist/config/env.js`),
  });
  const [identity, organization, cards, profiles, social, search, messaging] = await Promise.all(
    ['identity', 'organization', 'cards', 'profiles', 'social', 'search', 'messaging'].map(load)
  );

  handle = await shared.connectMongo(process.env.MONGODB_URI);
  const eventBus = new shared.InMemoryEventBus();
  const local = (port) => `http://127.0.0.1:${port}`;

  // Each env loader validates its own secrets and refuses development values in production.
  const start = async (name, svc, extraEnv, withBus = true) => {
    const app = await svc.app.createApp({
      envConfig: { ...svc.env.loadAndValidateEnv(), port: TARGETS[name], ...extraEnv },
      connectionHandle: handle,
      ...(withBus ? { eventBus } : {}),
    });
    await app.listen(TARGETS[name], '127.0.0.1');
    apps.push(app);
  };

  await start('identity', identity, {}, true);
  // Cards, profiles, social, search and messaging subscribe to organization events, so they start first.
  await start('cards', cards, {});
  await start('profiles', profiles, {});
  await start('social', social, { profilesApiUrl: local(TARGETS.profiles) });
  await start('search', search, { cardsApiUrl: local(TARGETS.cards), profilesApiUrl: local(TARGETS.profiles) });
  await start('messaging', messaging, { profilesApiUrl: local(TARGETS.profiles) });
  await start('organization', organization, {});
  log('All services are running (shared event bus)');
}

async function mongoPings() {
  try {
    await handle._getInternalDb().command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}

const router = http.createServer(async (req, res) => {
  const url = req.url || '/';
  if (url === '/healthz') {
    const names = Object.keys(TARGETS);
    const answers = ready ? await servicesAnswer(Object.values(TARGETS)) : names.map(() => false);
    const mongo = ready && (await mongoPings());
    const services = Object.fromEntries(names.map((n, i) => [n, answers[i] ? 'ok' : 'down']));
    const ok = ready && mongo && answers.every(Boolean);
    res.writeHead(ok ? 200 : 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ status: ok ? 'ok' : ready ? 'degraded' : 'starting', services: { ...services, mongo: mongo ? 'ok' : 'down' } }));
    return;
  }
  const match = url.match(/^\/(identity|organization|cards|profiles|social|search|messaging)(\/.*)?$/);
  if (!match) {
    res.writeHead(404, { 'Content-Type': 'application/problem+json' });
    res.end(JSON.stringify({ title: 'Not Found', status: 404 }));
    return;
  }
  if (!ready || stopping) {
    res.writeHead(503, { 'Content-Type': 'application/problem+json', 'Retry-After': '10' });
    res.end(JSON.stringify({ title: 'Service Unavailable', status: 503, detail: 'OneBridge is starting. Try again in a moment.' }));
    return;
  }
  proxy(req, res, TARGETS[match[1]], match[2] || '/');
});

router.on('upgrade', (req, socket, head) => {
  const match = (req.url || '/').match(/^\/messaging(\/realtime(\?.*)?)$/);
  if (!ready || stopping || !match) return socket.destroy();
  proxyUpgrade(req, socket, head, TARGETS.messaging, match[1]);
});

/** SIGTERM (docker stop): stop taking requests, close every app, then MongoDB; exit within 10 s. */
async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  log('Shutting down');
  const force = setTimeout(() => process.exit(code), 10_000);
  force.unref();
  router.close();
  for (const app of apps.reverse()) await app.close().catch(() => undefined);
  if (handle) await handle.close().catch(() => undefined);
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

router.listen(PORT, '0.0.0.0', () => log(`Listening on :${PORT}`));
startServices()
  .then(() => {
    ready = true;
  })
  .catch(async (err) => {
    // Env errors name the variable only; never print values.
    console.error(JSON.stringify({ level: 'error', source: 'prod-api', message: 'Startup failed', reason: err instanceof Error ? err.message : String(err) }));
    await shutdown(1);
  });
