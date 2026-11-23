import { api } from '@/shared/api/client';
import type { DashboardResponse, DiagnosisResponse, ExpenseGrouping, ExpensePoint } from './model/types';
import { parseDashboard, parseDiagnosis, parseExpenseTrend } from './model/parse';
import { ApiContractError } from '@/shared/lib/guards';

type Period = DashboardResponse['period'];

function checkPeriod(result: Period, requested: Period) {
  if (result.from !== requested.from || result.to !== requested.to) throw new ApiContractError();
}

export async function getDashboard(period: Period, signal?: AbortSignal): Promise<DashboardResponse> {
  const { data } = await api.get<unknown>('/analytics/budget', {
    params: { from_date: period.from, to_date: period.to }, signal,
  });
  const dashboard = parseDashboard(data);
  checkPeriod(dashboard.period, period);
  return dashboard;
}

export async function getDiagnosis(period: Period, signal?: AbortSignal): Promise<DiagnosisResponse> {
  const { data } = await api.get<unknown>('/analytics/dashboard', {
    params: { from_date: period.from, to_date: period.to }, signal,
  });
  const diagnosis = parseDiagnosis(data);
  checkPeriod(diagnosis.period, period);
  return diagnosis;
}

export async function getExpenseTrend(period: Period, groupBy: ExpenseGrouping, signal?: AbortSignal): Promise<ExpensePoint[]> {
  const { data } = await api.get<unknown>('/analytics/expenses/trend', {
    params: { from_date: period.from, to_date: period.to, group_by: groupBy }, signal,
  });
  return parseExpenseTrend(data, period, groupBy);
}
