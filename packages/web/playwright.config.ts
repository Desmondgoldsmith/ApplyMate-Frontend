import path from 'path';

import { defineConfig, devices } from '@playwright/test';

const pkgRoot = __dirname;
const authStorage = path.join(pkgRoot, 'e2e', '.auth', 'user.json');

/**
 * E2E for @applymate/web. Start the app (`npm run dev` in `packages/web`), then:
 * `npm run test:e2e`
 *
 * Authenticated CV journeys (`PLAYWRIGHT_CV_E2E=1`): set `E2E_LOGIN_EMAIL` and `E2E_LOGIN_PASSWORD`
 * so the `setup` project can persist `e2e/.auth/user.json`, or pre-generate storage and set `PLAYWRIGHT_STORAGE_STATE`.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: authStorage,
      },
    },
  ],
});
