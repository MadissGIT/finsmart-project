import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import type { DiagnosisResponse } from '../src/entities/analytics/model/types';
import { setPeriod, signIn, TEST_PASSWORD } from './helpers';

test('дашборд показывает расчёт и скидки с API за фактический период диагноза', async ({ page, request }, info) => {
  const email = 'diagnosis-' + randomUUID() + '@example.com';
  const registration = await request.post('/api/v1/auth/register', {
    data: { email, password: TEST_PASSWORD, full_name: 'Проверка диагноза' },
  });
  expect(registration.status()).toBe(201);
  const tokens = await registration.json();
  const headers = { Authorization: 'Bearer ' + tokens.access_token };
  const now = Date.now();
  const date = (daysAgo: number) => new Date(now - daysAgo * 86_400_000).toISOString().slice(0, 10);

  for (const item of [
    { amount: 4000, category_id: 10, operation_type: 'CREDIT', day: date(45) },
    { amount: 10000, category_id: 10, operation_type: 'CREDIT', day: date(2) },
    { amount: 6500, category_id: 1, operation_type: 'DEBIT', day: date(1) },
  ]) {
    const { day, ...operation } = item;
    const response = await request.post('/api/v1/transactions', {
      headers,
      data: { ...operation, transaction_date: day + 'T12:00:00+03:00', merchant_name: 'Проверка диагноза' },
    });
    expect(response.status()).toBe(201);
  }

  if (info.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 700 });
  await signIn(page, email);
  const calculated = page.waitForResponse('**/api/v1/analytics/dashboard?from_date=' + date(30) + '&to_date=' + date(0));
  await setPeriod(page, date(60), date(0));
  const response = await calculated;
  expect(response.status()).toBe(200);
  const data: DiagnosisResponse = await response.json();
  expect(data.summary.total_income).toBe(10000);
  await expect(page.locator('.dashboard-summary dd').first()).toHaveText(/14\s*000\s*₽/);

  const panel = page.getByRole('region', { name: 'Финансовое здоровье' });
  await expect(panel.getByRole('meter', { name: 'Рейтинг финансового здоровья' })).toHaveAttribute('aria-valuenow', String(data.diagnostics.health_score));
  await expect(panel.getByText(data.diagnostics.status, { exact: true })).toBeVisible();
  await expect(panel.getByText(/последние 31 день выбранного периода/)).toBeVisible();
  const alert = data.diagnostics.alerts.find(({ type }) => type === 'FD-06')!;
  const card = panel.getByRole('article').filter({ hasText: 'Продуктовый шторм' });
  await expect(card.getByText(alert.message, { exact: true })).toBeVisible();
  await expect(card.getByText(alert.recommendation, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await panel.getByText('Из чего складывается рейтинг').click();
  await expect(panel.getByText('Учёт операций', { exact: true })).toBeVisible();
  await panel.getByText('Из чего складывается рейтинг').click();
  await panel.screenshot({ path: info.outputPath('financial-health.png'), scale: 'css' });
  await panel.getByRole('button', { name: 'Скрыть «Продуктовый шторм»' }).click();
  await expect(card).toHaveCount(0);
  await panel.getByRole('button', { name: 'Показать скрытые (1)' }).click();
  await expect(card).toBeVisible();

  const offer = alert.discounts[0];
  const offerLink = panel.getByRole('link').filter({ hasText: offer.partner_name }).first();
  await expect(offerLink).toHaveAttribute('href', '/discounts?offer=' + offer.id);
  await offerLink.click();
  await expect(page.getByRole('heading', { level: 1, name: offer.partner_name, exact: true })).toBeVisible();
  await page.goBack();

  await setPeriod(page, date(90), date(61));
  await expect(panel.getByText('Рейтинг появится, когда за этот период будут доходы или расходы.')).toBeVisible();
  await expect(panel.getByRole('meter')).toHaveCount(0);
  await expect(card).toHaveCount(0);
});
