import type { CreateGoalRequest, DepositSource, Goal } from '@/entities/goal/model/types';
import { financialToday, isCalendarDate } from '@/shared/lib/calendar';

export type GoalStatus = 'active' | 'completed' | 'expired';

export const goalIcons = [
  { value: 'plane', label: 'Поездки' },
  { value: 'laptop', label: 'Техника' },
  { value: 'car', label: 'Авто' },
  { value: 'home', label: 'Дом' },
  { value: 'target', label: 'Другое' },
];

export const goalStatusLabels: Record<GoalStatus, string> = {
  active: 'В процессе',
  completed: 'Цель достигнута',
  expired: 'Срок истёк',
};

export const contributionSources: Record<DepositSource, string> = {
  free_money: 'Свободные деньги',
  discount: 'Экономия на скидках',
};

type GoalFields = Pick<Goal, 'target_amount' | 'current_amount' | 'deadline'>;

export function remainingAmount(goal: GoalFields) {
  return Math.max(0, Math.round(goal.target_amount * 100) - Math.round(goal.current_amount * 100)) / 100;
}

export function goalStatus(goal: GoalFields, today = financialToday()): GoalStatus {
  if (remainingAmount(goal) === 0) return 'completed';
  return goal.deadline < today ? 'expired' : 'active';
}

export function nearestGoal(goals: Goal[], today = financialToday()): Goal | undefined {
  return goals
    .filter((goal) => goalStatus(goal, today) === 'active')
    .sort((left, right) => left.deadline.localeCompare(right.deadline))[0];
}

export function readMoney(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return amount > 0 ? amount : null;
}

export function formatPercent(value: number): string {
  return value.toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + '%';
}

const deadlineFormatter = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeZone: 'UTC' });

export function formatDeadline(value: string) {
  return deadlineFormatter.format(new Date(value + 'T00:00:00Z'));
}

export interface GoalDraft {
  title: string;
  amount: string;
  deadline: string;
  icon: string;
}

export type GoalErrors = Partial<Record<keyof GoalDraft, string>>;

export function validateGoal(draft: GoalDraft, original?: Goal, today = financialToday()) {
  const errors: GoalErrors = {};
  const title = draft.title.trim();
  const amount = readMoney(draft.amount);
  if (!title || title.length > 200) errors.title = 'Введите название до 200 символов.';
  if (amount === null) errors.amount = 'Введите положительную сумму, до двух знаков после запятой.';
  else if (original && Math.round(amount * 100) < Math.round(original.current_amount * 100)) {
    errors.amount = 'Цель не может быть меньше уже накопленной суммы.';
  }
  if (!isCalendarDate(draft.deadline)) errors.deadline = 'Укажите дату достижения цели.';
  else if (draft.deadline !== original?.deadline && draft.deadline < today) errors.deadline = 'Выберите сегодня или дату в будущем.';

  if (amount === null || Object.keys(errors).length > 0) return { errors, fields: null };
  const fields: CreateGoalRequest = { title, target_amount: amount, deadline: draft.deadline, icon: draft.icon };
  return { errors, fields };
}

export function changedGoalFields(original: Goal, fields: CreateGoalRequest): Partial<CreateGoalRequest> {
  return {
    ...(original.title !== fields.title ? { title: fields.title } : {}),
    ...(original.target_amount !== fields.target_amount ? { target_amount: fields.target_amount } : {}),
    ...(original.deadline !== fields.deadline ? { deadline: fields.deadline } : {}),
    ...(original.icon !== fields.icon ? { icon: fields.icon } : {}),
  };
}
