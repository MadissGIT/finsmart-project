import { expect, test } from '@playwright/test';

test('проверяет поля, показывает пароль и объясняет Google-вход', async ({ page }) => {
  await page.goto('/register');
  await page.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
  await expect(page.getByText('Укажите email в формате name@example.ru.')).toBeVisible();
  await expect(page.getByText('Пароли должны совпадать.')).toBeVisible();
  await page.getByLabel('Пароль', { exact: true }).fill('Study1234');
  await page.getByRole('button', { name: 'Показать пароль', exact: true }).click();
  await expect(page.getByLabel('Пароль', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Скрыть пароль', exact: true }).click();
  await expect(page.getByLabel('Пароль', { exact: true })).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Продолжить с Google', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Google-вход ещё не подключён');
  await page.getByRole('button', { name: 'условия использования', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Настоящий аккаунт не создаётся');
  await page.getByRole('dialog').press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('полный сценарий: Welcome → регистрация → данные → успех → настройка → Dashboard', async ({ page }) => {
  const authRequests: string[] = [];
  page.on('request', (request) => { if (/\/api\/.*auth/.test(request.url())) authRequests.push(request.url()); });
  await page.goto('/welcome');
  await page.getByRole('link', { name: 'Создать аккаунт', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill('maxim@example.test');
  await page.getByLabel('Пароль', { exact: true }).fill('Study1234');
  await page.getByLabel('Повторите пароль', { exact: true }).fill('Study1234');
  await page.getByRole('checkbox', { name: /Я принимаю/ }).check();
  await page.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Немного о себе', exact: true })).toBeVisible();
  await page.reload();
  await page.getByLabel('Имя', { exact: true }).fill('Максим');
  await page.getByLabel('Дата рождения', { exact: true }).fill('2000-01-01');
  await page.getByLabel('Цель', { exact: true }).selectOption('saving');
  await page.getByLabel('Уровень дохода (в месяц)', { exact: true }).selectOption('30-60');
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Регистрация успешна!', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Начать', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Давайте настроим Ваш профиль', exact: true })).toBeVisible();
  await page.getByLabel('Выбрать банковскую выписку', { exact: true }).setInputFiles({ name: 'statement.csv', mimeType: 'text/csv', buffer: Buffer.from('date,amount\n2026-09-01,100') });
  await expect(page.getByRole('status')).toContainText('statement.csv');
  await expect(page.getByRole('status')).toContainText('не отправляется');
  await page.getByRole('link', { name: 'Перейти к обзору', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Привет, Максим!', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Привет, Максим!', exact: true })).toBeVisible();
  await expect(page.locator('.dashboard-summary dd')).toHaveText(['—', '—']);
  await expect(page.getByText('Целей пока нет', { exact: true })).toBeVisible();
  const stored = await page.evaluate(() => JSON.stringify({ ...sessionStorage, ...localStorage }));
  expect(stored).not.toContain('Study1234');
  expect(stored).not.toContain('2000-01-01');
  expect(authRequests).toEqual([]);
  await page.getByRole('banner').getByRole('link', { name: 'Профиль', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Профиль', level: 1 })).toBeVisible();
  await expect(page.getByText('Накопить на цель', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Сбросить демо', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'ФинСмарт', exact: true })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('finsmart.demo.v1'))).not.toContain('maxim@example.test');
});

test('необязательные данные и настройку можно пропустить', async ({ page }) => {
  await page.goto('/register/profile');
  await page.getByRole('link', { name: 'Пропустить', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Регистрация успешна!', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Пропустить', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Привет!', exact: true })).toBeVisible();
});

test('выбор неподдерживаемого файла показывает объяснение', async ({ page }) => {
  await page.goto('/setup');
  await page.getByLabel('Выбрать банковскую выписку', { exact: true }).setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('test') });
  await expect(page.getByRole('alert')).toContainText('Выберите файл CSV или XLSX');
  await page.getByRole('link', { name: 'Позже', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Привет!', exact: true })).toBeVisible();
});
