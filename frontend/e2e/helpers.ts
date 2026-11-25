import { expect } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

// Только тестовая среда. Эти данные не импортируются приложением и не загружаются в пользовательские аккаунты.
export const TEST_PASSWORD = 'FrontendStudy12345!';
export const TEST_EMAIL = 'frontend@example.com';
export const TEST_USER_ID = 'dc028083-bc14-459d-b42b-123456789abc';

export function budgetFixture(from: string, to: string, empty = false) {
  const october = from === '2026-10-01';
  const income = empty ? 0 : october ? 100000 : 50000;
  const needs = empty ? 0 : october ? 20000 : 5000;
  const wants = empty ? 0 : october ? 10000 : 2000;
  const savings = income - needs - wants;
  const allocation = (amount: number, target: number) => ({ amount, percent: income ? amount / income * 100 : 0, target_percent: target, target_amount: income * target / 100, deviation: amount - income * target / 100 });
  return {
    period: { from, to }, summary: { total_income: income, total_expense: needs + wants, net_balance: savings },
    budget_50_30_20: { needs: allocation(needs, 50), wants: allocation(wants, 30), savings: allocation(savings, 20) },
    by_categories: empty ? [] : [{ category_id: 1, name: 'Супермаркеты', amount: needs, percent: needs / (needs + wants) * 100 }, { category_id: 5, name: 'Кафе и рестораны', amount: wants, percent: wants / (needs + wants) * 100 }],
    income_base: income, deficit_financing: false, unallocated_expense: 0, budget_score: empty ? 0 : 100,
  };
}

export async function mockAccount(page: Page, options: { empty?: boolean } = {}) {
  let email = TEST_EMAIL;
  let fullName = 'Тестовый пользователь';
  let birthDate: string | null = null;
  let access = 'test-access-1';
  let refresh = 'test-refresh-1';
  let refreshCount = 0;
  let importCount = 0;
  const budgetRequests: string[] = [];
  const diagnosisRequests: string[] = [];
  const authRequests: string[] = [];
  const tokens = () => ({ user_id: TEST_USER_ID, email, access_token: access, refresh_token: refresh, token_type: 'bearer' });
  const json = (route: Route, status: number, body: unknown) => route.fulfill({ status, json: body });
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    if (path === '/auth/login' || path === '/auth/register') {
      authRequests.push(path);
      const fields = request.postDataJSON();
      if (fields.password !== TEST_PASSWORD) return json(route, 401, { detail: 'Неверный email или пароль' });
      email = fields.email;
      if (path === '/auth/register') {
        fullName = fields.full_name;
        birthDate = fields.birth_date ?? null;
      }
      return json(route, path === '/auth/register' ? 201 : 200, tokens());
    }
    if (path === '/auth/refresh') {
      if (request.postDataJSON().refresh_token !== refresh) return json(route, 401, { detail: 'Сессия истекла' });
      refreshCount += 1;
      access = 'test-access-' + (refreshCount + 1);
      refresh = 'test-refresh-' + (refreshCount + 1);
      return json(route, 200, tokens());
    }
    if (path === '/analytics/expenses/trend') {
      if (request.headers().authorization !== 'Bearer ' + access) return json(route, 401, { detail: 'Требуется вход' });
      const from = new Date(url.searchParams.get('from_date') + 'T00:00:00Z');
      const to = new Date(url.searchParams.get('to_date') + 'T00:00:00Z');
      const byWeek = url.searchParams.get('group_by') === 'week';
      if (byWeek) from.setUTCDate(from.getUTCDate() - (from.getUTCDay() + 6) % 7);
      const points = [];
      for (const day = from; day <= to; day.setUTCDate(day.getUTCDate() + (byWeek ? 7 : 1))) {
        points.push({ date: day.toISOString().slice(0, 10), amount: 0 });
      }
      return json(route, 200, points);
    }
    if (['/users/me', '/analytics/budget', '/analytics/dashboard', '/transactions/import-statement', '/goals', '/achievements'].includes(path)) {
      if (request.headers().authorization !== 'Bearer ' + access) return json(route, 401, { detail: 'Требуется вход' });
      if (path === '/users/me') return json(route, 200, { id: TEST_USER_ID, email, full_name: fullName, birth_date: birthDate, created_at: '2026-10-01T00:00:00Z' });
      if (path === '/achievements') return json(route, 200, { items: [], reward_points: 0 });
      if (path === '/goals') return request.method() === 'GET' ? json(route, 200, []) : route.fallback();
      if (path === '/transactions/import-statement') {
        importCount += 1;
        return json(route, 200, { total_parsed: 2, imported_count: 2, duplicates_skipped: 0, skipped_rows: 0 });
      }
      const isDiagnosis = path === '/analytics/dashboard';
      (isDiagnosis ? diagnosisRequests : budgetRequests).push(url.search);
      const from = url.searchParams.get('from_date');
      const to = url.searchParams.get('to_date');
      if (!from || !to) return json(route, 422, { detail: 'Нужны обе даты периода' });
      const budget = budgetFixture(from, to, options.empty);
      if (!isDiagnosis) return json(route, 200, budget);
      return json(route, 200, { ...budget, diagnostics: {
        health_score: 75,
        indices: { balance: 100, budget: 100, goals: 50, regularity: 0 },
        status: 'Стабильное здоровье', color: '#3B82F6', persona: 'Стабильное здоровье',
        alerts: [], unavailable: {},
      } });
    }
    return route.fallback();
  });
  return { budgetRequests, diagnosisRequests, authRequests, get refreshCount() { return refreshCount; }, get importCount() { return importCount; } };
}

export async function signIn(page: Page, email = TEST_EMAIL, password = TEST_PASSWORD) {
  await page.goto('/auth');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Пароль', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Привет/ })).toBeVisible();
  await expect(page.getByRole('status', { name: '' }).filter({ hasText: 'Загружаем финансовый обзор' })).toHaveCount(0);
}

export async function setPeriod(page: Page, from: string, to: string) {
  await page.getByLabel('Период', { exact: true }).selectOption('custom');
  await page.getByLabel('С', { exact: true }).fill(from);
  await page.getByLabel('По', { exact: true }).fill(to);
  await page.getByRole('button', { name: 'Применить', exact: true }).click();
}
