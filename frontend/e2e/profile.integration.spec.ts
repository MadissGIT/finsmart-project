import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { TEST_PASSWORD } from './helpers';

async function openSettingsAs(page: Page, email: string) {
  await page.goto('/more/profile/settings');
  await expect(page).toHaveURL(/\/auth\?next=/);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Пароль', { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/more\/profile\/settings$/);
}

test('профиль получает дату и достижения из API, сохраняет имя и настройки между входами', async ({ page, request }, info) => {
  const email = 'profile-' + randomUUID() + '@example.com';
  const registration = await request.post('/api/v1/auth/register', {
    data: { email, password: TEST_PASSWORD, full_name: 'Учебный профиль', birth_date: '2000-02-29' },
  });
  expect(registration.status()).toBe(201);
  const { access_token: token } = await registration.json();
  const headers = { Authorization: 'Bearer ' + token };
  const now = new Date();
  const deadline = new Date(now.getTime() + 30 * 86_400_000).toISOString().slice(0, 10);
  expect((await request.post('/api/v1/goals', {
    headers, data: { title: 'Копилка для проверки', target_amount: 20000, deadline },
  })).status()).toBe(201);
  expect((await request.post('/api/v1/transactions', {
    headers,
    data: { amount: 10000, operation_type: 'CREDIT', category_id: 10, merchant_name: 'Тест', transaction_date: now.toISOString() },
  })).status()).toBe(201);

  if (info.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 700 });
  await openSettingsAs(page, email);
  const birthDate = page.getByLabel('Дата рождения', { exact: true });
  await expect(birthDate).toHaveValue('29.02.2000');
  await expect(birthDate).toHaveAttribute('readonly', '');
  await page.getByLabel('Имя', { exact: true }).fill('Обновлённое имя');
  await page.getByLabel('Цель', { exact: true }).selectOption('saving');
  await page.getByLabel('Уровень дохода (в месяц)', { exact: true }).selectOption('30-60');
  const updated = page.waitForResponse((response) =>
    response.url().endsWith('/api/v1/users/me') && response.request().method() === 'PATCH');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  expect((await updated).status()).toBe(200);
  await expect(page.getByText('Изменения сохранены.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Имя', { exact: true })).toHaveValue('Обновлённое имя');
  await expect(birthDate).toHaveValue('29.02.2000');
  await expect(page.getByLabel('Цель', { exact: true })).toHaveValue('saving');
  await page.screenshot({ path: info.outputPath('settings.png'), scale: 'css' });

  await page.getByRole('link', { name: 'Назад', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Обновлённое имя' })).toBeVisible();
  await expect(page.getByText('5 баллов', { exact: true })).toBeVisible();
  await expect(page.locator('.profile-health-ring strong')).toHaveText(/^\d+$/);
  await page.screenshot({ path: info.outputPath('profile.png'), scale: 'css' });

  await page.getByRole('link', { name: 'Все бейджи', exact: true }).click();
  const badge = page.getByRole('button', { name: 'Мечтатель, получен' });
  await expect(badge).toBeVisible();
  await badge.click();
  await expect(page.getByRole('dialog', { name: 'Мечтатель' })).toContainText('Получен');
  await page.keyboard.press('Escape');
  await page.screenshot({ path: info.outputPath('achievements.png'), scale: 'css' });

  await page.getByRole('link', { name: 'Статистика', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Прогресс по уровням' })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Бронза' })).toHaveAttribute('value', '1');
  await page.screenshot({ path: info.outputPath('statistics.png'), scale: 'css' });

  await page.getByRole('link', { name: 'Назад', exact: true }).click();
  await page.getByRole('link', { name: 'Все', exact: true }).click();
  await page.getByRole('link', { name: 'Завершённые', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Завершённые', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: 'Челленджи пока недоступны' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('challenges.png'), scale: 'css' });

  await page.goto('/more/profile/settings');
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(page).toHaveURL(/\/welcome$/);

  const otherEmail = 'profile-other-' + randomUUID() + '@example.com';
  expect((await request.post('/api/v1/auth/register', {
    data: { email: otherEmail, password: TEST_PASSWORD, full_name: 'Другой аккаунт' },
  })).status()).toBe(201);
  await openSettingsAs(page, otherEmail);
  await expect(page.getByLabel('Цель', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Уровень дохода (в месяц)', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(page).toHaveURL(/\/welcome$/);

  const freshTab = await page.context().newPage();
  await openSettingsAs(freshTab, email);
  await expect(freshTab.getByLabel('Цель', { exact: true })).toHaveValue('saving');
  await expect(freshTab.getByLabel('Уровень дохода (в месяц)', { exact: true })).toHaveValue('30-60');
  await freshTab.close();
});
