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
import { BUILD_STEPS, nextPublicEnv } from './lib/next-public-env.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Empty when unknown at build time: the browser then uses its own address (same origin).
const rawPublicUrl = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '';
const publicUrl = rawPublicUrl ? new URL(rawPublicUrl).origin : '';

const env = { ...process.env, ...nextPublicEnv(publicUrl, { demo: true }) };

const run = (cmd, extra = {}) => {
  console.log(`[single-build] ${cmd}`);
  execSync(cmd, { cwd: rootDir, stdio: 'inherit', env: { ...env, ...extra } });
};

console.log(`[single-build] Public URL: ${publicUrl || '(same origin as the browser)'}`);
for (const step of BUILD_STEPS) run(step.cmd, step.env);
console.log('[single-build] Done');
