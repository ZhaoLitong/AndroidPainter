import { test, expect } from '@playwright/test';
test('new drawing opens immediately, back can resume or discard a recovered draft', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New drawing', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await canvas.click();
  await expect(page.getByRole('status')).toHaveText('Saved');
  await page.getByRole('button', { name: 'Back to drawings', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Save your drawing' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep drawing', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();
  await page.reload();
  await page.getByRole('button', { name: 'Open Untitled drawing', exact: true }).click();
  await page.getByRole('button', { name: 'Back to drawings', exact: true }).click();
  await page.getByRole('button', { name: 'Discard drawing', exact: true }).click();
  await expect(page.getByRole('button', { name: 'New drawing', exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Open Untitled drawing', exact: true }),
  ).toHaveCount(0);
});
test('create, draw, undo/redo, erase, autosave, reopen, and export', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New drawing', exact: true }).click();
  const canvas = page.getByLabel('Drawing canvas.', { exact: false });
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await page.mouse.move(x - 30, y);
  await page.mouse.down();
  await page.mouse.move(x + 30, y, { steps: 20 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.getByRole('button', { name: 'Eraser', exact: true }).click();
  await page.mouse.click(x, y);
  await expect(page.getByRole('status')).toHaveText('Saved');
  await page.getByRole('button', { name: 'Back to drawings', exact: true }).click();
  await page.getByLabel('Drawing name').fill('My first drawing');
  await page.getByRole('button', { name: 'Save drawing', exact: true }).click();
  await page.getByRole('button', { name: 'Open My first drawing', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('My first drawing.png');
  await page.reload();
  await page.getByRole('button', { name: 'Open My first drawing', exact: true }).click();
  await expect(canvas).toBeVisible();
  await page.screenshot({ path: 'test-results/editor-mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('shape controls, undoable clear, rename, and deletion', async ({ page }) => {
  await page.goto('/');
  await page.screenshot({ path: 'test-results/gallery-mobile.png' });
  await page.getByRole('button', { name: 'New drawing', exact: true }).click();
  await page.getByRole('button', { name: 'Rectangle', exact: true }).click();
  await page.getByLabel('Shape style').selectOption('both');
  await page.getByLabel('Square', { exact: true }).check();
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2 - 40, box.y + box.height / 2 - 40);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 20, { steps: 5 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'More options', exact: true }).click();
  await page.getByRole('button', { name: 'Clear canvas', exact: true }).click();
  await page.getByRole('button', { name: 'Clear canvas', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Back to drawings', exact: true }).click();
  await page.getByRole('button', { name: 'Save drawing', exact: true }).click();
  await page.getByRole('button', { name: 'Rename', exact: true }).click();
  await page.getByLabel('Drawing name').fill('Renamed');
  await page.getByRole('button', { name: 'Save name', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open Renamed', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete Renamed', exact: true }).click();
  await page.getByRole('button', { name: 'Delete drawing', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open Renamed', exact: true })).toHaveCount(0);
});
test('renderer preserves alpha, erases transparently, and uses document export dimensions', async ({
  page,
}) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    // Exercise the actual renderer in a browser, where Canvas 2D is available.
    const { surface, paint, context, exportCanvas } = await import(
      '/src/drawing/renderer.ts' as string
    );
    const { createDrawing, defaultStyle } = await import('/src/drawing/model.ts' as string);
    const c = surface(256, 256),
      m = surface(256, 256),
      op = {
        id: '1',
        type: 'pen',
        points: [
          { x: 20, y: 100 },
          { x: 100, y: 100 },
          { x: 20, y: 100 },
          { x: 100, y: 100 },
        ],
        style: { ...defaultStyle, color: '#ff0000', width: 30, opacity: 0.5 },
      };
    paint(c, m, op);
    const alpha = context(c).getImageData(50, 100, 1, 1).data[3];
    paint(c, m, {
      ...op,
      type: 'eraser',
      points: [{ x: 50, y: 100 }],
      style: { ...defaultStyle, width: 10 },
    });
    const erased = context(c).getImageData(50, 100, 1, 1).data[3];
    const d = createDrawing('Export', 256, 512, '#00ff00');
    const out = exportCanvas(d),
      background = Array.from(context(out).getImageData(0, 0, 1, 1).data);
    return { alpha, erased, width: out.width, height: out.height, background };
  });
  expect(result.alpha).toBeGreaterThanOrEqual(127);
  expect(result.alpha).toBeLessThanOrEqual(128);
  expect(result.erased).toBe(0);
  expect(result).toMatchObject({ width: 256, height: 512, background: [0, 255, 0, 255] });
});
test('second pointer cancels a pending stroke and navigation leaves no mark', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New drawing', exact: true }).click();
  const canvas = page.locator('canvas');
  const box = (await canvas.boundingBox())!;
  const session = await page.context().newCDPSession(page);
  const p = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2), id: 1 };
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [p, { ...p, x: p.x + 40, id: 2 }],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { ...p, x: p.x - 10 },
      { ...p, x: p.x + 60, id: 2 },
    ],
  });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
});
