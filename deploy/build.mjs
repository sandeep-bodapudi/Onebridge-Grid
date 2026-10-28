/**
 * VPS image build (run inside the Dockerfile's build stage). Builds shared code, every service and
 * both Next apps for production, with PUBLIC_URL baked into the browser code and demo features off.
 *
 *   PUBLIC_URL=https://onebridgecard.com node deploy/build.mjs
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILD_STEPS, nextPublicEnv } from '../scripts/lib/next-public-env.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const raw = process.env.PUBLIC_URL || '';
if (!/^https?:\/\//.test(raw)) {
  console.error('[build] PUBLIC_URL is required, e.g. https://onebridgecard.com');
  process.exit(1);
}
const publicUrl = new URL(raw).origin;
const env = { ...process.env, ...nextPublicEnv(publicUrl, { demo: false }) };

console.log(`[build] Public URL: ${publicUrl}`);
for (const step of BUILD_STEPS) {
  console.log(`[build] ${step.cmd}`);
  execSync(step.cmd, { cwd: rootDir, stdio: 'inherit', env: { ...env, ...(step.env || {}) } });
}
console.log('[build] Done');
