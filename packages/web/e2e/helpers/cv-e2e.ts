import fs from 'fs';
import path from 'path';
import { expect, test, type Page } from '@playwright/test';

/** Opt-in gate for authenticated CV flows (CI secrets + storage state). */
export const CV_E2E_ENABLED = process.env.PLAYWRIGHT_CV_E2E === '1';

const DEFAULT_STORAGE = path.join(__dirname, '..', '.auth', 'user.json');

function storageHasSessionCookie(storagePath: string): boolean {
  try {
    const raw = fs.readFileSync(storagePath, 'utf8');
    const j = JSON.parse(raw) as { cookies?: Array<{ name?: string }> };
    return Array.isArray(j.cookies) && j.cookies.length > 0;
  } catch {
    return false;
  }
}

export function skipUnlessCvE2eReady(): void {
  test.skip(!CV_E2E_ENABLED, 'Set PLAYWRIGHT_CV_E2E=1 to run authenticated CV E2E.');
  test.skip(!fs.existsSync(DEFAULT_STORAGE), 'Missing e2e/.auth/user.json — run auth.setup with E2E_LOGIN_* or PLAYWRIGHT_STORAGE_STATE.');
  test.skip(
    !storageHasSessionCookie(DEFAULT_STORAGE),
    'Storage state has no cookies — set E2E_LOGIN_EMAIL + E2E_LOGIN_PASSWORD (or PLAYWRIGHT_STORAGE_STATE with a signed-in export).',
  );
}

export async function gotoCvLibrary(page: Page): Promise<void> {
  await page.goto('/dashboard/cv');
  await expect(page).toHaveURL(/\/dashboard\/cv/);
}

/** Resolves `profileId` from URL or optional `E2E_CV_PROFILE_ID`. Opens first library CV when on hub. */
export async function ensureCvEditor(page: Page): Promise<string | null> {
  const fromEnv = process.env.E2E_CV_PROFILE_ID?.trim();
  if (fromEnv) {
    await page.goto(`/dashboard/cv?profileId=${encodeURIComponent(fromEnv)}`);
    await expect(page).toHaveURL(/profileId=/);
    return fromEnv;
  }
  const opener = page.locator('section[aria-labelledby="cv-library-heading"] ul.grid button').first();
  if (await opener.isVisible().catch(() => false)) {
    await opener.click();
    await page.waitForURL(/profileId=/, { timeout: 45_000 });
  }
  const u = new URL(page.url());
  const id = u.searchParams.get('profileId');
  if (id) return id;
  const sel = page.locator('select').filter({ has: page.locator('option') }).first();
  if ((await sel.count()) > 0) {
    const v = await sel.inputValue();
    if (v) return v;
  }
  return null;
}

export async function openNewCvModal(page: Page): Promise<void> {
  const toolbar = page.getByRole('button', { name: '+ New CV' });
  if (await toolbar.isVisible().catch(() => false)) {
    await toolbar.click();
  } else {
    await page.getByRole('button', { name: 'New CV', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: /Name your CV/i })).toBeVisible();
}
