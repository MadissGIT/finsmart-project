import type { GameProgress } from '@/entities/gamification/api';
import type { Goal } from '@/entities/goal/model/types';
import type { LimitUsage } from '@/entities/limit/api';
import { formatDeadline, goalStatus, remainingAmount } from '@/features/goals/model/goals';
import { formatMoney } from '@/shared/lib/format';
import { isRecord } from '@/shared/lib/guards';

export const categoryLimitsPath = '/analytics#category-limits';

export interface LimitSnapshot {
  month: string;
  items: LimitUsage[];
}

export interface FinancialNotification {
  id: string;
  tone: 'overrun' | 'limit' | 'goal' | 'welcome';
  title: string;
  message: string;
  action: string;
  to: string;
}

export type NotificationStatus = 'read' | 'dismissed';
export type NotificationStatuses = Record<string, NotificationStatus>;

export function createLimitNotifications(snapshot: LimitSnapshot): FinancialNotification[] {
  return snapshot.items
    .filter(({ status }) => status !== 'ok')
    .sort((left, right) => Number(right.status === 'reached') - Number(left.status === 'reached') || right.percent - left.percent)
    .map(({ category_id, category_name, amount, spent, status }) => {
      const difference = (Math.round(amount * 100) - Math.round(spent * 100)) / 100;
      const id = ['limit', snapshot.month, category_id, status].join(':');
      if (status === 'approaching') {
        return {
          id, tone: 'limit',
          title: 'Вы близки к лимиту по категории «' + category_name + '»',
          message: 'До лимита осталось ' + formatMoney(difference) + '.',
          action: 'Перейти к лимитам', to: categoryLimitsPath,
        };
      }
      return {
        id, tone: 'overrun',
        title: (difference < 0 ? 'Перерасход' : 'Лимит достигнут') + ' по категории «' + category_name + '»',
        message: difference < 0
          ? 'Лимит превышен на ' + formatMoney(-difference) + '.'
          : 'Израсходован весь лимит на этот месяц.',
        action: 'Перейти к лимитам', to: categoryLimitsPath,
      };
    });
}

export function createGoalNotifications(goals: Goal[], today: string): FinancialNotification[] {
  return goals.filter((goal) => goal.months_left <= 1 && goalStatus(goal, today) === 'active')
    .sort((left, right) => left.deadline.localeCompare(right.deadline))
    .map((goal) => ({
      id: 'goal:' + goal.id + ':' + goal.deadline,
      tone: 'goal',
      title: 'Приближается срок накопления',
      message: 'До ' + formatDeadline(goal.deadline) + ' осталось накопить '
        + formatMoney(remainingAmount(goal)) + ' на цель «' + goal.title + '».',
      action: 'Посмотреть цель',
      to: '/goals/' + goal.id,
    }));
}

export function loadNotificationStatuses(key: string): NotificationStatuses | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!isRecord(value)) return null;
    return Object.fromEntries(Object.entries(value).filter(
      ([, status]) => status === 'read' || status === 'dismissed',
    )) as NotificationStatuses;
  } catch {
    return null;
  }
}

export function saveNotificationStatuses(key: string, statuses: NotificationStatuses) {
  try { localStorage.setItem(key, JSON.stringify(statuses)); }
  catch { /* В открытом приложении статусы работают и без localStorage. */ }
}

export function createWelcomeNotification(stage: GameProgress['welcome_stage']): FinancialNotification | null {
  if (!stage) return null;
  return stage === 'completed' ? {
    id: 'welcome:first-operation-complete',
    tone: 'welcome',
    title: 'Первый шаг сделан!',
    message: 'Вы записали первую операцию. Теперь её видно в финансовом обзоре.',
    action: 'Посмотреть операции',
    to: '/transactions',
  } : {
    id: 'welcome:first-operation',
    tone: 'welcome',
    title: 'Добро пожаловать в ФинСмарт!',
    message: 'Давайте сделаем первый шаг. Запишите доход или расход.',
    action: 'Записать первую операцию',
    to: '/transactions?add=1',
  };
}

export function createGameNotifications({ challenges, items }: GameProgress): FinancialNotification[] {
  const alerts: FinancialNotification[] = [];
  for (const challenge of challenges) {
    const complete = challenge.status === 'completed';
    const near = challenge.status === 'active' && challenge.current > 0
      && (challenge.current / challenge.target >= 0.8
        || (challenge.unit !== 'rubles' && challenge.target - challenge.current === 1));
    if (!complete && !near) continue;
    const remaining = challenge.target - challenge.current;
    alerts.push({
      id: 'challenge:' + challenge.code + (complete ? ':completed' : ':near'),
      tone: 'goal',
      title: (complete ? 'Челлендж завершён' : 'Челлендж почти выполнен') + ' · «' + challenge.title + '»',
      message: complete
        ? 'Начислено баллов: ' + challenge.points + '.'
        : challenge.unit === 'rubles'
          ? 'Осталось пополнить копилки на ' + formatMoney(remaining) + '.'
          : 'Прогресс: ' + challenge.current + ' из ' + challenge.target + '.',
      action: 'Открыть челленджи',
      to: '/more/profile/challenges?status=' + (complete ? 'completed' : 'active'),
    });
  }
  for (const badge of items) {
    const progress = badge.progress;
    if (!progress || badge.unlocked || progress.current === 0
      || (progress.current / progress.target < 0.8 && progress.target - progress.current !== 1)) continue;
    alerts.push({
      id: 'achievement:' + badge.code + ':near',
      tone: 'goal',
      title: 'Скоро новый бейдж · «' + badge.title + '»',
      message: badge.condition + '. Прогресс: ' + progress.current + ' из ' + progress.target + '.',
      action: 'Открыть достижения',
      to: '/more/profile/achievements',
    });
  }
  return alerts;
}
