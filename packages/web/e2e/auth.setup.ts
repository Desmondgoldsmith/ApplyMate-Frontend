import fs from 'fs';
import path from 'path';
import { test as setup } from '@playwright/test';

const authPath = path.join(__dirname, '.auth', 'user.json');

/**
 * Runs first (see `playwright.config.ts` project dependencies). Writes `e2e/.auth/user.json`
 * for the main Chromium project. With `E2E_LOGIN_EMAIL` + `E2E_LOGIN_PASSWORD`, performs login;
 * if `PLAYWRIGHT_STORAGE_STATE` points at an existing file, copies it; otherwise writes empty storage.
 */
setup('seed storage state', async ({ page, context }) => {
  await fs.promises.mkdir(path.dirname(authPath), { recursive: true });
  const custom = process.env.PLAYWRIGHT_STORAGE_STATE?.trim();
  if (custom && fs.existsSync(custom)) {
    await fs.promises.copyFile(custom, authPath);
    return;
  }

  const email = process.env.E2E_LOGIN_EMAIL?.trim();
  const password = process.env.E2E_LOGIN_PASSWORD?.trim();
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

  if (!email || !password) {
    await context.storageState({ path: authPath });
    return;
  }

  await page.goto(`${baseURL.replace(/\/$/, '')}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button', { name: /^Sign In$/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 90_000 });
  await context.storageState({ path: authPath });
});
