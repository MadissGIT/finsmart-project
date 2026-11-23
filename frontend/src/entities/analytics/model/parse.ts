import { isCalendarDate } from '@/shared/lib/calendar';
import { ApiContractError, isFiniteNumber, isRecord, isUuid } from '@/shared/lib/guards';
import type {
  BudgetAllocation, CategoryExpense, DashboardResponse, DiagnosisResponse, DiagnosticAlert, DiagnosticOffer, ExpenseGrouping, ExpensePoint, FinancialDiagnosis,
} from './types';

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

function isScore(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 100;
}

function isOffer(value: unknown): value is DiagnosticOffer {
  return isRecord(value) && isUuid(value.id) && typeof value.partner_name === 'string'
    && typeof value.title === 'string' && typeof value.benefit === 'string' && typeof value.is_demo === 'boolean'
    && typeof value.valid_until === 'string' && (value.valid_until === '9999-12-31' || isCalendarDate(value.valid_until));
}

function isAlert(value: unknown): value is DiagnosticAlert {
  return isRecord(value) && typeof value.type === 'string' && typeof value.category === 'string'
    && typeof value.title === 'string' && typeof value.message === 'string' && typeof value.recommendation === 'string'
    && isFiniteNumber(value.potential_saving) && value.potential_saving >= 0
    && (value.badge === null || typeof value.badge === 'string')
    && Array.isArray(value.discounts) && value.discounts.every(isOffer);
}

function isDiagnosis(value: unknown): value is FinancialDiagnosis {
  return isRecord(value) && isScore(value.health_score) && Number.isInteger(value.health_score)
    && typeof value.status === 'string' && typeof value.color === 'string' && /^#[0-9a-f]{6}$/i.test(value.color)
    && isRecord(value.indices) && isScore(value.indices.balance) && isScore(value.indices.budget)
    && isScore(value.indices.goals) && isScore(value.indices.regularity)
    && Array.isArray(value.alerts) && value.alerts.every(isAlert)
    && isRecord(value.unavailable) && Object.values(value.unavailable).every((reason) => typeof reason === 'string');
}

export function parseDiagnosis(data: unknown): DiagnosisResponse {
  if (!isRecord(data) || !isDiagnosis(data.diagnostics)) throw new ApiContractError();
  const { period, summary } = parseDashboard(data);
  return { period, summary, diagnostics: data.diagnostics };
}

export function parseExpenseTrend(data: unknown, period: DashboardResponse['period'], groupBy: ExpenseGrouping): ExpensePoint[] {
  if (!Array.isArray(data)) throw new ApiContractError();

  const bucket = new Date(period.from + 'T00:00:00Z');
  const step = groupBy === 'week' ? 7 : 1;
  // Сервер помечает недельный интервал понедельником, включая первую неполную неделю.
  if (groupBy === 'week') bucket.setUTCDate(bucket.getUTCDate() - (bucket.getUTCDay() + 6) % 7);

  const count = Math.floor((Date.parse(period.to) - bucket.getTime()) / (step * 86_400_000)) + 1;
  if (count < 1 || data.length !== count) throw new ApiContractError();

  return data.map((point: unknown) => {
    const date = bucket.toISOString().slice(0, 10);
    if (!isRecord(point) || point.date !== date || !isFiniteNumber(point.amount) || point.amount < 0) throw new ApiContractError();
    bucket.setUTCDate(bucket.getUTCDate() + step);
    return { date, amount: point.amount };
  });
}
