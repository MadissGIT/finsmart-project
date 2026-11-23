import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { signIn, TEST_PASSWORD } from './helpers';

test('копилка работает от создания до удаления с настоящими взносами API', async ({ page, request }, info) => {
  const email = 'goal-' + randomUUID() + '@example.com';
  const registration = await request.post('/api/v1/auth/register', {
    data: { email, password: TEST_PASSWORD, full_name: 'Проверка копилок' },
  });
  expect(registration.status()).toBe(201);
  if (info.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 700 });
  await signIn(page, email);
  await page.getByRole('link', { name: 'Создать цель', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Создать цель' });
  await expect(form).toBeVisible();
  await form.getByLabel('Название', { exact: true }).fill('Поездка к морю');
  await form.getByLabel('Целевая сумма', { exact: true }).fill('25000');
  const deadline = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
  await form.getByLabel('Срок достижения', { exact: true }).fill(deadline);
  await form.getByRole('radio', { name: 'Поездки', exact: true }).check();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('goal-create.png'), scale: 'css' });
  const created = page.waitForResponse((response) => response.url().endsWith('/api/v1/goals') && response.request().method() === 'POST');
  await form.getByRole('button', { name: 'Создать цель', exact: true }).click();
  expect((await created).status()).toBe(201);
  await expect(page.getByRole('heading', { level: 1, name: 'Поездка к морю' })).toBeVisible();
  const goalPath = new URL(page.url()).pathname;
  expect(goalPath).toMatch(/^\/goals\/[a-f0-9-]+$/);
  await expect(page.getByText('Пополнений пока нет.', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Пополнить', exact: true }).click();
  const deposit = page.getByRole('dialog', { name: 'Пополнить цель' });
  const amount = deposit.getByLabel('Сумма пополнения', { exact: true });
  await amount.fill('26000');
  await deposit.getByRole('button', { name: 'Пополнить', exact: true }).click();
  await expect(deposit.getByText('Взнос превышает остаток до цели.')).toBeVisible();
  await amount.fill('5000');
  await deposit.getByRole('radio', { name: 'Экономия на скидках' }).check();
  await page.screenshot({ path: info.outputPath('goal-deposit.png'), scale: 'css' });
  const sent = page.waitForResponse('**/api/v1/goals/*/deposit');
  await deposit.getByRole('button', { name: 'Пополнить', exact: true }).click();
  expect((await sent).status()).toBe(200);
  const receipt = page.getByRole('dialog', { name: 'Цель пополнена!' });
  await expect(receipt).toContainText(/5\s*000\s*₽/);
  await receipt.getByRole('button', { name: 'Отлично' }).click();
  await expect(page.getByRole('region', { name: 'История пополнений' })).toContainText('Экономия на скидках');
  await page.reload();
  await expect(page.getByRole('region', { name: 'Прогресс и план' }).getByRole('progressbar')).toHaveAttribute('value', '20');
  await expect(page.locator('.goal-history-row')).toHaveCount(1);
  await page.screenshot({ path: info.outputPath('goal-detail.png'), scale: 'css' });

  await page.goto('/');
  const preview = page.getByRole('region', { name: 'Ближайшие цели' });
  await expect(preview.getByRole('link', { name: /Поездка к морю/ })).toHaveAttribute('href', goalPath);
  await preview.getByRole('link', { name: /Поездка к морю/ }).click();
  await page.getByRole('button', { name: 'Редактировать', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Редактировать цель' });
  await edit.getByLabel('Название', { exact: true }).fill('Поездка осенью');
  await edit.getByLabel('Целевая сумма', { exact: true }).fill('4000');
  await edit.getByRole('button', { name: 'Сохранить изменения' }).click();
  await expect(edit.getByText('Цель не может быть меньше уже накопленной суммы.')).toBeVisible();
  await edit.getByLabel('Целевая сумма', { exact: true }).fill('25000');
  await edit.getByRole('button', { name: 'Сохранить изменения' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Поездка осенью' })).toBeVisible();

  await page.getByRole('button', { name: 'Пополнить', exact: true }).click();
  await deposit.getByRole('button', { name: 'Весь остаток' }).click();
  await deposit.getByRole('button', { name: 'Пополнить', exact: true }).click();
  await receipt.getByRole('button', { name: 'Отлично' }).click();
  await expect(page.getByText('Цель достигнута', { exact: true })).toBeVisible();
  await expect(page.locator('.goal-history-row')).toHaveCount(2);
  await page.getByRole('link', { name: 'К копилкам', exact: true }).click();
  await expect(page.locator('.goal-card')).toHaveCount(1);
  await expect(page.locator('.goal-card')).toContainText('Цель достигнута');
  await page.screenshot({ path: info.outputPath('goals-list.png'), scale: 'css' });

  await page.locator('.goal-card').click();
  await page.getByRole('button', { name: 'Удалить копилку', exact: true }).click();
  await page.getByRole('dialog', { name: 'Удалить копилку?' }).getByRole('button', { name: 'Удалить копилку', exact: true }).click();
  await expect(page.getByText('Копилок пока нет', { exact: true })).toBeVisible();
  await page.goto(goalPath);
  await expect(page.getByRole('heading', { name: 'Копилка не найдена', exact: true })).toBeVisible();
});
