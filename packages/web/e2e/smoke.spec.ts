import { test, expect } from '@playwright/test';

test.describe('public smoke', () => {
  test('home or app root responds', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.ok() || res?.status() === 304 || res?.status() === 307 || res?.status() === 308).toBeTruthy();
  });
});
