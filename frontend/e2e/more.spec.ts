import { expect, test } from '@playwright/test';
import { mockAccount, signIn } from './helpers';

test('справка по вопросам доступна из «Ещё», поиск ведёт к нужному действию', async ({ page }, info) => {
  if (info.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/more');
  await page.getByRole('link', { name: /Вопрос-ответ/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Вопрос-ответ' })).toBeVisible();
  const navName = info.project.name === 'mobile' ? 'Мобильная навигация' : 'Основная навигация';
  await expect(page.getByRole('navigation', { name: navName }).getByRole('link', { name: 'Ещё', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.screenshot({ path: info.outputPath('faq.png'), scale: 'css' });
  await page.getByRole('searchbox', { name: 'Поиск по вопросам' }).fill('БАНКОВСКУЮ');
  await expect(page.locator('.faq-item')).toHaveCount(1);
  await expect(page.getByText('Как загрузить банковскую выписку?', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Загрузить выписку', exact: true }).click();
  await expect(page).toHaveURL(/\/setup$/);
});

test('«Ещё» открывает профиль и общие настройки отдельными пунктами', async ({ page }, info) => {
  await mockAccount(page);
  if (info.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 568 });
  await signIn(page);
  await page.goto('/more');
  await page.getByRole('navigation', { name: 'Другие разделы' }).getByRole('link', { name: 'Профиль', exact: true }).click();
  await expect(page).toHaveURL(/\/more\/profile$/);

  await page.goto('/more');
  await page.getByRole('link', { name: 'Настройки', exact: true }).click();
  await expect(page).toHaveURL(/\/more\/settings$/);
  await expect(page.getByRole('heading', { name: 'Настройки', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (info.project.name === 'mobile') {
    const accountButton = await page.getByRole('button', { name: 'Выйти из аккаунта' }).boundingBox();
    const navigation = await page.getByRole('navigation', { name: 'Мобильная навигация' }).boundingBox();
    expect(accountButton!.y + accountButton!.height).toBeLessThan(navigation!.y);
  }
  await page.screenshot({ path: info.outputPath('app-settings.png'), scale: 'css' });

  const notifications = page.getByRole('switch', { name: 'Уведомления' });
  const biometrics = page.getByRole('switch', { name: 'Биометрия' });
  await expect(notifications).toBeChecked();
  await expect(biometrics).not.toBeChecked();
  await notifications.uncheck();
  await biometrics.check();
  await page.reload();
  await expect(notifications).not.toBeChecked();
  await expect(biometrics).toBeChecked();

  await page.getByRole('button', { name: /Тема оформления/ }).click();
  await expect(page.getByRole('dialog', { name: 'Тема оформления' })).toContainText('Светлая тема', { ignoreCase: true });
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await page.getByRole('button', { name: 'Политика конфиденциальности' }).click();
  await expect(page.getByRole('dialog', { name: 'Политика конфиденциальности' })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('link', { name: 'Личные данные', exact: true }).click();
  await expect(page).toHaveURL(/\/more\/profile\/settings$/);
  await page.getByRole('link', { name: 'Назад', exact: true }).click();
  await expect(page).toHaveURL(/\/more\/settings$/);
  await page.getByRole('button', { name: 'Выйти из аккаунта', exact: true }).click();
  await expect(page).toHaveURL(/\/welcome$/);
  await page.goto('/more/settings');
  await expect(page.getByRole('link', { name: 'Войти в аккаунт' })).toBeVisible();
});
