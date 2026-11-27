import { api } from '@/shared/api/client';
import { ApiContractError, isFiniteNumber, isRecord } from '@/shared/lib/guards';

export interface LimitUsage {
  category_id: number;
  category_name: string;
  amount: number;
  spent: number;
  percent: number;
  status: 'ok' | 'approaching' | 'reached';
}

function isLimit(value: unknown): value is LimitUsage {
  return isRecord(value) && typeof value.category_id === 'number' && Number.isSafeInteger(value.category_id)
    && value.category_id > 0 && typeof value.category_name === 'string' && value.category_name.trim().length > 0
    && isFiniteNumber(value.amount) && value.amount > 0 && isFiniteNumber(value.spent) && value.spent >= 0
    && isFiniteNumber(value.percent) && value.percent >= 0
    && (value.status === 'ok' || value.status === 'approaching' || value.status === 'reached');
}

export async function getLimitUsage(signal: AbortSignal): Promise<LimitUsage[]> {
  const { data } = await api.get<unknown>('/limits', { signal });
  if (!Array.isArray(data) || !data.every(isLimit)) throw new ApiContractError();
  return data;
}

export async function saveCategoryLimit(categoryId: string, amount: string) {
  await api.put('/limits/' + categoryId, { amount });
}

export async function removeCategoryLimit(categoryId: number) {
  await api.delete('/limits/' + categoryId);
}
