import { expect, test } from '@playwright/test';

test('undo/redo restores layer creation and transform edits', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#undo-action')).toBeDisabled();
  await expect(page.locator('#redo-action')).toBeDisabled();

  await page.click('#add-layer-btn');
  await page.click('.add-layer-action[data-add-layer="image"]');
  await expect(page.locator('.layer-item')).toHaveCount(1);
  await expect(page.locator('#undo-action')).toBeEnabled();

  await page.click('#undo-action');
  await expect(page.locator('.layer-item')).toHaveCount(0);
  await expect(page.locator('#redo-action')).toBeEnabled();

  await page.keyboard.press('Control+Shift+Z');
  await expect(page.locator('.layer-item')).toHaveCount(1);

  await page.fill('#transform-x', '123');
  await page.dispatchEvent('#transform-x', 'change');
  await expect(page.locator('#transform-x')).toHaveValue('123');

  await page.keyboard.press('Control+Z');
  await expect(page.locator('#transform-x')).toHaveValue('240');

  await page.keyboard.press('Control+Shift+Z');
  await expect(page.locator('#transform-x')).toHaveValue('123');
});
