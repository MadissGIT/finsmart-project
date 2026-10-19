import type { DashboardResponse } from '@/entities/analytics/model/types';

// Пример из раздела 4.3 проектной документации. Это не данные пользователя.
export const demoDashboard = {
  period: { from: '2026-10-01', to: '2026-10-31' },
  summary: { total_income: 80_000, total_expense: 54_200, net_balance: 25_800 },
  budget_50_30_20: {
    needs: { amount: 28_000, percent: 51.6, target_percent: 50 },
    wants: { amount: 21_200, percent: 39.1, target_percent: 30 },
    savings: { amount: 5_000, percent: 9.3, target_percent: 20 },
  },
  by_categories: [
    { category_id: 1, name: 'Супермаркеты', amount: 18_500, percent: 34.1 },
    { category_id: 5, name: 'Кафе и рестораны', amount: 12_400, percent: 22.8 },
  ],
  diagnostics: {
    health_score: 68,
    persona: 'Рассеянный спендер',
    alerts: [{
      type: 'WARNING_OVERSPEND',
      category: 'Кафе и рестораны',
      message: 'Расходы на кафе выросли на 28% относительно прошлого месяца. Рекомендуем установить лимит.',
      potential_saving: 4_000,
    }],
  },
} satisfies DashboardResponse;
