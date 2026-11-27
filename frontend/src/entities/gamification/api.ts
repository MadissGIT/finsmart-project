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
  progress: { current: number; target: number } | null;
}

export interface Challenge {
  code: string;
  title: string;
  description: string;
  days: number;
  target: number;
  unit: 'expenses' | 'days' | 'rubles';
  points: number;
  status: 'available' | 'active' | 'completed' | 'expired';
  current: number;
  deadline: string | null;
  completed_at: string | null;
}

export interface League {
  title: string;
  minimum: number;
  next_title: string | null;
  next_minimum: number | null;
}

export interface GameProgress {
  items: Achievement[];
  challenges: Challenge[];
  reward_points: number;
  league: League;
  welcome_stage: 'first_transaction' | 'completed' | null;
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isNullableTimestamp(value: unknown) {
  return value === null || (typeof value === 'string' && Number.isFinite(Date.parse(value)));
}

function isAchievement(value: unknown): value is Achievement {
  return isRecord(value) && typeof value.code === 'string' && typeof value.title === 'string'
    && typeof value.level === 'string' && typeof value.icon === 'string'
    && isCount(value.points) && typeof value.condition === 'string'
    && typeof value.unlocked === 'boolean' && isNullableTimestamp(value.earned_at)
    && (value.progress === null || (isRecord(value.progress)
      && isCount(value.progress.current) && isCount(value.progress.target) && value.progress.target > 0));
}

function isChallenge(value: unknown): value is Challenge {
  return isRecord(value) && typeof value.code === 'string' && typeof value.title === 'string'
    && typeof value.description === 'string' && isCount(value.days) && isCount(value.points)
    && isCount(value.target) && value.target > 0 && typeof value.current === 'number'
    && Number.isFinite(value.current) && value.current >= 0 && value.current <= value.target
    && (value.unit === 'expenses' || value.unit === 'days' || value.unit === 'rubles')
    && (value.status === 'available' || value.status === 'active'
      || value.status === 'completed' || value.status === 'expired')
    && isNullableTimestamp(value.deadline) && isNullableTimestamp(value.completed_at);
}

function isLeague(value: unknown): value is League {
  return isRecord(value) && typeof value.title === 'string' && isCount(value.minimum)
    && ((value.next_title === null && value.next_minimum === null)
      || (typeof value.next_title === 'string' && isCount(value.next_minimum) && value.next_minimum > value.minimum));
}

export async function syncGameProgress(signal: AbortSignal): Promise<GameProgress> {
  const { data } = await api.post<unknown>('/gamification/progress', undefined, { signal });
  if (!isRecord(data) || !Array.isArray(data.items) || !data.items.every(isAchievement)
    || !Array.isArray(data.challenges) || !data.challenges.every(isChallenge)
    || !isCount(data.reward_points) || !isLeague(data.league)) {
    throw new ApiContractError();
  }
  const stage = data.welcome_stage;
  return {
    items: data.items, challenges: data.challenges, reward_points: data.reward_points, league: data.league,
    welcome_stage: stage === 'first_transaction' || stage === 'completed' ? stage : null,
  };
}

export async function acceptChallenge(code: string) {
  await api.post('/gamification/challenges/' + encodeURIComponent(code));
}
