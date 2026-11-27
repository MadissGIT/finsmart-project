import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { TEST_PASSWORD } from './helpers';

test('новый аккаунт получает приветствие, отправляет тикет и откладывает экономию от ручного расхода', async ({ page, request }, info) => {
  test.setTimeout(60_000);
  const email = 'welcome-' + randomUUID() + '@example.com';
  if (info.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/register');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Пароль', { exact: true }).fill(TEST_PASSWORD);
  await page.getByLabel('Повторите пароль', { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole('checkbox', { name: /Я ознакомился/ }).check();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await page.getByLabel('Имя', { exact: true }).fill('Тестовый профиль');
  const register = page.waitForResponse('**/api/v1/auth/register');
  await page.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
  const registration = await register;
  expect(registration.status()).toBe(201);
  const { access_token: token } = await registration.json();
  const headers = { Authorization: 'Bearer ' + token };

  await page.getByRole('link', { name: 'Пропустить', exact: true }).click();
  const welcome = page.locator('.dashboard-notifications');
  await expect(welcome.getByRole('heading', { name: /Добро пожаловать/ })).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(welcome.locator('.notification-icon')).toHaveCSS('animation-name', 'notification-glow');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(welcome.locator('.notification-icon')).toHaveCSS('animation-name', 'none');
  await page.screenshot({ path: info.outputPath('welcome.png'), scale: 'css' });
  await welcome.getByRole('link', { name: 'Записать первую операцию' }).click();
  const form = page.getByRole('dialog', { name: 'Добавить операцию', exact: true });
  await form.getByLabel('Сумма', { exact: true }).fill('800');
  await form.getByRole('radio', { name: 'Супермаркеты', exact: true }).check();
  await form.getByLabel('Организация или описание', { exact: true }).fill('ВкусВилл');
  await form.getByRole('button', { name: 'Добавить расход', exact: true }).click();
  await page.getByRole('button', { name: 'Посмотреть операцию', exact: true }).click();
  await expect(page).toHaveURL(/transaction=/);
  const expenseUrl = page.url();

  const goal = await request.post('/api/v1/goals', {
    headers, data: { title: 'Тестовый резерв', target_amount: 1000, deadline: '2099-12-31' },
  });
  expect(goal.status()).toBe(201);
  const goalId = (await goal.json()).id;
  await page.getByRole('button', { name: 'Отложить экономию', exact: true }).click();
  const saving = page.getByRole('dialog', { name: 'Экономия на скидке', exact: true });
  await saving.getByLabel('Цена до скидки, ₽', { exact: true }).fill('1000');
  await saving.getByRole('combobox', { name: 'Копилка', exact: true }).selectOption(goalId);
  await expect(saving.getByText(/Экономия: 200\s*₽/)).toBeVisible();
  await page.screenshot({ path: info.outputPath('discount-savings.png'), scale: 'css' });
  await saving.getByRole('button', { name: 'Записать взнос', exact: true }).click();
  await expect(page.getByText(/Из экономии отложено 200\s*₽/)).toBeVisible();
  expect((await (await request.get('/api/v1/goals/' + goalId, { headers })).json()).current_amount).toBe(200);
  await page.reload();
  await expect(page.getByText(/Из экономии отложено 200\s*₽/)).toBeVisible();
  await page.goto('/');
  await expect(welcome.getByRole('heading', { name: /Первый шаг сделан/ })).toBeVisible();
  await expect(welcome.getByRole('heading', { name: /Добро пожаловать/ })).toHaveCount(0);
  await page.goto(expenseUrl);
  await page.getByRole('button', { name: 'Отменить взнос', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Отложить экономию', exact: true })).toBeVisible();

  await page.goto('/discounts');
  await page.getByRole('link', { name: /ВкусВилл.*20% на любимый продукт/ }).first().click();
  await expect(page.getByRole('link', { name: 'Перейти в магазин' }))
    .toHaveAttribute('href', 'https://vkusvill.ru/offers/lyubimyy-produkt.html');
  await page.getByRole('link', { name: 'Записать покупку со скидкой' }).click();
  await expect(form.getByLabel('Организация или описание', { exact: true })).toHaveValue('ВкусВилл');
  await expect(form.getByRole('radio', { name: 'Супермаркеты', exact: true })).toBeChecked();

  await page.goto('/more/support');
  await expect(page.getByRole('heading', { name: 'Написать в поддержку', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Отправить запрос', exact: true })).toBeDisabled();
  await page.getByRole('textbox', { name: 'Опишите проблему' }).fill('Проверка формы поддержки');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'test.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n'),
  });
  await page.screenshot({ path: info.outputPath('support.png'), scale: 'css' });
  await page.getByRole('button', { name: 'Отправить запрос', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Запрос отправлен', exact: true })).toBeVisible();
  await expect(page.locator('.support-ticket code')).toHaveText(/^[0-9a-f-]{36}$/);

  await page.goto('/more/profile/settings');
  await expect(page.getByRole('heading', { name: 'Профиль', exact: true })).toBeVisible();
  await expect(page.getByText(email, { exact: true })).toHaveCount(0);
});
