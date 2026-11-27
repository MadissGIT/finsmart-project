import { createContext, useContext } from 'react';
import type { GameProgress } from '@/entities/gamification/api';
import type { Goal } from '@/entities/goal/model/types';
import type { useApiQuery } from '@/shared/api/useApiQuery';
import type { FinancialNotification, LimitSnapshot, NotificationStatuses } from './notifications';

interface NotificationsContextValue {
  signedIn: boolean;
  limits: ReturnType<typeof useApiQuery<LimitSnapshot>>;
  goals: ReturnType<typeof useApiQuery<Goal[]>>;
  game: ReturnType<typeof useApiQuery<GameProgress>>;
  alerts: FinancialNotification[];
  statuses: NotificationStatuses;
  unreadCount: number;
  refresh: () => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
}

export const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function useNotifications() {
  const notifications = useContext(NotificationsContext);
  if (!notifications) throw new Error('NotificationsProvider is missing');
  return notifications;
}
