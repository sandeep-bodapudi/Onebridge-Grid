/**
 * The NEXT_PUBLIC_* values baked into the browser code of both Next apps. One list, shared by the
 * Render demo build (scripts/single-build.mjs) and the VPS image build (deploy/build.mjs), so a
 * new service is added in one place (D-VPS-DEPLOY B4).
 */
export const SERVICES = ['identity', 'organization', 'cards', 'profiles', 'social', 'search', 'messaging'];

/**
 * @param {string} publicUrl  Site origin, e.g. https://onebridgecard.com ('' = the browser's own origin)
 * @param {{ demo: boolean }} options  demo: the hosted prototype's leads panel and one-tap demo sign-in
 */
export function nextPublicEnv(publicUrl, { demo }) {
  const env = { NEXT_PUBLIC_WEB_PUBLIC_URL: publicUrl };
  for (const s of SERVICES) env[`NEXT_PUBLIC_${s.toUpperCase()}_API_URL`] = `/svc/${s}`;
  if (demo) {
    env.NEXT_PUBLIC_DEMO_LEADS_PANEL = process.env.NEXT_PUBLIC_DEMO_LEADS_PANEL || 'true';
    env.NEXT_PUBLIC_DEMO_PHONE = process.env.NEXT_PUBLIC_DEMO_PHONE || '+919988776655';
  } else {
    // Production: the demo panel and one-tap demo sign-in are off (B3).
    env.NEXT_PUBLIC_DEMO_LEADS_PANEL = 'false';
    env.NEXT_PUBLIC_DEMO_PHONE = '';
    env.NEXT_PUBLIC_DEMO_OTP = '';
  }
  return env;
}

/** The build commands both builds run, in order. */
export const BUILD_STEPS = [
  { cmd: 'pnpm --filter "@onebridge/shared" --filter "@onebridge/api-contracts" run build' },
  { cmd: `pnpm ${SERVICES.map((s) => `--filter "@onebridge/${s}"`).join(' ')} run build` },
  // Next.js must build with NODE_ENV=production: a host-level NODE_ENV=development makes the
  // prerender mix dev and prod React runtimes ("Cannot read properties of null (reading 'useContext')").
  { cmd: 'pnpm --filter "@onebridge/web-app" run build', env: { NODE_ENV: 'production' } },
  // The public site's assets are served under /_cards so they never clash with the admin app's /_next.
  { cmd: 'pnpm --filter "@onebridge/web-public" run build', env: { NODE_ENV: 'production', ASSET_PREFIX: '/_cards' } },
];
