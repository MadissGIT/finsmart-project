import { expect, test } from '@playwright/test';
import { mockAccount, TEST_PASSWORD } from './helpers';

test('проверяет поля, показывает пароль и объясняет Google-вход', async ({ page }) => {
  await page.goto('/register');
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.getByText('Укажите email в формате name@example.ru.')).toBeVisible();
  await expect(page.getByText('Пароли должны совпадать.')).toBeVisible();
  await page.getByLabel('Пароль', { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Показать пароль', exact: true }).click();
  await expect(page.getByLabel('Пароль', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Скрыть пароль', exact: true }).click();
  await expect(page.getByLabel('Пароль', { exact: true })).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Продолжить с Google', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Google-вход ещё не подключён');
  await page.getByRole('button', { name: 'информацией о сервисе', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('передаются на сервер');
  await page.getByRole('dialog').press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('регистрация, импорт, сохранение входа и выход из аккаунта', async ({ page }) => {
  const api = await mockAccount(page, { empty: true });
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/welcome');
  await page.getByRole('link', { name: 'Создать аккаунт', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill('maxim@example.com');
  await page.getByLabel('Пароль', { exact: true }).fill(TEST_PASSWORD);
  await page.getByLabel('Повторите пароль', { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole('checkbox', { name: /Я ознакомился/ }).check();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Немного о себе', exact: true })).toBeVisible();
  await page.getByLabel('Имя', { exact: true }).fill('Максим');
  await expect(page.getByLabel('Дата рождения', { exact: true })).toBeDisabled();
  await page.getByLabel('Цель использования', { exact: true }).selectOption('saving');
  await page.getByLabel('Уровень дохода (в месяц)', { exact: true }).selectOption('30-60');
  await page.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Регистрация успешна!', exact: true })).toBeVisible();
  expect(api.authRequests).toContain('/auth/register');
  await page.getByRole('link', { name: 'Начать', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Давайте настроим Ваш профиль', exact: true })).toBeVisible();
  await page.getByLabel('Выбрать банковскую выписку', { exact: true }).setInputFiles({ name: 'statement.csv', mimeType: 'text/csv', buffer: Buffer.from('date,amount\n2026-09-01,100') });
  await expect(page.getByRole('status')).toContainText('statement.csv');
  expect(api.importCount).toBe(0);
  await page.getByRole('button', { name: 'Импортировать выписку', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Импортировано: 2');
  expect(api.importCount).toBe(1);
  await page.getByRole('link', { name: 'Перейти к обзору', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Привет, Максим!', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Привет, Максим!', exact: true })).toBeVisible();
  await expect(page.locator('.dashboard-summary dd')).toHaveText([/0\s*₽/, /0\s*₽/, /0\s*₽/]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const stored = await page.evaluate(() => JSON.stringify({ ...sessionStorage, ...localStorage }));
  expect(stored).not.toContain(TEST_PASSWORD);
  await page.getByRole('banner').getByRole('link', { name: 'Профиль', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Профиль', level: 1 })).toBeVisible();
  await expect(page.getByText('Накопить на цель', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'ФинСмарт', exact: true })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('finsmart.auth.v1'))).toBeNull();
  await page.goto('/');
  await expect(page.locator('.dashboard-summary dd')).toHaveText(['—', '—', '—']);
});

test('перезагрузка шага профиля требует повторно ввести пароль и не создаёт аккаунт', async ({ page }) => {
  const api = await mockAccount(page);
  await page.goto('/register');
  await page.getByLabel('Email', { exact: true }).fill('maxim@example.com');
  await page.getByLabel('Пароль', { exact: true }).fill(TEST_PASSWORD);
  await page.getByLabel('Повторите пароль', { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole('checkbox', { name: /Я ознакомился/ }).check();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Немного о себе', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Создать аккаунт', exact: true })).toBeVisible();
  expect(api.authRequests).toEqual([]);
  expect(await page.getByLabel('Пароль', { exact: true }).inputValue()).toBe('');
});

test('неподдерживаемая выписка не отправляется на сервер', async ({ page }) => {
  await page.goto('/setup');
  await page.getByLabel('Выбрать банковскую выписку', { exact: true }).setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('test') });
  await expect(page.getByRole('alert')).toContainText('Выберите файл CSV или XLSX');
  await page.getByRole('link', { name: 'Позже', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Привет!', exact: true })).toBeVisible();
});
