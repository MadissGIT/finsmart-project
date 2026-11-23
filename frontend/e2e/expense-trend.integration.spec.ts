import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import type { Route } from '@playwright/test';
import { setPeriod, signIn, TEST_PASSWORD } from './helpers';

test('динамика расходов использует фильтр дат и серверную группировку', async ({ page, request }, info) => {
  const email = 'trend-' + randomUUID() + '@example.com';
  const registration = await request.post('/api/v1/auth/register', {
    data: { email, password: TEST_PASSWORD, full_name: 'Проверка динамики' },
  });
  expect(registration.status()).toBe(201);
  const tokens = await registration.json();
  const headers = { Authorization: 'Bearer ' + tokens.access_token };
  for (const [day, amount, category, type] of [
    ['06', 80, 1, 'DEBIT'],
    ['07', 100.5, 1, 'DEBIT'],
    ['07', 1000, 10, 'CREDIT'],
    ['10', 149.5, 1, 'DEBIT'],
    ['12', 70, 1, 'DEBIT'],
  ] as const) {
    const saved = await request.post('/api/v1/transactions', { headers, data: {
      amount, category_id: category, operation_type: type,
      transaction_date: '2026-10-' + day + 'T12:00:00+03:00', merchant_name: 'Проверка графика',
    } });
    expect(saved.status()).toBe(201);
  }

  if (info.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 700 });
  await signIn(page, email);
  await page.goto('/analytics?period=custom&from_date=2026-10-07&to_date=2026-10-14');
  const trend = page.getByRole('region', { name: 'Динамика расходов' });
  const chart = trend.getByRole('application', { name: 'Столбчатый график расходов' });
  await expect(trend.getByRole('button', { name: 'По дням' })).toHaveAttribute('aria-pressed', 'true');
  await expect(chart).toBeVisible();
  const tooltip = trend.locator('.recharts-tooltip-wrapper');
  await chart.focus();
  await expect(tooltip).toContainText(/100,5\s*₽/);
  await chart.press('ArrowRight');
  await expect(tooltip).toContainText(/8 окт/);
  await expect(tooltip).toContainText(/0\s*₽/);

  await trend.getByText('Суммы по дням').click();
  await expect(trend.getByRole('row').filter({ hasText: '7 окт.' })).toContainText(/100,5\s*₽/);
  await expect(trend.getByRole('row').filter({ hasText: '8 окт.' })).toContainText(/0\s*₽/);
  const weekly = page.waitForResponse('**/api/v1/analytics/expenses/trend?from_date=2026-10-07&to_date=2026-10-14&group_by=week');
  await trend.getByRole('button', { name: 'По неделям' }).click();
  const grouped = await weekly;
  expect(grouped.status()).toBe(200);
  expect(await grouped.json()).toEqual([{ date: '2026-10-05', amount: 250 }, { date: '2026-10-12', amount: 70 }]);
  await trend.getByText('Суммы по неделям').click();
  const rows = trend.getByRole('row');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(1)).toContainText(/7\s*[–—-]\s*11 окт.*250\s*₽/);
  await expect(rows.nth(2)).toContainText(/12\s*[–—-]\s*14 окт.*70\s*₽/);
  await trend.screenshot({ path: info.outputPath('expense-trend.png'), scale: 'css' });

  const unavailable = (route: Route) => route.fulfill({ status: 503 });
  await page.route('**/api/v1/analytics/expenses/trend?*', unavailable);
  await setPeriod(page, '2026-10-15', '2026-10-21');
  await expect(trend.getByRole('alert')).toBeVisible();
  await expect(chart).toHaveCount(0);
  await page.unroute('**/api/v1/analytics/expenses/trend?*', unavailable);
  await trend.getByRole('button', { name: 'Повторить загрузку графика' }).click();
  await expect(trend.getByText('За выбранный период расходов нет.', { exact: true })).toBeVisible();
  await expect(trend.getByRole('button', { name: 'По неделям' })).toHaveAttribute('aria-pressed', 'true');

  await setPeriod(page, '2026-01-01', '2026-12-31');
  await trend.getByRole('button', { name: 'По дням' }).click();
  await expect(chart).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
