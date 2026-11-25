import { api } from '@/shared/api/client';
import { ApiContractError, isRecord } from '@/shared/lib/guards';

export interface Achievement {
  code: string;
  title: string;
  level: string;
  icon: string;
  points: number;
  condition: string;
  earned_at: string | null;
  unlocked: boolean;
}

function isAchievement(value: unknown): value is Achievement {
  return isRecord(value) && typeof value.code === 'string' && typeof value.title === 'string'
    && typeof value.level === 'string' && typeof value.icon === 'string'
    && Number.isSafeInteger(value.points) && Number(value.points) >= 0
    && typeof value.condition === 'string' && typeof value.unlocked === 'boolean'
    && (value.earned_at === null || (typeof value.earned_at === 'string' && Number.isFinite(Date.parse(value.earned_at))));
}

export async function getAchievements(signal?: AbortSignal): Promise<{ items: Achievement[]; reward_points: number }> {
  const { data } = await api.get<unknown>('/achievements', { signal });
  if (!isRecord(data) || !Array.isArray(data.items) || !data.items.every(isAchievement)
    || typeof data.reward_points !== 'number' || !Number.isSafeInteger(data.reward_points) || data.reward_points < 0) {
    throw new ApiContractError();
  }
  return { items: data.items, reward_points: data.reward_points };
}
