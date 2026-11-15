import { afterEach, describe, expect, it } from 'vitest';
import { api } from '@/shared/api/client';
import { getDashboard } from './api';
import { parseDashboard } from './model/parse';

const response = {
  period: { from: '2026-10-01', to: '2026-10-31' },
  summary: { total_income: 100, total_expense: 150, net_balance: -50 },
  budget_50_30_20: {
    needs: { amount: 100, percent: 100, target_percent: 50, target_amount: 50, deviation: 50 },
    wants: { amount: 50, percent: 50, target_percent: 30, target_amount: 30, deviation: 20 },
    savings: { amount: 0, percent: 0, target_percent: 20, target_amount: 20, deviation: -20 },
  },
  by_categories: [{ category_id: 1, name: 'Продукты', amount: 150, percent: 100 }],
  income_base: 100, deficit_financing: false, unallocated_expense: 0, budget_score: 0,
};
const originalAdapter = api.defaults.adapter;
afterEach(() => { api.defaults.adapter = originalAdapter; });

describe('контракт аналитики действующего backend', () => {
  it('передаёт обе календарные границы в analytics/budget', async () => {
    api.defaults.adapter = async (config) => {
      expect(config.url).toBe('/analytics/budget');
      expect(config.params).toEqual({ from_date: '2026-10-01', to_date: '2026-10-31' });
      return { data: response, status: 200, statusText: 'OK', headers: {}, config };
    };
    await expect(getDashboard(response.period)).resolves.toEqual(response);
  });
  it('сохраняет отрицательный баланс и расходы выше доходов', () => {
    const parsed = parseDashboard(response);
    expect(parsed.summary.net_balance).toBe(-50);
    expect(parsed.budget_50_30_20.needs.percent).toBe(100);
  });
  it.each([null, '<html>fallback</html>', {}, { ...response, summary: { ...response.summary, total_income: '100' } }, { ...response, budget_score: NaN }, { ...response, by_categories: [{ category_id: 1, name: '', amount: 1, percent: 1 }] }])('не принимает некорректный HTTP 200 за данные %j', (data) => {
    expect(() => parseDashboard(data)).toThrow('неожиданном формате');
  });
  it('не показывает данные за другой период', async () => {
    api.defaults.adapter = async (config) => ({ data: response, status: 200, statusText: 'OK', headers: {}, config });
    await expect(getDashboard({ from: '2026-11-01', to: '2026-11-30' })).rejects.toThrow('неожиданном формате');
  });
});
