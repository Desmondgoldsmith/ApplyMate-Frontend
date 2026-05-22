import { expect, test } from '@playwright/test';

import { gotoCvLibrary, skipUnlessCvE2eReady } from './helpers/cv-e2e';

test.describe('CV clinic (authenticated smoke)', () => {
  test('dashboard CV route loads with clinic chrome', async ({ page }) => {
    skipUnlessCvE2eReady();
    await gotoCvLibrary(page);
    await expect(page.getByText(/CV workspace|What would you like to do|\/100|Heuristic ATS/i).first()).toBeVisible({
      timeout: 60_000,
    });
  });
});
