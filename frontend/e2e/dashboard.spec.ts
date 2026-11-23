import { expect, test } from '@playwright/test';
import { budgetFixture, mockAccount, setPeriod, signIn, TEST_EMAIL } from './helpers';

test('гость не запрашивает чужую аналитику и не получает демонстрационные суммы', async ({ page }) => {
  const api = await mockAccount(page);
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Войти', exact: true })).toBeVisible();
  await expect(page.locator('.dashboard-summary dd')).toHaveText(['—', '—', '—']);
  expect(api.budgetRequests).toEqual([]);
  expect(api.diagnosisRequests).toEqual([]);
  await expect(page.getByRole('region', { name: 'Финансовое здоровье' })).toHaveCount(0);
});

test('свой период передаётся серверу и сохраняется при обновлении и возврате', async ({ page }) => {
  const api = await mockAccount(page);
  await signIn(page);
  await setPeriod(page, '2026-10-01', '2026-10-31');
  await expect(page.locator('.dashboard-summary dd')).toHaveText([/100\s*000\s*₽/, /30\s*000\s*₽/, /70\s*000\s*₽/]);
  expect(api.budgetRequests.at(-1)).toContain('from_date=2026-10-01&to_date=2026-10-31');
  await expect(page).toHaveURL(/period=custom&from_date=2026-10-01&to_date=2026-10-31/);
  await page.reload();
  await expect(page.locator('.dashboard-summary dd')).toHaveText([/100\s*000\s*₽/, /30\s*000\s*₽/, /70\s*000\s*₽/]);
  await setPeriod(page, '2026-09-01', '2026-09-30');
  await expect(page.locator('.dashboard-summary dd')).toHaveText([/50\s*000\s*₽/, /7\s*000\s*₽/, /43\s*000\s*₽/]);
  await page.goBack();
  await expect(page.locator('.dashboard-summary dd')).toHaveText([/100\s*000\s*₽/, /30\s*000\s*₽/, /70\s*000\s*₽/]);
  await page.getByRole('link', { name: 'Бюджет 50 / 30 / 20 — открыть аналитику', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Аналитика', exact: true })).toBeVisible();
  await expect(page.getByLabel('С', { exact: true })).toHaveValue('2026-10-01');
  await expect(page.getByRole('progressbar', { name: 'Необходимое', exact: true })).toHaveAttribute('value', '40');
  await expect(page.getByRole('progressbar', { name: 'Сбережения', exact: true })).toHaveAttribute('value', '100');
});

test('диаграмма реагирует на клик, клавиатуру и сброс выбора', async ({ page }) => {
  await mockAccount(page);
  await signIn(page);
  await setPeriod(page, '2026-10-01', '2026-10-31');
  const legend = page.getByRole('list', { name: 'Суммы расходов по категориям' });
  const food = legend.getByRole('button', { name: /Супермаркеты/ });
  await food.click();
  await expect(food).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.expense-selection [role=status]')).toContainText('20');
  await expect(page.locator('.expense-total strong')).toHaveText(/20\s*000\s*₽/);
  await page.getByRole('button', { name: 'Показать все расходы', exact: true }).click();
  await expect(food).toHaveAttribute('aria-pressed', 'false');
  await food.focus(); await food.press('Enter');
  await expect(food).toHaveAttribute('aria-pressed', 'true');
  const sector = page.locator('.recharts-pie-sector path').last();
  await sector.scrollIntoViewIfNeeded();
  // Центр bounding box у кольцевого сектора может попасть в отверстие диаграммы.
  const point = await sector.evaluate((node: SVGPathElement) => {
    const box = node.getBBox();
    const matrix = node.getScreenCTM()!;
    for (let x = box.x + 2; x < box.x + box.width; x += 2) {
      for (let y = box.y + 2; y < box.y + box.height; y += 2) {
        if (node.isPointInFill(new DOMPoint(x, y))) {
          const screen = new DOMPoint(x, y).matrixTransform(matrix);
          return { x: screen.x, y: screen.y };
        }
      }
    }
    throw new Error('У сектора нет видимой области');
  });
  await page.mouse.click(point.x, point.y);
  await expect(legend.getByRole('button', { name: /Кафе/ })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('некорректный диапазон не отправляет запрос', async ({ page }) => {
  const api = await mockAccount(page);
  await signIn(page);
  await page.getByLabel('Период', { exact: true }).selectOption('custom');
  const count = api.budgetRequests.length;
  await page.getByLabel('С', { exact: true }).fill('2026-11-10');
  await page.getByLabel('По', { exact: true }).fill('2026-11-01');
  await page.getByRole('button', { name: 'Применить', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('раньше');
  expect(api.budgetRequests.length).toBe(count);
  await page.getByLabel('С', { exact: true }).fill('2024-01-01');
  await page.getByRole('button', { name: 'Применить', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('367');
  expect(api.budgetRequests.length).toBe(count);
});

test('ошибка сервера скрывает устаревшие суммы и позволяет повторить запрос', async ({ page }) => {
  await mockAccount(page);
  await signIn(page);
  const handler = (route: import('@playwright/test').Route) => route.fulfill({ status: 503, json: { detail: 'Unavailable' } });
  await page.route('**/api/v1/analytics/budget?*', handler);
  await page.getByRole('button', { name: 'Обновить финансовый обзор', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('не готов');
  await expect(page.locator('.dashboard-summary dd')).toHaveText(['—', '—', '—']);
  await page.unroute('**/api/v1/analytics/budget?*', handler);
  await page.getByRole('button', { name: 'Повторить загрузку', exact: true }).click();
  await expect(page.locator('.recharts-pie')).toBeVisible();
});

test('финансовый диагноз можно повторно загрузить, а бюджет остаётся доступен', async ({ page }) => {
  await mockAccount(page);
  await signIn(page);
  const handler = (route: import('@playwright/test').Route) => route.fulfill({ status: 503 });
  await page.route('**/api/v1/analytics/dashboard?*', handler);
  await page.getByRole('button', { name: 'Обновить финансовый обзор' }).click();

  const diagnosis = page.getByRole('region', { name: 'Финансовое здоровье' });
  await expect(diagnosis.getByRole('alert')).toContainText('не готов');
  await expect(page.getByRole('progressbar', { name: 'Индекс соблюдения бюджета' })).toBeVisible();
  await expect(diagnosis.getByRole('meter')).toHaveCount(0);

  await page.unroute('**/api/v1/analytics/dashboard?*', handler);
  await diagnosis.getByRole('button', { name: 'Повторить расчёт' }).click();
  await expect(diagnosis.getByRole('meter')).toHaveAttribute('aria-valuenow', '75');
  await expect(diagnosis.getByText('За этот период предупреждений нет.')).toBeVisible();
});

test('поздний ответ предыдущего периода не меняет новый выбор', async ({ page }) => {
  await mockAccount(page);
  await signIn(page);
  let oldRoute: import('@playwright/test').Route | undefined;
  await page.route('**/api/v1/analytics/budget?*', async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('from_date') === '2026-10-01') { oldRoute = route; return; }
    return route.fallback();
  });
  await setPeriod(page, '2026-10-01', '2026-10-31');
  await expect.poll(() => !!oldRoute).toBe(true);
  await expect(page.locator('.dashboard-summary dd')).toHaveText(['…', '…', '…']);
  await setPeriod(page, '2026-09-01', '2026-09-30');
  await expect(page.locator('.dashboard-summary dd')).toHaveText([/50\s*000\s*₽/, /7\s*000\s*₽/, /43\s*000\s*₽/]);
  await oldRoute!.fulfill({ json: budgetFixture('2026-10-01', '2026-10-31') }).catch(() => { /* Отменённый браузером запрос уже закрыт. */ });
  await expect(page.locator('.dashboard-summary dd')).toHaveText([/50\s*000\s*₽/, /7\s*000\s*₽/, /43\s*000\s*₽/]);
});

test('истёкший access обновляется через refresh и сохраняет вход', async ({ page }) => {
  const api = await mockAccount(page);
  await signIn(page);
  await page.evaluate(() => {
    const value = JSON.parse(sessionStorage.getItem('finsmart.auth.v1')!);
    value.access_token = 'expired-for-test'; sessionStorage.setItem('finsmart.auth.v1', JSON.stringify(value));
  });
  await page.reload();
  await expect(page.locator('.recharts-pie')).toBeVisible();
  expect(api.refreshCount).toBe(1);
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('finsmart.auth.v1')!).access_token)).toBe('test-access-2');
});

test('недействительная refresh-сессия завершает вход', async ({ page }) => {
  await mockAccount(page);
  await signIn(page);
  await page.evaluate(() => {
    const value = JSON.parse(sessionStorage.getItem('finsmart.auth.v1')!);
    value.access_token = 'expired-for-test'; value.refresh_token = 'invalid-for-test';
    sessionStorage.setItem('finsmart.auth.v1', JSON.stringify(value));
  });
  await page.reload();
  await expect(page.getByRole('link', { name: 'Войти', exact: true })).toBeVisible();
  await expect(page.locator('.dashboard-summary dd')).toHaveText(['—', '—', '—']);
  expect(await page.evaluate(() => sessionStorage.getItem('finsmart.auth.v1'))).toBeNull();
});

test('неверный пароль не открывает дашборд и не создаёт сессию', async ({ page }) => {
  await mockAccount(page);
  await page.goto('/auth');
  await page.getByLabel('Email', { exact: true }).fill(TEST_EMAIL);
  await page.getByLabel('Пароль', { exact: true }).fill('IncorrectPassword123');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Неверный email или пароль');
  expect(await page.evaluate(() => sessionStorage.getItem('finsmart.auth.v1'))).toBeNull();
});
