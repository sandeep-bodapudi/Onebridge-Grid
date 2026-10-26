/**
 * Hosted prototype as ONE web service (D-SINGLE-SERVICE): the API, the admin
 * app and the public site run as three local processes behind one public port,
 * so the whole product is one URL, one build and one start command.
 *
 *   /svc/<service>/*        -> API (identity, organization, cards), /svc stripped
 *   /healthz, /demo/reset   -> API
 *   /, /login, /dashboard, /demo-access, /api/demo-access, /_next, /fonts -> admin app (apps/web-app)
 *   /_cards/*               -> public site's assets (assetPrefix, stripped)
 *   everything else         -> public site (apps/web-public): /c/..., /r/..., /<company>, its /api routes
 *
 * Build:  node scripts/single-build.mjs
 * Start:  node scripts/single-server.mjs
 *
 * Demo data only: fake OTP (code 123456) and an in-memory database re-seeded on
 * every start, exactly like scripts/demo-server.mjs (D-DEMO-HOSTING).
 */
import http from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const log = (msg) => console.log(`[single-server] ${msg}`);

const PORT = Number(process.env.PORT || 10000);
const API_PORT = 8080;
const ADMIN_PORT = 3100;
const PUBLIC_PORT = 3200;
const PUBLIC_ASSET_PREFIX = '/_cards';

// Normalised origin (lowercase host, no trailing slash): services compare it exactly with the browser's Origin header.
const publicUrl = new URL(process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`).origin;

// Secrets: required when data persists (MONGODB_URI); otherwise the database is
// thrown away on every restart, so fresh random values per boot are safe.
const SECRETS = { JWT_SECRET: 48, INTERNAL_SERVICE_KEY: 48, REVALIDATION_SIGNING_SECRET: 48, ENCRYPTION_KEY: 32 };
for (const [key, bytes] of Object.entries(SECRETS)) {
  if (process.env[key]) continue;
  if (process.env.MONGODB_URI) {
    console.error(`[single-server] ${key} must be set when MONGODB_URI is set (data would become unreadable after a restart).`);
    process.exit(1);
  }
  process.env[key] = crypto.randomBytes(bytes).toString('hex');
}

const shared = {
  ...process.env,
  DEMO_MODE: 'true',
  APP_URL: publicUrl,
  WEB_PUBLIC_URL: publicUrl,
};

const children = [];
function start(name, command, args, cwd, env) {
  const child = spawn(command, args, { cwd, env, stdio: 'inherit' });
  child.on('exit', (code, signal) => {
    log(`${name} exited (${signal || code}); stopping so the host restarts the service`);
    shutdown(code || 1);
  });
  children.push(child);
  return child;
}

const nextBin = (app) => path.join(rootDir, 'apps', app, 'node_modules', 'next', 'dist', 'bin', 'next');

// The demo API runs the fake OTP provider, which only exists outside production (D-DEMO-HOSTING),
// so it is always started in development mode even if the host sets NODE_ENV=production.
start('api', process.execPath, [path.join(rootDir, 'scripts/demo-server.mjs')], rootDir, { ...shared, NODE_ENV: 'development', PORT: String(API_PORT) });
start('admin app', process.execPath, [nextBin('web-app'), 'start', '-p', String(ADMIN_PORT), '-H', '127.0.0.1'], path.join(rootDir, 'apps/web-app'), {
  ...shared,
  NODE_ENV: 'production',
  PORT: String(ADMIN_PORT),
  API_PROXY_TARGET: `http://127.0.0.1:${API_PORT}`,
});
start('public site', process.execPath, [nextBin('web-public'), 'start', '-p', String(PUBLIC_PORT), '-H', '127.0.0.1'], path.join(rootDir, 'apps/web-public'), {
  ...shared,
  NODE_ENV: 'production',
  PORT: String(PUBLIC_PORT),
  CARDS_SERVICE_URL: `http://127.0.0.1:${API_PORT}/cards`,
  // next.config is read again at start, so the asset prefix must match the build.
  ASSET_PREFIX: PUBLIC_ASSET_PREFIX,
});

const ADMIN_PATHS = [/^\/$/, /^\/(login|dashboard|demo-access)(\/|$)/, /^\/api\/demo-access(\/|$)/, /^\/_next\//, /^\/fonts\//, /^\/favicon\.ico$/];

function route(url) {
  const pathname = url.split('?')[0];
  if (pathname === '/healthz' || pathname === '/demo/reset') return { port: API_PORT, path: url };
  const svc = url.match(/^\/svc(\/(identity|organization|cards)(\/.*)?)$/);
  if (svc) return { port: API_PORT, path: svc[1] };
  if (pathname.startsWith(`${PUBLIC_ASSET_PREFIX}/`)) return { port: PUBLIC_PORT, path: url.slice(PUBLIC_ASSET_PREFIX.length) };
  if (ADMIN_PATHS.some((re) => re.test(pathname))) return { port: ADMIN_PORT, path: url };
  return { port: PUBLIC_PORT, path: url };
}

const server = http.createServer((req, res) => {
  const target = route(req.url || '/');
  const headers = { ...req.headers, host: req.headers.host || `127.0.0.1:${target.port}` };
  headers['x-forwarded-for'] = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '');
  headers['x-forwarded-proto'] = String(req.headers['x-forwarded-proto'] || 'http');
  headers['x-forwarded-host'] = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  const upstream = http.request({ host: '127.0.0.1', port: target.port, path: target.path, method: req.method, headers }, (up) => {
    res.writeHead(up.statusCode || 502, up.headers);
    up.pipe(res);
  });
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '10' });
    res.end('OneBridge Grid is starting. Refresh in a few seconds.');
  });
  req.pipe(upstream);
});

let stopping = false;
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  server.close();
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 1500);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

server.listen(PORT, () => log(`OneBridge Grid on :${PORT} (public URL ${publicUrl})`));
