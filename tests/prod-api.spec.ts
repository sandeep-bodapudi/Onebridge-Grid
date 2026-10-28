import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const runner = path.resolve(__dirname, '../scripts/prod-api.mjs');

/** Runs the production API runner with only the given environment and returns its exit and output. */
function run(env: Record<string, string>) {
  const res = spawnSync(process.execPath, [runner], { env: { PATH: process.env.PATH ?? '', SystemRoot: process.env.SystemRoot ?? '', ...env }, encoding: 'utf8', timeout: 20_000 });
  return { code: res.status, out: `${res.stdout}${res.stderr}` };
}

describe('D-VPS-DEPLOY B2/B3: production API runner start-up checks', () => {
  it('refuses demo and development switches', () => {
    for (const name of ['ENABLE_FAKE_OTP', 'ENABLE_FAKE_OAUTH', 'DEMO_LEADS_PANEL', 'DEMO_MODE', 'DEMO_ACCESS_PASSCODE', 'ALLOW_REMOTE_SEED']) {
      const { code, out } = run({ [name]: 'true' });
      expect(code, name).toBe(1);
      expect(out).toContain(name);
    }
  });

  it('lists missing settings by name and never prints values', () => {
    const { code, out } = run({ JWT_SECRET: 'super-secret-value-that-must-not-print-0123456789', AUTH_METHODS: 'email' });
    expect(code).toBe(1);
    expect(out).toContain('Missing environment variables: MONGODB_URI');
    expect(out).toContain('ENCRYPTION_KEY');
    expect(out).not.toContain('GOOGLE_CLIENT_ID');
    expect(out).not.toContain('super-secret-value');
  });

  it('needs GOOGLE_CLIENT_ID while Google sign-in is on (the default)', () => {
    expect(run({}).out).toContain('GOOGLE_CLIENT_ID');
  });
});
