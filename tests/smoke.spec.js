import { test, expect } from '@playwright/test';

test('loads WebGL canvas without init errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible({ timeout: 45_000 });

  const initFailed = errors.some((e) => e.includes('Stroll init failed'));
  expect(initFailed).toBeFalsy();
});

test('pause menu opens with Escape', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible({ timeout: 45_000 });
  // First Escape skips intro cinematic; second opens pause
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(page.locator('#pause-menu.is-open')).toBeVisible();
  await expect(page.locator('#pause-stats')).not.toBeEmpty();
});
