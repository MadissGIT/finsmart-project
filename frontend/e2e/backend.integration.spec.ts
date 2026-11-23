import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import { setPeriod, signIn, TEST_PASSWORD } from './helpers';

// Без page.route: браузер → Vite proxy → FastAPI → PostgreSQL.
// Каждый тест создаёт отдельный аккаунт. В CI используется отдельный Docker Compose project и volume.
function testEmail() { return 'frontend-' + randomUUID().slice(0, 18) + '@example.com'; }

async function screenshot(page: Page, info: TestInfo, name: string) {
  await page.screenshot({ path: info.outputPath(name + '-' + info.project.name + '.png'), fullPage: info.project.name !== 'mobile', scale: 'css' });
}

test('живой API возвращает операции выбранного периода, диаграмму и бюджет', async ({ page, request }, testInfo) => {
  const email = testEmail();
  const registration = await request.post('/api/v1/auth/register', { data: { email, password: TEST_PASSWORD, full_name: 'Проверка интерфейса' } });
  expect(registration.status()).toBe(201);
  const tokens = await registration.json();
  const headers = { Authorization: 'Bearer ' + tokens.access_token };
  const categoriesResponse = await request.get('/api/v1/categories');
  const categories = await categoriesResponse.json();
  const income = categories.find((item: { budget_group: string }) => item.budget_group === 'INCOME');
  const needs = categories.find((item: { budget_group: string }) => item.budget_group === 'NEEDS');
  const wants = categories.find((item: { budget_group: string }) => item.budget_group === 'WANTS');
  for (const item of [
    { amount: 100000, category_id: income.id, operation_type: 'CREDIT', date: '2026-10-05' },
    { amount: 20000, category_id: needs.id, operation_type: 'DEBIT', date: '2026-10-10' },
    { amount: 10000, category_id: wants.id, operation_type: 'DEBIT', date: '2026-10-15' },
    { amount: 5000, category_id: income.id, operation_type: 'CREDIT', date: '2026-09-05' },
    { amount: 8000, category_id: needs.id, operation_type: 'DEBIT', date: '2026-09-10' },
  ]) {
    const response = await request.post('/api/v1/transactions', { headers, data: {
      amount: item.amount, category_id: item.category_id, operation_type: item.operation_type,
      transaction_date: item.date + 'T12:00:00+03:00', merchant_name: 'Учебная операция для проверки',
    } });
    expect(response.status()).toBe(201);
  }
  await signIn(page, email);
  const responsePromise = page.waitForResponse((response) => response.url().includes('/api/v1/analytics/budget?from_date=2026-10-01&to_date=2026-10-31'));
  await setPeriod(page, '2026-10-01', '2026-10-31');
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  expect(response.headers()['x-finsmart-test-upstream']).toBeUndefined();
  expect((await response.json()).summary).toEqual({ total_income: 100000, total_expense: 30000, net_balance: 70000 });
  await expect(page.locator('.dashboard-summary dd')).toHaveText([/100\s*000\s*₽/, /30\s*000\s*₽/, /70\s*000\s*₽/]);
  await expect(page.locator('.recharts-pie')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await screenshot(page, testInfo, 'dashboard-october');
  await page.locator('.dashboard-grid').evaluate((node) => node.scrollIntoView({ block: 'start' }));
  await screenshot(page, testInfo, 'dashboard-chart-budget');
  await page.getByRole('list', { name: 'Суммы расходов по категориям' }).getByRole('button').filter({ hasText: needs.name }).click();
  await expect(page.locator('.expense-total strong')).toHaveText(/20\s*000\s*₽/);
  await screenshot(page, testInfo, 'selected-category');
  await page.getByRole('link', { name: 'Бюджет 50 / 30 / 20 — открыть аналитику', exact: true }).click();
  await expect(page.getByRole('progressbar', { name: 'Необходимое', exact: true })).toHaveAttribute('value', '40');
  await expect(page.getByRole('progressbar', { name: 'Сбережения', exact: true })).toHaveAttribute('value', '100');
  if (testInfo.project.name === 'mobile') await page.locator('[aria-labelledby="budget-title"]').evaluate((node) => node.scrollIntoView({ block: 'start' }));
  await screenshot(page, testInfo, 'analytics-october');
  await page.goto('/?period=custom&from_date=2026-09-01&to_date=2026-09-30');
  await expect(page.locator('.dashboard-summary dd')).toHaveText([/5\s*000\s*₽/, /8\s*000\s*₽/, /[−-]3\s*000\s*₽/]);
  await page.reload();
  await expect(page.locator('.dashboard-summary dd').last()).toHaveText(/[−-]3\s*000\s*₽/);
  await screenshot(page, testInfo, 'dashboard-september');
  await setPeriod(page, '2026-08-01', '2026-08-31');
  await expect(page.locator('.dashboard-summary dd')).toHaveText([/0\s*₽/, /0\s*₽/, /0\s*₽/]);
  await expect(page.getByText('За этот период расходов пока нет.', { exact: true })).toBeVisible();
  await screenshot(page, testInfo, 'dashboard-empty');
  await page.evaluate(() => {
    const stored = JSON.parse(sessionStorage.getItem('finsmart.auth.v1')!);
    stored.access_token = 'expired-test-access';
    sessionStorage.setItem('finsmart.auth.v1', JSON.stringify(stored));
  });
  const refreshResponse = page.waitForResponse('**/api/v1/auth/refresh');
  await page.reload();
  expect((await refreshResponse).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Привет, Проверка!', exact: true })).toBeVisible();
});

test('регистрация и импорт настоящего CSV пополняют аккаунт через backend', async ({ page }, testInfo) => {
  const email = testEmail();
  await page.goto('/welcome');
  await page.getByRole('link', { name: 'Создать аккаунт', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Пароль', { exact: true }).fill(TEST_PASSWORD);
  await page.getByLabel('Повторите пароль', { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole('checkbox', { name: /Я ознакомился/ }).check();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await page.getByLabel('Имя', { exact: true }).fill('Учебный аккаунт');
  const registration = page.waitForResponse('**/api/v1/auth/register');
  await page.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
  expect((await registration).status()).toBe(201);
  await expect(page.getByRole('heading', { name: 'Регистрация успешна!', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Пропустить', exact: true }).click();
  await expect(page.locator('.dashboard-summary dd')).toHaveText([/0\s*₽/, /0\s*₽/, /0\s*₽/]);
  expect(await page.evaluate(() => JSON.stringify({ ...sessionStorage, ...localStorage }))).not.toContain(TEST_PASSWORD);
  await page.getByRole('link', { name: 'Загрузить выписку', exact: true }).click();
  await page.getByLabel('Банк', { exact: true }).selectOption('sber');
  await page.getByLabel('Выбрать банковскую выписку', { exact: true }).setInputFiles(fileURLToPath(new URL('../../backend/tests/fixtures/sber.csv', import.meta.url)));
  const upload = page.waitForResponse('**/api/v1/transactions/import-statement');
  await page.getByRole('button', { name: 'Импортировать выписку', exact: true }).click();
  const uploaded = await upload;
  expect(uploaded.status()).toBe(200);
  expect((await uploaded.json()).imported_count).toBeGreaterThan(0);
  await expect(page.getByRole('status')).toContainText('Импортировано:');
  await screenshot(page, testInfo, 'statement-import');
  await page.getByRole('link', { name: 'Перейти к обзору', exact: true }).click();
  await setPeriod(page, '2026-10-01', '2026-10-31');
  await expect(page.locator('.dashboard-summary dd')).toHaveText([/50\s*000\s*₽/, /1\s*700,5\s*₽/, /48\s*299,5\s*₽/]);
});
