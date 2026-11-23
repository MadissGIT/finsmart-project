import { api } from '@/shared/api/client';
import { isCalendarDate } from '@/shared/lib/calendar';
import { ApiContractError, isFiniteNumber, isRecord, isUuid } from '@/shared/lib/guards';
import type { Contribution, CreateGoalRequest, Goal, GoalDepositRequest, GoalDepositResponse } from './model/types';

function isNonNegative(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isPercent(value: unknown): value is number {
  return isNonNegative(value) && value <= 100;
}

function parseGoal(value: unknown): Goal {
  if (!isRecord(value)
    || !isUuid(value.id)
    || typeof value.title !== 'string' || !value.title.trim()
    || !isFiniteNumber(value.target_amount) || value.target_amount <= 0
    || !isNonNegative(value.current_amount)
    || typeof value.deadline !== 'string' || !isCalendarDate(value.deadline)
    || typeof value.icon !== 'string'
    || !isNonNegative(value.monthly_payment_recommended)
    || !isNonNegative(value.weekly_payment_recommended)
    || !isPercent(value.progress_percent)
    || !isNonNegative(value.months_left)
    || typeof value.exceeds_half_income !== 'boolean'
    || !(value.warning === null || typeof value.warning === 'string')) {
    throw new ApiContractError();
  }
  return value as unknown as Goal;
}

function isContribution(value: unknown): value is Contribution {
  return isRecord(value)
    && isUuid(value.id)
    && isFiniteNumber(value.amount) && value.amount > 0
    && (value.source === 'free_money' || value.source === 'discount')
    && typeof value.created_at === 'string'
    && Number.isFinite(Date.parse(value.created_at));
}

export async function listGoals(signal: AbortSignal): Promise<Goal[]> {
  const { data } = await api.get<unknown>('/goals', { signal });
  if (!Array.isArray(data)) throw new ApiContractError();
  return data.map(parseGoal);
}

export async function getGoal(id: string, signal: AbortSignal) {
  const { data } = await api.get<unknown>('/goals/' + id, { signal });
  const goal = parseGoal(data);
  if (goal.id !== id) throw new ApiContractError();
  return goal;
}

export async function createGoal(fields: CreateGoalRequest) {
  const { data } = await api.post<unknown>('/goals', fields);
  return parseGoal(data);
}

export async function updateGoal(id: string, fields: Partial<CreateGoalRequest>) {
  const { data } = await api.patch<unknown>('/goals/' + id, fields);
  const goal = parseGoal(data);
  if (goal.id !== id) throw new ApiContractError();
  return goal;
}

export async function depositGoal(id: string, fields: GoalDepositRequest): Promise<GoalDepositResponse> {
  const { data } = await api.post<unknown>('/goals/' + id + '/deposit', fields);
  if (!isRecord(data) || data.goal_id !== id
    || !isNonNegative(data.current_amount) || !isPercent(data.progress_percent)
    || !isNonNegative(data.acceleration_days) || !Number.isInteger(data.acceleration_days)
    || typeof data.message !== 'string') throw new ApiContractError();
  return {
    goal_id: id,
    current_amount: data.current_amount,
    progress_percent: data.progress_percent,
    acceleration_days: data.acceleration_days,
    message: data.message,
  };
}

export async function deleteGoal(id: string) {
  await api.delete('/goals/' + id);
}

const historySize = 20;

export async function listContributions(id: string, page: number, signal: AbortSignal) {
  const { data } = await api.get<unknown>('/goals/' + id + '/contributions', {
    params: { limit: historySize + 1, offset: page * historySize },
    signal,
  });
  if (!Array.isArray(data) || !data.every(isContribution)) throw new ApiContractError();
  return { items: data.slice(0, historySize), hasNext: data.length > historySize };
}
