import { expect, test } from '@playwright/test';

test('active layer can be resized by dragging corner handles', async ({ page }) => {
  await page.goto('/');

  await page.click('#add-layer');

  const canvas = page.locator('#main-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Main canvas bounding box unavailable');

  const startX = box.x + 560;
  const startY = box.y + 420;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 40, startY + 30);
  await page.mouse.up();

  await expect(page.locator('#transform-w')).toHaveValue('360');
  await expect(page.locator('#transform-h')).toHaveValue('270');
});
