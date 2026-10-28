import { expect, test } from '@playwright/test';

const routes = [
  ['/', 'Привет!'],
  ['/welcome', 'ФинСмарт'],
  ['/register', 'Создать аккаунт'],
  ['/register/profile', 'Немного о себе'],
  ['/register/success', 'Регистрация успешна!'],
  ['/setup', 'Давайте настроим Ваш профиль'],
  ['/transactions', 'Операции'],
  ['/analytics', 'Аналитика'],
  ['/goals', 'Цели'],
  ['/auth', 'С возвращением!'],
  ['/discounts', 'Скидки'],
  ['/more', 'Ещё'],
] as const;

test('прямые адреса и обновление страниц сохраняют экран', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const [path, title] of routes) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('навигация показывает активный раздел и поддерживает историю', async ({ page }, testInfo) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: testInfo.project.name === 'mobile' ? 'Мобильная навигация' : 'Основная навигация' });
  for (const [label, title] of [['Транзакции', 'Операции'], ['Копилки', 'Цели'], ['Скидки', 'Скидки'], ['Ещё', 'Ещё']]) {
    const link = nav.getByRole('link', { name: label, exact: true });
    await link.click();
    await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
    await expect(link).toHaveAttribute('aria-current', 'page');
  }
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: 'Скидки' })).toBeVisible();
});

test('на ширине 320px все шесть экранов помещаются без горизонтальной прокрутки', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  for (const [path, title] of routes.slice(0, 6)) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect.poll(() => page.locator('img').evaluateAll((images) => images.every((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  }
});

test('Dashboard и аналитика открываются без готовых финансовых данных', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Структура расходов', exact: true })).toBeVisible();
  await expect(page.locator('.dashboard-summary dd')).toHaveText(['—', '—']);
  await expect(page.getByText('За этот период расходов пока нет.', { exact: true })).toBeVisible();
  await expect(page.getByText('Недостаточно данных', { exact: true })).toBeVisible();
  await expect(page.getByText('Целей пока нет', { exact: true })).toBeVisible();
  await expect(page.locator('.recharts-pie')).toHaveCount(0);
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'Суммы расходов по категориям' })).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.dashboard-summary dd')).toHaveText(['—', '—']);
  await page.getByRole('button', { name: 'О рейтинге', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('Пока нет данных для оценки');
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await page.getByRole('link', { name: 'Бюджет 50 / 30 / 20 — открыть аналитику', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Аналитика' })).toBeVisible();
  await expect(page.getByText('Пока нет операций для анализа.', { exact: true })).toBeVisible();
  await expect(page.locator('.recharts-pie')).toHaveCount(0);
  await expect(page.getByRole('progressbar')).toHaveCount(0);
});

test('readiness и категории проходят из браузера через dev-прокси', async ({ page }) => {
  await page.goto('/more');
  const healthResponse = page.waitForResponse('**/api/v1/health/ready');
  const categoriesResponse = page.waitForResponse('**/api/v1/categories');
  await page.getByRole('button', { name: 'Проверить подключение' }).click();
  for (const response of await Promise.all([healthResponse, categoriesResponse])) {
    expect(response.status()).toBe(200);
    expect(response.headers()['x-finsmart-test-upstream']).toBe('true');
  }
  await expect(page.getByRole('status')).toContainText('Соединение установлено');
  await page.getByText('Категории сервиса: 2', { exact: true }).click();
  await expect(page.getByText('Супермаркеты', { exact: true })).toBeVisible();
});

test('503 показывает ошибку и позволяет повторить запрос', async ({ page }) => {
  await page.route('**/api/v1/health/ready', (route) => route.fulfill({ status: 503, json: { detail: 'Database unavailable' } }));
  await page.goto('/more');
  await page.getByRole('button', { name: 'Проверить подключение' }).click();
  await expect(page.getByRole('status')).toContainText('Сервис пока не готов');
  await page.unroute('**/api/v1/health/ready');
  await page.getByRole('button', { name: 'Проверить подключение' }).click();
  await expect(page.getByRole('status')).toContainText('Соединение установлено');
});

test('не принимает HTML с кодом 200 за готовность сервиса', async ({ page }) => {
  await page.route('**/api/v1/health/ready', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<html>Fallback</html>' }));
  await page.goto('/more');
  await page.getByRole('button', { name: 'Проверить подключение' }).click();
  await expect(page.getByRole('status')).toContainText('Не удалось проверить подключение');
});

test('сетевая ошибка не ломает экран', async ({ page }) => {
  await page.route('**/api/v1/health/ready', (route) => route.abort('failed'));
  await page.goto('/more');
  await page.getByRole('button', { name: 'Проверить подключение' }).click();
  await expect(page.getByRole('status')).toContainText('Нет соединения');
  await expect(page.getByRole('button', { name: 'Проверить подключение' })).toBeEnabled();
});

test('404 ведёт обратно к обзору', async ({ page }) => {
  await page.goto('/missing');
  await expect(page.getByRole('heading', { name: 'Страница не найдена' })).toBeVisible();
  await page.getByRole('link', { name: 'Вернуться к обзору' }).click();
  await expect(page.getByRole('heading', { name: 'Привет!' })).toBeVisible();
});
