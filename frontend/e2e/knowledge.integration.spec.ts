import { expect, test } from '@playwright/test';
import type { Article } from '../src/entities/article/model/types';

test('из «Ещё» открываются реальные статьи, темы и избранное', async ({ page, request }, info) => {
  const response = await request.get('/api/v1/articles');
  expect(response.status()).toBe(200);
  const catalog: Article[] = await response.json();
  const article = catalog.find(({ tags }) => tags.length > 0);
  expect(article).toBeDefined();
  if (!article) return;

  if (info.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/more');
  await expect(page.getByRole('heading', { name: 'Ещё', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('more.png'), scale: 'css' });
  await page.getByRole('link', { name: /База знаний/ }).click();
  await expect(page.locator('.knowledge-item')).toHaveCount(catalog.length);
  await expect(page.getByRole('heading', { name: 'База знаний', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('knowledge.png'), scale: 'css' });

  const tag = article.tags[0];
  const serverFilter = page.waitForResponse((reply) => new URL(reply.url()).searchParams.get('tags') === tag);
  await page.getByRole('button', { name: tag, exact: true }).click();
  expect((await serverFilter).status()).toBe(200);
  await expect(page.locator('.knowledge-item')).toHaveCount(catalog.filter(({ tags }) => tags.includes(tag)).length);
  await page.getByRole('searchbox', { name: 'Поиск статей' }).fill(article.title.slice(0, 18));
  const opened = page.waitForResponse('**/api/v1/articles/' + article.id);
  await page.locator('.knowledge-item').filter({ hasText: article.title }).click();
  expect((await opened).status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: article.title })).toBeVisible();
  await expect(page.getByText(article.read_time_min + ' мин чтения', { exact: true })).toBeVisible();
  await expect(page.locator('.knowledge-body')).toContainText(article.content_markdown.split('\n')[0]);
  await page.screenshot({ path: info.outputPath('article.png'), scale: 'css' });
  await page.getByRole('button', { name: 'Избранное', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Избранное', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { level: 1, name: article.title })).toBeVisible();
  await page.getByRole('link', { name: 'К базе знаний', exact: true }).click();
  await expect(page.getByRole('button', { name: tag, exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('searchbox', { name: 'Поиск статей' })).toHaveValue(article.title.slice(0, 18));
  await page.getByRole('button', { name: 'Избранные статьи', exact: true }).click();
  await expect(page.locator('.knowledge-item')).toHaveCount(1);

  await page.goto('/more/knowledge/article-not-found');
  await expect(page.getByRole('heading', { level: 1, name: 'Статья не найдена' })).toBeVisible();
});
