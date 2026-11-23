import { expect, test } from '@playwright/test';

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
