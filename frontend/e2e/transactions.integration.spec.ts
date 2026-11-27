import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { APIRequestContext, Page, TestInfo } from '@playwright/test';
import { signIn, TEST_PASSWORD } from './helpers';

// Настоящие FastAPI и PostgreSQL. Учебные аккаунты создаются только в изолированной БД.
async function account(request: APIRequestContext) {
  const email = 'transactions-' + randomUUID().slice(0, 18) + '@example.com';
  const response = await request.post('/api/v1/auth/register', { data: { email, password: TEST_PASSWORD, full_name: 'Проверка операций' } });
  expect(response.status()).toBe(201);
  const tokens = await response.json();
  const categories = await (await request.get('/api/v1/categories')).json();
  return { email, tokens, categories, headers: { Authorization: 'Bearer ' + tokens.access_token } };
}

async function screenshot(page: Page, info: TestInfo, name: string) {
  const dialog = page.getByRole('dialog');
  if (await dialog.count()) {
    if (await dialog.evaluate((element) => element.scrollTop > 8)) {
      await page.screenshot({ path: info.outputPath(name + '-lower-' + info.project.name + '.png'), scale: 'css' });
    }
    await dialog.evaluate((element) => { element.scrollTop = 0; });
  }
  await page.screenshot({ path: info.outputPath(name + '-' + info.project.name + '.png'), fullPage: info.project.name !== 'mobile', scale: 'css' });
}

