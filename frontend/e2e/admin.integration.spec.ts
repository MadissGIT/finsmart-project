import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { TEST_PASSWORD } from './helpers';

test('панель управляет купонами и пользователями через защищённый API', async ({ page, request }, info) => {
  const adminEmail = process.env.FINSMART_E2E_ADMIN_EMAIL;
  test.skip(!adminEmail, 'Для проверки нужен администратор в изолированной тестовой базе');
  test.setTimeout(60_000);
  const email = 'admin-e2e-' + randomUUID() + '@example.com';
  const registered = await request.post('/api/v1/auth/register', {
    data: { email, password: TEST_PASSWORD, full_name: 'Тестовый пользователь' },
  });
  expect(registered.status()).toBe(201);
  const { access_token: access } = await registered.json();
  const headers = { Authorization: 'Bearer ' + access };
  expect((await request.get('/api/v1/admin/users', { headers })).status()).toBe(403);

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/auth\?next=\/admin$/);
  await page.getByLabel('Email', { exact: true }).fill(adminEmail!);
  await page.getByLabel('Пароль', { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Сводка', exact: true })).toBeVisible();
  await expect(page.getByText('Загружено выписок')).toBeVisible();

  const nav = page.getByRole('navigation', { name: 'Разделы администрирования' });
  await nav.getByRole('link', { name: 'Скидки и купоны', exact: true }).click();
  await page.getByRole('button', { name: 'Добавить предложение', exact: true }).click();
  const title = 'Проверка купона ' + randomUUID().slice(0, 8);
  await page.getByLabel('Магазин', { exact: true }).fill('Тестовый магазин');
  await page.getByRole('combobox', { name: 'Категория', exact: true }).selectOption('1');
  await page.getByLabel('Название предложения', { exact: true }).fill(title);
  await page.getByLabel('Промокод', { exact: true }).fill('ADMIN20');
  await page.getByLabel('Последний день акции', { exact: true }).fill('2099-12-31');
  await page.getByRole('combobox', { name: 'Статус', exact: true }).selectOption('published');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByText('Изменения сохранены', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(title) })).toBeVisible();
  const offers = (await (await request.get('/api/v1/discounts?category_id=1')).json()) as { title: string; promocode: string }[];
  expect(offers).toContainEqual(expect.objectContaining({ title, promocode: 'ADMIN20' }));
  await page.screenshot({ path: info.outputPath('admin-discounts.png'), scale: 'css' });

  await nav.getByRole('link', { name: 'Пользователи', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Имя или email' }).fill(email);
  await page.getByRole('button', { name: 'Найти', exact: true }).click();
  const row = page.getByRole('row').filter({ hasText: email });
  await row.getByRole('button', { name: 'Заблокировать', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Заблокировать', exact: true }).click();
  await expect(row).toContainText('Заблокирован');
  expect((await request.get('/api/v1/users/me', { headers })).status()).toBe(401);
  await row.getByRole('button', { name: 'Разблокировать', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Разблокировать', exact: true }).click();
  await expect(row).toContainText('Доступ открыт');

  for (const title of ['Категории', 'База знаний', 'Достижения', 'Обращения']) {
    await nav.getByRole('link', { name: title, exact: true }).click();
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
});
