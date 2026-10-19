import { api } from '@/shared/api/client';
import type { DashboardResponse } from './model/types';

// Будущий endpoint: в backend первой недели аналитика пока не реализована.
export async function getDashboard(signal?: AbortSignal): Promise<DashboardResponse> {
  const { data } = await api.get<DashboardResponse>('/analytics/dashboard', {
    params: { period: 'current_month' }, signal,
  });
  return data;
}
