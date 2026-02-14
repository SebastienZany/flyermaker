import { expect, test } from '@playwright/test';

test('zoom controls, doc size controls, checkerboard and ruler alignment', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#zoom-level')).toHaveText('100%');

  const initial = await page.locator('#canvas-wrap').boundingBox();
  if (!initial) throw new Error('Missing canvas wrap');

  await page.click('#zoom-in');
  await expect(page.locator('#zoom-level')).toHaveText('105%');

  const zoomed = await page.locator('#canvas-wrap').boundingBox();
  if (!zoomed) throw new Error('Missing zoomed canvas wrap');
  expect(Math.round(zoomed.width)).toBe(Math.round(initial.width * 1.05));

  const originX = Number(await page.locator('#ruler-h').evaluate((el) => (el as HTMLCanvasElement).dataset.originX));
  const originY = Number(await page.locator('#ruler-v').evaluate((el) => (el as HTMLCanvasElement).dataset.originY));
  const wrap = await page.locator('#canvas-wrap').boundingBox();
  const area = await page.locator('.canvas-area').boundingBox();
  if (!wrap || !area) throw new Error('Missing bounds');

  expect(Math.abs((wrap.x - area.x) - originX)).toBeLessThanOrEqual(1.5);
  expect(Math.abs((wrap.y - area.y) - originY)).toBeLessThanOrEqual(1.5);

  await page.fill('#doc-width', '1000');
  await page.fill('#doc-height', '500');
  await page.click('#apply-doc-size');
  await expect(page.locator('#status-size')).toHaveText('1000 × 500');

  const resized = await page.locator('#canvas-wrap').boundingBox();
  if (!resized) throw new Error('Missing resized bounds');
  expect(Math.round(resized.width)).toBe(Math.round(1000 * 1.05));
  expect(Math.round(resized.height)).toBe(Math.round(500 * 1.05));

  const endX = Number(await page.locator('#ruler-h').evaluate((el) => (el as HTMLCanvasElement).dataset.endX));
  const endY = Number(await page.locator('#ruler-v').evaluate((el) => (el as HTMLCanvasElement).dataset.endY));

  expect(Math.abs(endX - (originX + resized.width))).toBeLessThanOrEqual(1.5);
  expect(Math.abs(endY - (originY + resized.height))).toBeLessThanOrEqual(1.5);
});
