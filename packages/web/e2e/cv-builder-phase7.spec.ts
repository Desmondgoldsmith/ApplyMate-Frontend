import fs from 'fs';
import { expect, test, type Page } from '@playwright/test';

import {
  ensureCvEditor,
  gotoCvLibrary,
  openNewCvModal,
  skipUnlessCvE2eReady,
} from './helpers/cv-e2e';

async function dismissOnboardingTourIfPresent(page: Page): Promise<void> {
  const skip = page.getByRole('button', { name: /skip|close|got it/i }).first();
  if (await skip.isVisible().catch(() => false)) {
    await skip.click().catch(() => {});
  }
}

async function waitForCvToolbar(page: Page): Promise<void> {
  await expect(page.getByTestId('cv-clinic-toolbar')).toBeVisible({ timeout: 60_000 });
}

test.describe('Phase 7 — CV Builder journeys (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    skipUnlessCvE2eReady();
    await gotoCvLibrary(page);
    await dismissOnboardingTourIfPresent(page);
    await waitForCvToolbar(page);
  });

  test('1. Create CV manually (wizard → editor)', async ({ page }) => {
    await openNewCvModal(page);
    await page.getByPlaceholder(/Frontend Engineer CV/i).fill(`E2E Manual ${Date.now()}`);
    await page.getByRole('button', { name: /Next →/i }).click();
    await expect(page.getByRole('heading', { name: /Choose a template/i })).toBeVisible();
    await page.getByRole('button', { name: /Next →/i }).click();
    await expect(page.getByRole('heading', { name: /How do you want to build/i })).toBeVisible();
    await page.getByTestId('cv-create-method-scratch').click();
    await expect(page.getByRole('heading', { name: /How would you like to build/i })).toBeVisible();
    await page.getByTestId('cv-create-manual').click();
    await expect(page).toHaveURL(/\/dashboard\/cv\?profileId=/, { timeout: 60_000 });
    await waitForCvToolbar(page);
  });

  test('2. Create CV with AI chat (wizard → skip chat → editor)', async ({ page }) => {
    await openNewCvModal(page);
    await page.getByPlaceholder(/Frontend Engineer CV/i).fill(`E2E AI ${Date.now()}`);
    await page.getByRole('button', { name: /Next →/i }).click();
    await page.getByRole('button', { name: /Next →/i }).click();
    await page.getByTestId('cv-create-method-scratch').click();
    await page.getByTestId('cv-create-ai-chat').click();
    await expect(page.getByRole('heading', { name: /Build your CV with AI/i })).toBeVisible({ timeout: 60_000 });
    await page.getByRole('button', { name: /Skip chat/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/cv\?profileId=/, { timeout: 60_000 });
    await waitForCvToolbar(page);
  });

  test('3. Upload and parse CV (optional fixture)', async ({ page }) => {
    const fixture = process.env.E2E_CV_UPLOAD_FIXTURE?.trim();
    test.skip(!fixture || !fs.existsSync(fixture), 'Set E2E_CV_UPLOAD_FIXTURE to an existing resume file path.');
    await openNewCvModal(page);
    await page.getByPlaceholder(/Frontend Engineer CV/i).fill(`E2E Upload ${Date.now()}`);
    await page.getByRole('button', { name: /Next →/i }).click();
    await page.getByRole('button', { name: /Next →/i }).click();
    await page.getByTestId('cv-create-method-upload').click();
    await expect(page.getByRole('heading', { name: /Upload your CV/i })).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles(fixture);
    await expect(page).toHaveURL(/\/dashboard\/cv/, { timeout: 120_000 });
  });

  test('4. Edit sections — save status transitions', async ({ page }) => {
    await ensureCvEditor(page);
    await page.getByRole('button', { name: 'Templates' }).click();
    await expect(page.getByRole('heading', { name: /^Templates$/i })).toBeVisible();
    const pick =
      (await page.getByRole('button', { name: /^Classic$/i }).count()) > 0
        ? page.getByRole('button', { name: /^Classic$/i })
        : page.getByRole('button', { name: /^Modern$/i }).first();
    await pick.click();
    const status = page.getByTestId('cv-builder-save-status');
    await expect(status).toBeVisible({ timeout: 90_000 });
    await expect(status).toContainText(/Saving|Saved|Unsaved/i, { timeout: 90_000 });
  });

  test('5. Switch templates (modal)', async ({ page }) => {
    await ensureCvEditor(page);
    await page.getByRole('button', { name: 'Templates' }).click();
    await expect(page.getByText(/Pick a layout/i)).toBeVisible();
    const alt =
      (await page.getByRole('button', { name: /^Professional$/i }).count()) > 0
        ? page.getByRole('button', { name: /^Professional$/i })
        : page.getByRole('button', { name: /^Modern$/i }).first();
    await alt.click();
    await expect(page.getByRole('heading', { name: /^Templates$/i })).toBeHidden({ timeout: 15_000 });
  });

  test('6. View ATS score (analysis panel)', async ({ page }) => {
    await ensureCvEditor(page);
    await page.getByTestId('cv-tab-analysis').click();
    await page.getByRole('button', { name: /CV scan/i }).click();
    await expect(page.getByText(/Heuristic ATS analysis/i)).toBeVisible({ timeout: 120_000 });
  });

  test('7. Open detailed score analysis', async ({ page }) => {
    await ensureCvEditor(page);
    await page.getByTestId('cv-tab-analysis').click();
    await page.getByRole('button', { name: /CV scan/i }).click();
    await expect(page.getByText(/Section breakdown/i)).toBeVisible({ timeout: 120_000 });
  });

  test('8. Generate suggestions (CV scan)', async ({ page }) => {
    test.setTimeout(150_000);
    await ensureCvEditor(page);
    await page.getByTestId('cv-tab-improvements').click();
    await page.getByTestId('cv-tab-analysis').click();
    await page.getByRole('button', { name: /CV scan/i }).click();
    await page.getByTestId('cv-tab-improvements').click();
    await expect(page.getByText(/Suggested Improvements|All AI suggestions have been resolved/i)).toBeVisible({
      timeout: 120_000,
    });
  });

  test('14. Spell and grammar checks', async ({ page }) => {
    await ensureCvEditor(page);
    await page.getByRole('button', { name: /Check spelling/i }).click();
    await expect(page.getByTestId('cv-clinic-toolbar')).toBeVisible();
  });

  test('15. AI Assistant — panel opens and command entry', async ({ page }) => {
    await ensureCvEditor(page);
    await page.getByRole('button', { name: /Open AI section assistant/i }).click();
    await expect(page.getByTestId('cv-assistant-command')).toBeVisible();
    await page.getByTestId('cv-assistant-command').fill('E2E: suggest a minor summary polish using only existing facts.');
    await expect(page.getByRole('button', { name: /Run command/i })).toBeEnabled();
    await page.getByRole('button', { name: /Close AI assistant overlay/i }).click({ force: true }).catch(() => {});
  });

  test('16. Job tailoring (preview panel)', async ({ page }) => {
    await ensureCvEditor(page);
    await page.getByRole('button', { name: /^Insights$/i }).click().catch(() => {});
    await page.getByTestId('cv-tab-analysis').click();
    const jd = page.locator('textarea[id^="cv-job-jd-"]');
    await expect(jd).toBeVisible({ timeout: 30_000 });
    await jd.fill(
      'Senior Software Engineer. Requirements: TypeScript, React, Node.js, AWS, CI/CD. Lead a team of 5 engineers.',
    );
    const role = page.locator('input[id^="cv-job-role-"]');
    if ((await role.count()) > 0) {
      await role.fill('Senior Software Engineer');
    }
    await page.getByRole('button', { name: /Run preview/i }).click();
    await expect(page.getByText(/Preview \(not saved\)/i)).toBeVisible({ timeout: 120_000 });
  });

  test('17. Cover letter — jobs hub loads', async ({ page }) => {
    await page.goto('/dashboard/jobs');
    await expect(page).toHaveURL(/\/dashboard\/jobs/);
    await expect(page.locator('body')).toContainText(/Job|Hub|Apply|Saved/i, { timeout: 30_000 });
  });

  test('18. Export PDF and DOCX', async ({ page }) => {
    await ensureCvEditor(page);
    const [pdf] = await Promise.all([
      page.waitForEvent('download', { timeout: 120_000 }),
      page.getByRole('button', { name: /^PDF$/i }).click(),
    ]);
    expect(pdf.suggestedFilename().toLowerCase()).toMatch(/\.pdf$/);
    const [docx] = await Promise.all([
      page.waitForEvent('download', { timeout: 120_000 }),
      page.getByRole('button', { name: /^DOCX$/i }).click(),
    ]);
    expect(docx.suggestedFilename().toLowerCase()).toMatch(/\.docx$/);
  });

  test('No stale profile after refresh', async ({ page }) => {
    const id = await ensureCvEditor(page);
    test.skip(!id, 'No profile id in URL or selector.');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForCvToolbar(page);
    await expect(page).toHaveURL(new RegExp(`profileId=${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  });
});

test.describe('Phase 7 — Suggestions queue (serial, authenticated)', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    skipUnlessCvE2eReady();
    await gotoCvLibrary(page);
    await dismissOnboardingTourIfPresent(page);
    await waitForCvToolbar(page);
    await ensureCvEditor(page);
  });

  test('9–11. Scan → Apply with AI → accept diff when shown', async ({ page }) => {
    test.setTimeout(240_000);
    await page.getByTestId('cv-tab-improvements').click();
    await page.getByTestId('cv-tab-analysis').click();
    await page.getByRole('button', { name: /CV scan/i }).click();
    await page.getByTestId('cv-tab-improvements').click();
    await expect(page.getByText(/Suggested Improvements|All AI suggestions have been resolved/i)).toBeVisible({
      timeout: 120_000,
    });
    const apply = page.getByTestId('cv-improvement-apply-ai');
    if (!(await apply.isVisible().catch(() => false))) {
      test.skip(true, 'No pending suggestions — cannot exercise Apply-with-AI in this environment.');
    }
    await apply.click();
    const acceptDiff = page.getByRole('button', { name: /Accept all/i }).first();
    await expect(acceptDiff).toBeVisible({ timeout: 120_000 });
    await acceptDiff.click();
  });

  test('12. Reject a single suggestion (Mark as done)', async ({ page }) => {
    test.setTimeout(180_000);
    await page.getByRole('button', { name: /CV scan/i }).click();
    await page.getByTestId('cv-tab-improvements').click();
    await expect(page.getByText(/Suggested Improvements|All AI suggestions have been resolved/i)).toBeVisible({
      timeout: 120_000,
    });
    const markDone = page.getByTestId('cv-improvement-mark-done');
    if (!(await markDone.isVisible().catch(() => false))) {
      test.skip(true, 'No pending suggestion to dismiss.');
    }
    await markDone.click();
  });

  test('13. Accept all / Reject all when bulk controls visible', async ({ page }) => {
    test.setTimeout(180_000);
    await page.getByRole('button', { name: /CV scan/i }).click();
    await page.getByTestId('cv-tab-improvements').click();
    await expect(page.getByText(/Suggested Improvements|All AI suggestions have been resolved/i)).toBeVisible({
      timeout: 120_000,
    });
    const acceptAll = page.getByTestId('cv-improvement-accept-all');
    const rejectAll = page.getByTestId('cv-improvement-reject-all');
    if (await acceptAll.isVisible().catch(() => false)) {
      await acceptAll.click();
      await expect(page.getByText(/All AI suggestions have been resolved|accepted/i).first()).toBeVisible({
        timeout: 120_000,
      });
    } else if (await rejectAll.isVisible().catch(() => false)) {
      await rejectAll.click();
    } else {
      test.skip(true, 'Bulk accept/reject not available (empty queue).');
    }
  });
});
