import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mockAccount, signIn } from './helpers';

const categories = [{ id: 1, name: 'Супермаркеты', budget_group: 'NEEDS' }, { id: 4, name: 'Аптеки и здоровье', budget_group: 'NEEDS' }, { id: 10, name: 'Доходы', budget_group: 'INCOME' }];
const item = { id: 'dc028083-bc14-459d-b42b-123456789abc', amount: 250, operation_type: 'DEBIT', category_id: 1, category_name: 'Супермаркеты', transaction_date: '2026-11-23T12:00:00Z', merchant_name: 'тестовый магазин', comment: null, mcc_code: null, bank_source: 'MANUAL', requires_review: false, confidence: 1 };

async function prepare(page: Page, empty = false) {
  await mockAccount(page);
  const queries: string[] = [];
  await page.route('**/api/v1/categories', (route) => route.fulfill({ json: categories }));
  await page.route('**/api/v1/transactions**', (route) => {
    if (route.request().method() !== 'GET') return route.fulfill({ status: 500, json: { detail: 'Не удалось сохранить' } });
    queries.push(new URL(route.request().url()).search);
    return route.fulfill({ json: new URL(route.request().url()).pathname.endsWith('/' + item.id) ? item : empty ? [] : [item] });
  });
  return queries;
}

test('гостевой список не запрашивает операции и не заполняется примерами', async ({ page }) => {
  const queries = await prepare(page);
  await page.goto('/transactions');
  await expect(page.getByRole('heading', { name: 'Ваши операции появятся после входа' })).toBeVisible();
  await expect(page.locator('.transaction-row')).toHaveCount(0);
  expect(queries).toEqual([]);
});

test('пустой аккаунт и форма проверяются на ширине 320 px', async ({ page }) => {
  await prepare(page, true); await signIn(page);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/transactions');
  await expect(page.getByRole('heading', { name: 'Операций пока нет' })).toBeVisible();
  await page.locator('.transaction-floating-actions').getByRole('button', { name: 'Добавить операцию' }).click();
  await page.getByRole('button', { name: 'Добавить расход', exact: true }).click();
  await expect(page.getByText('Выберите категорию для этого типа операции.', { exact: true })).toBeVisible();
  await expect(page.getByText('Введите положительную сумму, до двух знаков после запятой.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('dialog').press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('поиск, тип, категория и даты передаются серверу и восстанавливаются после reload', async ({ page }) => {
  const queries = await prepare(page); await signIn(page);
  await page.goto('/transactions');
  await page.getByLabel('Поиск операций', { exact: true }).fill('магазин');
  await expect.poll(() => queries.at(-1)).toContain('q=');
  await page.getByRole('button', { name: 'Открыть фильтры' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: 'Расходы', exact: true }).check();
  await dialog.getByRole('radio', { name: 'Супермаркеты', exact: true }).check();
  await dialog.getByLabel('С', { exact: true }).fill('2026-11-01');
  await dialog.getByLabel('По', { exact: true }).fill('2026-11-30');
  await dialog.getByRole('button', { name: 'Применить', exact: true }).click();
  await expect.poll(() => queries.at(-1)).toContain('from_date=2026-11-01');
  const params = new URLSearchParams(queries.at(-1));
  expect(Object.fromEntries(params)).toMatchObject({ q: 'магазин', category_id: '1', operation_type: 'DEBIT', to_date: '2026-11-30' });
  await page.reload();
  await expect(page.getByLabel('Поиск операций', { exact: true })).toHaveValue('магазин');
  await expect(page.locator('.transaction-row')).toHaveCount(1);
});

test('ошибка записи сохраняет ввод, повторная отправка и закрытие блокируются во время запроса', async ({ page }) => {
  await prepare(page); await signIn(page); await page.goto('/transactions');
  await page.locator('.transaction-floating-actions').getByRole('button').click();
  await page.getByLabel('Сумма', { exact: true }).fill('123,45');
  await page.getByRole('radio', { name: 'Супермаркеты', exact: true }).check();
  await page.getByLabel('Организация или описание', { exact: true }).fill('Сохранить этот ввод');
  let writes = 0;
  await page.route('**/api/v1/transactions', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    writes += 1;
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.fulfill({ status: 503, json: { detail: 'Unavailable' } });
  });
  await page.getByRole('button', { name: 'Добавить расход', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Закрыть', exact: true })).toBeDisabled();
  await page.getByRole('dialog').press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.getByRole('alert')).toContainText('не готов');
  await expect(page.getByLabel('Сумма', { exact: true })).toHaveValue('123,45');
  await expect(page.getByLabel('Организация или описание', { exact: true })).toHaveValue('Сохранить этот ввод');
  expect(writes).toBe(1);
});

test('ошибка списка скрывает прежние данные и допускает повтор', async ({ page }) => {
  await prepare(page); await signIn(page); await page.goto('/transactions');
  await expect(page.locator('.transaction-row')).toHaveCount(1);
  let failing = true;
  await page.route('**/api/v1/transactions?*', (route) => failing ? route.fulfill({ status: 503, json: {} }) : route.fulfill({ json: [item] }));
  await page.getByLabel('Поиск операций', { exact: true }).fill('ошибка');
  await expect(page.getByRole('alert')).toContainText('не готов');
  await expect(page.locator('.transaction-row')).toHaveCount(0);
  failing = false;
  await page.getByRole('button', { name: 'Повторить загрузку', exact: true }).click();
  await expect(page.locator('.transaction-row')).toHaveCount(1);
});

test('поздний ответ старого поиска не заменяет новый список', async ({ page }) => {
  await prepare(page); await signIn(page); await page.goto('/transactions');
  await page.route('**/api/v1/transactions?*', async (route) => {
    const old = new URL(route.request().url()).searchParams.get('q') === 'старый';
    if (old) await new Promise((resolve) => setTimeout(resolve, 1000));
    await route.fulfill({ json: [{ ...item, merchant_name: old ? 'старый результат' : 'новый результат' }] }).catch(() => undefined);
  });
  const oldRequest = page.waitForRequest((request) => new URL(request.url()).searchParams.get('q') === 'старый');
  await page.getByLabel('Поиск операций', { exact: true }).fill('старый');
  await oldRequest;
  await page.getByLabel('Поиск операций', { exact: true }).fill('новый');
  await expect(page.locator('.transaction-row')).toContainText('Новый результат');
  await page.waitForTimeout(1100);
  await expect(page.locator('.transaction-row')).not.toContainText('Старый результат');
});

test('история браузера закрывает правку и не превращает её в создание', async ({ page }) => {
  await prepare(page); await signIn(page); await page.goto('/transactions');
  await expect(page.locator('.transaction-row')).toContainText('Тестовый магазин');
  await page.locator('.transaction-row').click();
  await expect(page.getByRole('button', { name: 'Изменить категорию' })).toContainText('Тестовый магазин');
  await page.getByRole('button', { name: 'Редактировать', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Редактировать операцию' })).toBeVisible();
  await expect(page.getByLabel('Организация или описание', { exact: true })).toHaveValue('тестовый магазин');
  await page.goBack();
  await expect(page.locator('.transaction-row')).toHaveCount(1);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goForward();
  await expect(page.getByRole('button', { name: 'Редактировать', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
