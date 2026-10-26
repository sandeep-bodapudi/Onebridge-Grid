/**
 * Build for the single-service deployment (scripts/single-server.mjs).
 * The admin app and the public site share one URL, so both learn it at build
 * time (NEXT_PUBLIC_* values are baked into the browser code).
 *
 *   node scripts/single-build.mjs
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicUrl = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:10000').replace(/\/+$/, '');

const env = {
  ...process.env,
  NEXT_PUBLIC_IDENTITY_API_URL: '/svc/identity',
  NEXT_PUBLIC_ORGANIZATION_API_URL: '/svc/organization',
  NEXT_PUBLIC_CARDS_API_URL: '/svc/cards',
  NEXT_PUBLIC_WEB_PUBLIC_URL: publicUrl,
  NEXT_PUBLIC_DEMO_LEADS_PANEL: process.env.NEXT_PUBLIC_DEMO_LEADS_PANEL || 'true',
  NEXT_PUBLIC_DEMO_PHONE: process.env.NEXT_PUBLIC_DEMO_PHONE || '+919988776655',
};

const run = (cmd, extra = {}) => {
  console.log(`[single-build] ${cmd}`);
  execSync(cmd, { cwd: rootDir, stdio: 'inherit', env: { ...env, ...extra } });
};

console.log(`[single-build] Public URL: ${publicUrl}`);
run('pnpm --filter "@onebridge/shared" --filter "@onebridge/api-contracts" run build');
run('pnpm --filter "@onebridge/identity" --filter "@onebridge/organization" --filter "@onebridge/cards" run build');
run('pnpm --filter "@onebridge/web-app" run build');
// The public site's assets are served under /_cards so they never clash with the admin app's /_next.
run('pnpm --filter "@onebridge/web-public" run build', { ASSET_PREFIX: '/_cards' });
console.log('[single-build] Done');
