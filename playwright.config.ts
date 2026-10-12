import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.e2e\.spec\.ts$/,
  timeout: 60 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm run build && node dist/e2e-launcher.js',
      cwd: './services/identity',
      url: 'http://localhost:4001/auth/sessions',
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm --filter @onebridge/web-app run dev',
      url: 'http://localhost:3000/login',
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
