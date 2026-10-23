import { test, expect } from '@playwright/test';

test('wheel and sliders edit the selected color and stay in sync with HEX and swatches', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New drawing', exact: true }).click();
  await page.getByRole('button', { name: 'Choose colors', exact: true }).click();
  await page.getByLabel('Pen & outline HEX', { exact: true }).fill('#ff0000');
  const wheel = page.locator('.color-wheel');
  const box = (await wheel.boundingBox())!;
  await wheel.click({ position: { x: box.width / 2, y: box.height / 2 } });
  await expect(page.getByLabel('Pen & outline HEX', { exact: true })).toHaveValue('#ffffff');
  await page.getByLabel('Color wheel target', { exact: true }).selectOption('fill');
  await page.getByRole('button', { name: 'Use #619cbe', exact: true }).click();
  await expect(page.getByLabel('Shape fill HEX', { exact: true })).toHaveValue('#619cbe');
  await page.getByLabel('Brightness', { exact: true }).fill('0');
  await expect(page.getByLabel('Shape fill HEX', { exact: true })).toHaveValue('#000000');
  await page.getByLabel('Brightness', { exact: true }).fill('100');
  await expect(page.getByLabel('Shape fill HEX', { exact: true })).not.toHaveValue('#000000');
  await expect(page.getByLabel('Pen & outline HEX', { exact: true })).toHaveValue('#ffffff');
});
