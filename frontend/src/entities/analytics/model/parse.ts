import { ApiContractError, isFiniteNumber, isRecord } from '@/shared/lib/guards';
import type { BudgetAllocation, CategoryExpense, DashboardResponse } from './types';

function isAllocation(value: unknown): value is BudgetAllocation {
  return isRecord(value) && ['amount', 'percent', 'target_percent', 'target_amount'].every((key) => isFiniteNumber(value[key]) && value[key] >= 0)
    && isFiniteNumber(value.deviation);
}

function isCategory(value: unknown): value is CategoryExpense {
  return isRecord(value) && Number.isInteger(value.category_id) && Number(value.category_id) > 0
    && typeof value.name === 'string' && value.name.trim().length > 0
    && isFiniteNumber(value.amount) && value.amount >= 0 && isFiniteNumber(value.percent) && value.percent >= 0;
}

export function parseDashboard(data: unknown): DashboardResponse {
  if (!isRecord(data) || !isRecord(data.period) || typeof data.period.from !== 'string' || typeof data.period.to !== 'string'
    || !/^\d{4}-\d{2}-\d{2}$/.test(data.period.from) || !/^\d{4}-\d{2}-\d{2}$/.test(data.period.to)
    || !isRecord(data.summary) || !isFiniteNumber(data.summary.total_income) || data.summary.total_income < 0
    || !isFiniteNumber(data.summary.total_expense) || data.summary.total_expense < 0 || !isFiniteNumber(data.summary.net_balance)
    || !isRecord(data.budget_50_30_20) || !isAllocation(data.budget_50_30_20.needs)
    || !isAllocation(data.budget_50_30_20.wants) || !isAllocation(data.budget_50_30_20.savings)
    || !Array.isArray(data.by_categories) || !data.by_categories.every(isCategory)
    || !isFiniteNumber(data.income_base) || data.income_base < 0 || typeof data.deficit_financing !== 'boolean'
    || !isFiniteNumber(data.unallocated_expense) || data.unallocated_expense < 0
    || !isFiniteNumber(data.budget_score) || data.budget_score < 0 || data.budget_score > 100) throw new ApiContractError();
  return {
    period: { from: data.period.from, to: data.period.to },
    summary: { total_income: data.summary.total_income, total_expense: data.summary.total_expense, net_balance: data.summary.net_balance },
    budget_50_30_20: { needs: data.budget_50_30_20.needs, wants: data.budget_50_30_20.wants, savings: data.budget_50_30_20.savings },
    by_categories: data.by_categories,
    income_base: data.income_base, deficit_financing: data.deficit_financing,
    unallocated_expense: data.unallocated_expense, budget_score: data.budget_score,
  };
}
