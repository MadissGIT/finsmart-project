import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import type { Discount } from '../src/entities/discount/model/types';
import { TEST_PASSWORD } from './helpers';

test('каталог показывает данные API, его фильтры, карточку и избранное', async ({ page, request, context }, info) => {
  const response = await request.get('/api/v1/discounts');
  expect(response.status()).toBe(200);
  const offers: Discount[] = await response.json();
  const offer = offers.find((item) => item.category_id === 1 && item.promocode && item.is_demo)
    ?? offers.find((item) => item.category_id === 1);
  expect(offer).toBeDefined();
  if (!offer) return;

  const requests: string[] = [];
  page.on('request', (event) => requests.push(new URL(event.url()).pathname));
  if (info.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/discounts');
  await expect(page.locator('.offer-card')).toHaveCount(offers.length);
  expect(requests).not.toContain('/api/v1/discounts/recommended');
  await expect(page.getByRole('link', { name: 'Войдите', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  await page.screenshot({ path: info.outputPath('catalog.png'), scale: 'css' });

  const filtered = page.waitForResponse('**/api/v1/discounts?category_id=1');
  await page.getByRole('button', { name: 'Еда', exact: true }).click();
  expect((await filtered).status()).toBe(200);
  await expect(page.locator('.offer-card')).toHaveCount(offers.filter((item) => item.category_id === 1).length);
  await page.getByRole('searchbox', { name: 'Поиск скидок' }).fill(offer.partner_name);
  await page.locator('.offer-card').filter({ hasText: offer.title }).click();
  await expect(page.getByRole('heading', { level: 1, name: offer.partner_name, exact: true })).toBeVisible();
  await expect(page.getByText(offer.conditions, { exact: true })).toBeVisible();
  if (offer.is_demo) await expect(page.getByText(/^Демонстрационное предложение\./)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: offer.partner_name, exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('offer.png'), scale: 'css' });

  if (offer.promocode) {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: 'Скопировать промокод' }).click();
    await expect(page.getByRole('dialog', { name: 'Промокод скопирован' })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(offer.promocode);
    await page.getByRole('button', { name: 'Готово', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Избранное', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Избранное', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('link', { name: 'К скидкам', exact: true }).click();
  await expect(page.getByRole('searchbox', { name: 'Поиск скидок' })).toHaveValue(offer.partner_name);
  await page.getByRole('button', { name: 'Избранные скидки' }).click();
  await page.reload();
  await expect(page.locator('.offer-card')).toHaveCount(1);
  await page.getByRole('link', { name: 'Умные скидки', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Предложения каталога' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('promo.png'), scale: 'css' });
});

test('рекомендации привязаны к аккаунту, из аналитики открывается категория расходов', async ({ page, request }, info) => {
  const email = 'discounts-' + randomUUID() + '@example.com';
  const registration = await request.post('/api/v1/auth/register', {
    data: { email, password: TEST_PASSWORD, full_name: 'Проверка скидок' },
  });
  expect(registration.status()).toBe(201);
  const tokens = await registration.json();
  const headers = { Authorization: 'Bearer ' + tokens.access_token };
  const created = await request.post('/api/v1/transactions', {
    headers,
    data: { amount: 500, operation_type: 'DEBIT', category_id: 1, transaction_date: new Date().toISOString(), merchant_name: 'Учебная покупка' },
  });
  expect(created.status()).toBe(201);

  await page.goto('/discounts');
  await page.getByRole('link', { name: 'Войдите', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Пароль', { exact: true }).fill(TEST_PASSWORD);
  const personalized = page.waitForResponse('**/api/v1/discounts/recommended');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  const recommendationResponse = await personalized;
  expect(recommendationResponse.status()).toBe(200);
  await expect(page).toHaveURL(/\/discounts$/);
  const expected: { items: Discount[] } = await recommendationResponse.json();
  expect(expected.items.length).toBeGreaterThan(0);
  const recommended = page.getByRole('region', { name: 'Подобрано для вас' });
  const visibleCount = Math.min(3, expected.items.length);
  await expect(recommended.locator('.offer-card')).toHaveCount(visibleCount);
  await expect(recommended.locator('.offer-meta').filter({ hasText: 'Супермаркеты' })).toHaveCount(visibleCount);
  await page.screenshot({ path: info.outputPath('recommended.png'), scale: 'css' });

  await page.goto('/analytics?period=last_7_days');
  await page.getByRole('button', { name: /^Супермаркеты/ }).click();
  const context = page.getByRole('region', { name: 'Скидки по категории' });
  await expect(context.getByRole('heading', { name: 'Скидки в категории «Супермаркеты»' })).toBeVisible();
  await context.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('category.png'), scale: 'css' });
  await context.getByRole('link', { name: 'Посмотреть акции' }).click();
  await expect(page).toHaveURL(/category_id=1/);
  await expect(page.getByRole('button', { name: 'Еда', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.offer-card').first()).toContainText('Супермаркеты');
});