test('операция проходит создание, refresh, правку, правило категории, удаление и обновляет дашборд', async ({ page, request }, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const user = await account(request);
  const grocery = user.categories.find((category: { id: number }) => category.id === 1);
  const health = user.categories.find((category: { id: number }) => category.id === 4);
  await signIn(page, user.email);
  await page.getByRole('link', { name: 'Добавить операцию', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Добавить операцию', exact: true })).toBeVisible();
  await page.getByLabel('Сумма', { exact: true }).fill('1250,50');
  await page.getByRole('radio', { name: grocery.name, exact: true }).check();
  await page.getByLabel('Дата и время', { exact: true }).fill('2026-11-23T14:30');
  await page.getByLabel('Организация или описание', { exact: true }).fill('PYATEROCHKA 12344');
  await page.getByText('Комментарий', { exact: true }).click();
  await page.getByLabel('Комментарий к операции', { exact: true }).fill('Проверка записи через интерфейс');
  await screenshot(page, info, 'transaction-entry');
  const refresh = page.waitForResponse('**/api/v1/auth/refresh');
  const created = page.waitForResponse((response) => response.url().endsWith('/api/v1/transactions') && response.request().method() === 'POST' && response.status() === 201);
  // Имитируем истечение access перед отправкой, сам refresh и повтор POST выполняет настоящий API.
  await page.evaluate(async () => {
    const moduleUrl = '/src/shared/api/tokens.ts';
    const tokenStore = await import(moduleUrl);
    tokenStore.setAuthTokens({ ...tokenStore.getAuthTokens(), access_token: 'expired-test-access' }, true);
    document.querySelector<HTMLFormElement>('.transaction-form')!.requestSubmit();
  });
  expect((await refresh).status()).toBe(200);
  const createdItem = await (await created).json();
  await expect(page.getByRole('heading', { name: 'Расход добавлен', exact: true })).toBeVisible();
  await screenshot(page, info, 'transaction-success');
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.locator('.transaction-row')).toHaveCount(1);
  await expect(page.locator('.transaction-row')).toContainText(/1\s*250,5\s*₽/);
  await expect.poll(() => page.locator('.transactions-page img').evaluateAll((images) => images.every((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await page.locator('.transaction-row').click();
  await expect(page).toHaveURL(new RegExp('transaction=' + createdItem.id));
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/1\s*250,5/);
  await expect(page.getByText('Проверка записи через интерфейс', { exact: true })).toBeVisible();
  await screenshot(page, info, 'transaction-detail');
  await page.getByRole('button', { name: 'Редактировать', exact: true }).click();
  await page.getByLabel('Сумма', { exact: true }).fill('1340');
  await page.getByLabel('Комментарий к операции', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Сохранить изменения', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/1\s*340/);
  await expect(page.getByText('Комментария нет', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Изменить категорию', exact: true }).click();
  await page.getByRole('radio', { name: health.name, exact: true }).check();
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await screenshot(page, info, 'transaction-category-rule');
  await page.getByRole('button', { name: 'Запомнить', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Изменить категорию', exact: true })).toContainText(health.name);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Изменить категорию', exact: true })).toContainText(health.name);
  const other = await account(request);
  expect((await request.get('/api/v1/transactions/' + createdItem.id, { headers: other.headers })).status()).toBe(404);
  await page.getByRole('button', { name: 'Удалить', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/1\s*340/);
  await page.getByRole('button', { name: 'К списку транзакций', exact: true }).click();
  await screenshot(page, info, 'transactions-list');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('navigation', { name: info.project.name === 'mobile' ? 'Мобильная навигация' : 'Основная навигация' }).getByRole('link', { name: 'Обзор', exact: true }).click();
  await expect(page.locator('.dashboard-summary dd')).toHaveText([/[−-]1\s*340\s*₽/, /1\s*340\s*₽/]);
  await page.goto('/transactions?transaction=' + createdItem.id);
  await page.getByRole('button', { name: 'Удалить', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Удалить', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Операций пока нет', exact: true })).toBeVisible();
  await screenshot(page, info, 'transactions-empty');
  expect((await request.get('/api/v1/transactions/' + createdItem.id, { headers: user.headers })).status()).toBe(404);
  const imported = await request.post('/api/v1/transactions/import-statement', { headers: user.headers, multipart: { bank_hint: 'sber', file: { name: 'sber.csv', mimeType: 'text/csv', buffer: await (await import('node:fs/promises')).readFile(fileURLToPath(new URL('../../backend/tests/fixtures/sber.csv', import.meta.url))) } } });
  expect(imported.status()).toBe(200);
  const importedRows = (await imported.json()).imported_transactions;
  expect(importedRows.find((row: { merchant_name: string }) => row.merchant_name === 'pyaterochka')?.category_id).toBe(4);
  expect(errors).toEqual([]);
});

test('серверные фильтры, поиск и страницы восстанавливаются из URL', async ({ page, request }, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const user = await account(request);
  for (let index = 0; index < 25; index += 1) {
    const response = await request.post('/api/v1/transactions', { headers: user.headers, data: { amount: 100 + index, operation_type: index < 12 ? 'DEBIT' : 'CREDIT', category_id: index < 12 ? 1 : 10, transaction_date: '2026-11-22T12:00:00+03:00', merchant_name: 'Учебная операция ' + index } });
    expect(response.status()).toBe(201);
  }
  await signIn(page, user.email);
  await page.goto('/transactions');
  await expect(page.locator('.transaction-row')).toHaveCount(20);
  await page.getByRole('button', { name: 'Далее', exact: true }).click();
  await expect(page.locator('.transaction-row')).toHaveCount(5);
  await expect(page).toHaveURL(/page=2/);
  await page.reload();
  await expect(page.locator('.transaction-row')).toHaveCount(5);
  await page.goBack();
  await expect(page.locator('.transaction-row')).toHaveCount(20);
  await page.getByLabel('Поиск операций', { exact: true }).fill('операция');
  await page.getByRole('button', { name: 'Открыть фильтры', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: 'Доходы', exact: true }).first().check();
  const income = user.categories.find((category: { id: number }) => category.id === 10);
  await dialog.getByRole('group', { name: 'Категория', exact: true }).getByRole('radio', { name: income.name, exact: true }).check();
  await dialog.getByLabel('С', { exact: true }).fill('2026-11-22');
  await dialog.getByLabel('По', { exact: true }).fill('2026-11-23');
  await screenshot(page, info, 'transactions-filters');
  const response = page.waitForResponse((result) => result.url().includes('/api/v1/transactions?') && new URL(result.url()).searchParams.get('operation_type') === 'CREDIT');
  await dialog.getByRole('button', { name: 'Применить', exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect(page.locator('.transaction-row')).toHaveCount(13);
  await expect(page.locator('.transaction-row strong')).toHaveClass(Array(13).fill('transaction-income'));
  await page.reload();
  await expect(page.locator('.transaction-row')).toHaveCount(13);
  await screenshot(page, info, 'transactions-filtered');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
