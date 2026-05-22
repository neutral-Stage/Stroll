import { test, expect } from '@playwright/test';

test('loads WebGL canvas without init errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/');
  await expect(page.locator('canvas').last()).toBeVisible({ timeout: 45_000 });

  const initFailed = errors.some((e) => e.includes('Stroll init failed'));
  expect(initFailed).toBeFalsy();
});

test('pause menu opens with Escape', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('canvas').last()).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('#main-menu.active')).toBeVisible({ timeout: 30_000 }); // Wait for loading to finish and menu to appear
  
  await page.locator('#start-game-btn').click();
  
  // Wait for transition to PLAYING state (takes ~0.66s)
  await page.waitForTimeout(1000);
  
  await expect(page.locator('#game-hud')).toBeVisible({ timeout: 15_000 }); // Wait for gameplay to start
  await page.keyboard.press('Escape'); // Open pause menu
  await expect(page.locator('#pause-menu.active')).toBeVisible();
});
