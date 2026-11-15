import { api } from '@/shared/api/client';
import type { DashboardResponse } from './model/types';
import { parseDashboard } from './model/parse';
import { ApiContractError } from '@/shared/lib/guards';

export async function getDashboard(period: { from: string; to: string }, signal?: AbortSignal): Promise<DashboardResponse> {
  const { data } = await api.get<unknown>('/analytics/budget', {
    params: { from_date: period.from, to_date: period.to }, signal,
  });
  const dashboard = parseDashboard(data);
  if (dashboard.period.from !== period.from || dashboard.period.to !== period.to) throw new ApiContractError();
  return dashboard;
}
