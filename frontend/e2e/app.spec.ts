import { expect, test } from '@playwright/test';

const routes = [
  ['/', 'Обзор финансов'],
  ['/transactions', 'Операции'],
  ['/analytics', 'Аналитика'],
  ['/goals', 'Цели'],
  ['/auth', 'Профиль'],
] as const;

test('прямые адреса и обновление страницы сохраняют экран', async ({ page }) => {
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
  await expect(nav).toBeVisible();
  for (const label of ['Операции', 'Аналитика', 'Цели', 'Профиль']) {
    const link = nav.getByRole('link', { name: label, exact: true });
    await link.click();
    await expect(page.getByRole('heading', { level: 1, name: label, exact: true })).toBeVisible();
    await expect(link).toHaveAttribute('aria-current', 'page');
  }
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: 'Цели' })).toBeVisible();
});

test('нет горизонтальной прокрутки, график и суммы видны', async ({ page }) => {
  await page.goto('/analytics');
  await expect(page.getByRole('heading', { name: 'Расходы по категориям' })).toBeVisible();
  await expect(page.locator('.recharts-pie')).toBeVisible();
  await expect(page.getByText('Остальные категории', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('readiness проходит из браузера через настоящий dev-прокси', async ({ page }) => {
  await page.goto('/');
  const responsePromise = page.waitForResponse('**/api/v1/health/ready');
  await page.getByRole('button', { name: 'Проверить подключение' }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  expect(response.headers()['x-finsmart-test-upstream']).toBe('true');
  await expect(page.getByRole('status')).toContainText('Соединение установлено');
});

test('503 показывает ошибку и позволяет повторить запрос', async ({ page }) => {
  await page.route('**/api/v1/health/ready', (route) => route.fulfill({ status: 503, json: { detail: 'Database unavailable' } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Проверить подключение' }).click();
  await expect(page.getByRole('status')).toContainText('Сервис пока не готов');
  await page.unroute('**/api/v1/health/ready');
  await page.getByRole('button', { name: 'Проверить подключение' }).click();
  await expect(page.getByRole('status')).toContainText('Соединение установлено');
});

test('не выдаёт HTML с кодом 200 за успешное подключение', async ({ page }) => {
  await page.route('**/api/v1/health/ready', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<html>Fallback</html>' }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Проверить подключение' }).click();
  await expect(page.getByRole('status')).toContainText('Не удалось проверить подключение');
});

test('при сетевой ошибке сохраняет страницу и доступную кнопку повтора', async ({ page }) => {
  await page.route('**/api/v1/health/ready', (route) => route.abort('failed'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Проверить подключение' }).click();
  await expect(page.getByRole('status')).toContainText('Нет соединения');
  await expect(page.getByRole('button', { name: 'Проверить подключение' })).toBeEnabled();
});

test('нижняя навигация помещается на экране шириной 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/analytics');
  await expect(page.getByRole('navigation', { name: 'Мобильная навигация' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('404 ведёт обратно к обзору', async ({ page }) => {
  await page.goto('/missing');
  await expect(page.getByRole('heading', { name: 'Страница не найдена' })).toBeVisible();
  await page.getByRole('link', { name: 'Вернуться к обзору' }).click();
  await expect(page.getByRole('heading', { name: 'Обзор финансов' })).toBeVisible();
});
