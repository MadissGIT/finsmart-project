import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { signIn, TEST_PASSWORD } from './helpers';

test('лимит создаёт уведомление при 80% и отдельное при 100%, счётчик учитывает прочтение и скрытие', async ({ page, request }, info) => {
  const email = 'alerts-' + randomUUID() + '@example.com';
  const registration = await request.post('/api/v1/auth/register', {
    data: { email, password: TEST_PASSWORD, full_name: 'Проверка уведомлений' },
  });
  expect(registration.status()).toBe(201);
  const { access_token: token } = await registration.json();
  const headers = { Authorization: 'Bearer ' + token };
  expect((await request.post('/api/v1/transactions', {
    headers,
    data: { amount: 790, operation_type: 'DEBIT', category_id: 1, merchant_name: 'Тест', transaction_date: new Date().toISOString() },
  })).status()).toBe(201);

  if (info.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 700 });
  await signIn(page, email);
  const nav = page.getByRole('navigation', {
    name: info.project.name === 'mobile' ? 'Мобильная навигация' : 'Основная навигация',
  });
  await page.goto('/analytics#category-limits');
  const limits = page.getByRole('region', { name: 'Лимиты текущего месяца' });
  const limitAmount = limits.getByLabel('Лимит, ₽', { exact: true });
  const counter = page.locator('.notification-counter');
  const dialog = page.getByRole('dialog', { name: 'Уведомления', exact: true });
  await limits.getByLabel('Категория', { exact: true }).selectOption('1');
  await limitAmount.fill('1000');
  await limits.getByRole('button', { name: 'Сохранить лимит', exact: true }).click();
  await expect(limits.getByText(/79%/)).toBeVisible();
  await expect(counter).toHaveCount(0);

  await nav.getByRole('link', { name: 'Обзор', exact: true }).click();
  await page.getByRole('link', { name: 'Добавить операцию', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Добавить операцию', exact: true });
  await form.getByLabel('Сумма', { exact: true }).fill('10');
  await form.getByRole('radio', { name: 'Супермаркеты', exact: true }).check();
  await form.getByLabel('Организация или описание', { exact: true }).fill('Проверка порога');
  await form.getByRole('button', { name: 'Добавить расход', exact: true }).click();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await nav.getByRole('link', { name: 'Обзор', exact: true }).click();

  const warning = /Вы близки к лимиту по категории «Супермаркеты»/;
  await expect(page.getByRole('heading', { name: warning })).toBeVisible();
  await expect(page.getByRole('main').getByText(/До лимита осталось 200\s*₽/)).toBeVisible();
  await expect(counter).toHaveText('1');
  await page.getByRole('button', { name: 'Уведомления, непрочитанных: 1', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: warning })).toBeVisible();
  await dialog.getByRole('link', { name: 'Перейти к лимитам', exact: true }).click();
  await expect(page).toHaveURL(/#category-limits$/);
  await expect(limits).toBeFocused();
  await expect(counter).toHaveCount(0);
  await page.reload();
  await expect(limits.getByText('Израсходовано не менее 80% лимита')).toBeVisible();
  await expect(counter).toHaveCount(0);

  await limits.getByLabel('Категория', { exact: true }).selectOption('1');
  await limitAmount.fill('800');
  await limits.getByRole('button', { name: 'Сохранить лимит', exact: true }).click();
  await expect(counter).toHaveText('1');
  await page.getByRole('button', { name: 'Уведомления, непрочитанных: 1', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: /Лимит достигнут по категории «Супермаркеты»/ })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: warning })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Закрыть', exact: true }).click();

  await limitAmount.fill('790');
  await limits.getByRole('button', { name: 'Сохранить лимит', exact: true }).click();
  await expect(limits.getByText(/101[.,]27%/)).toBeVisible();
  const deadline = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
  expect((await request.post('/api/v1/goals', {
    headers, data: { title: 'После проверки', target_amount: 20000, deadline },
  })).status()).toBe(201);
  await nav.getByRole('link', { name: 'Обзор', exact: true }).click();
  await page.getByRole('button', { name: 'Обновить финансовый обзор' }).click();
  await expect(counter).toHaveText('2');
  await page.getByRole('button', { name: 'Уведомления, непрочитанных: 2', exact: true }).click();
  const overrun = /Перерасход по категории «Супермаркеты»/;
  await expect(dialog.getByRole('heading', { name: overrun })).toBeVisible();
  await expect(dialog.getByText(/Лимит превышен на 10\s*₽/)).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'Посмотреть цель', exact: true })).toBeVisible();
  const matchingOffers = await (await request.get('/api/v1/discounts?category_id=1')).json();
  if (matchingOffers.length > 0) {
    await expect(dialog.getByRole('link', { name: 'Посмотреть акции', exact: true }))
      .toHaveAttribute('href', '/discounts?category_id=1');
  }
  await expect.poll(() => dialog.locator('.notification-card img').evaluateAll((images) =>
    images.every((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await page.screenshot({ path: info.outputPath('notifications.png'), scale: 'css' });
  await dialog.getByRole('button', { name: 'Скрыть: Перерасход по категории «Супермаркеты»', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: overrun })).toHaveCount(0);
  await expect(counter).toHaveText('1');
  await dialog.getByRole('button', { name: 'Отметить все прочитанными', exact: true }).click();
  await expect(counter).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Уведомления', exact: true }).click();
  await expect(dialog.getByRole('link', { name: 'Посмотреть цель', exact: true })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: overrun })).toHaveCount(0);
  await expect(counter).toHaveCount(0);
});
