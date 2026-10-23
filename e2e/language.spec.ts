import { test, expect } from '@playwright/test';
test('Chinese device locale, drawing, names, export and persistent language switch', async ({
  browser,
}) => {
  const context = await browser.newContext({
    locale: 'zh-CN',
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:5173');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await page.getByRole('button', { name: '新建画作', exact: true }).click();
  await page.getByRole('button', { name: '画笔', exact: true }).click();
  await page.locator('canvas').click();
  await expect(page.getByRole('status')).toHaveText('已保存');
  await page.getByRole('button', { name: '选择颜色', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '选择喜欢的颜色' })).toBeVisible();
  await page.getByRole('button', { name: '关闭对话框' }).click();
  await page.getByRole('button', { name: '返回画册', exact: true }).click();
  await page.getByLabel('画作名称').fill('我的画作');
  await page.getByRole('button', { name: '保存画作', exact: true }).click();
  await page.getByRole('button', { name: '打开 我的画作', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '分享', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('我的画作.png');
  await page.getByRole('button', { name: '更多选项' }).click();
  await page.getByRole('button', { name: 'Language / 语言' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();
  await page.reload();
  await expect(page.getByRole('button', { name: 'New drawing', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Language / 语言' }).click();
  await expect(page.getByRole('button', { name: '新建画作', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/gallery-chinese.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await context.close();
});
