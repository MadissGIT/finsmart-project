import { api } from '@/shared/api/client';
import type { Category } from './model/types';

const groups = ['NEEDS', 'WANTS', 'SAVINGS', 'INCOME', 'OTHER'];

function isCategory(value: unknown): value is Category {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'number' && Number.isInteger(item.id) &&
    typeof item.name === 'string' && item.name.length > 0 &&
    typeof item.budget_group === 'string' && groups.includes(item.budget_group);
}

export async function getCategories(): Promise<Category[]> {
  const { data } = await api.get<unknown>('/categories');
  if (!Array.isArray(data) || !data.every(isCategory)) throw new Error('Unexpected categories response');
  return data;
}
