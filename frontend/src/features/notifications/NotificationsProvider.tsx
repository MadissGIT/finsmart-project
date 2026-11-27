import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { syncGameProgress } from '@/entities/gamification/api';
import { listGoals } from '@/entities/goal/api';
import { getLimitUsage } from '@/entities/limit/api';
import { useAuth } from '@/features/auth/model/context';
import { financialDataChanges } from '@/shared/api/client';
import { useApiQuery } from '@/shared/api/useApiQuery';
import { financialToday } from '@/shared/lib/calendar';
import { NotificationsContext } from './model/context';
import {
  createGameNotifications, createGoalNotifications, createLimitNotifications, createWelcomeNotification, loadNotificationStatuses, saveNotificationStatuses,
} from './model/notifications';
import type { LimitSnapshot, NotificationStatus, NotificationStatuses } from './model/notifications';

async function loadLimitSnapshot(signal: AbortSignal): Promise<LimitSnapshot> {
  const month = financialToday().slice(0, 7);
  return { month, items: await getLimitUsage(signal) };
}

export function NotificationsProvider({ children }: PropsWithChildren) {
  const userId = useAuth().user?.id;
  const signedIn = Boolean(userId);
  const storageKey = userId ? 'finsmart.notifications.v1:' + userId : '';
  const [stored, setStored] = useState<{ key: string; statuses: NotificationStatuses }>();
  const statuses = useMemo(() => {
    if (stored?.key === storageKey) return stored.statuses;
    return storageKey ? loadNotificationStatuses(storageKey) ?? {} : {};
  }, [stored, storageKey]);

  const loadLimits = useCallback((signal: AbortSignal) =>
    userId ? loadLimitSnapshot(signal) : Promise.resolve({ month: '', items: [] }), [userId]);
  const loadGoals = useCallback((signal: AbortSignal) => userId ? listGoals(signal) : Promise.resolve([]), [userId]);
  const loadGame = useCallback((signal: AbortSignal) => {
    if (!userId) throw new Error('Нет активной сессии');
    return syncGameProgress(signal);
  }, [userId]);
  const game = useApiQuery(loadGame, signedIn, true);
  const limits = useApiQuery(loadLimits, signedIn, true);
  const goals = useApiQuery(loadGoals, signedIn, true);

  const retryLimits = limits.retry;
  const retryGoals = goals.retry;
  const retryGame = game.retry;

  const refresh = useCallback(() => {
    if (!signedIn) return;
    retryLimits();
    retryGoals();
    retryGame();
  }, [signedIn, retryLimits, retryGoals, retryGame]);

  useEffect(() => {
    if (!signedIn) return;
    financialDataChanges.addEventListener('change', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      financialDataChanges.removeEventListener('change', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [signedIn, refresh]);

  useEffect(() => {
    if (!storageKey) return;
    function sync(event: StorageEvent) {
      if (event.key === storageKey || event.key === null) {
        setStored({ key: storageKey, statuses: loadNotificationStatuses(storageKey) ?? {} });
      }
    }
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [storageKey]);

  const welcome = createWelcomeNotification(game.data?.welcome_stage ?? null);
  const alerts = [
    ...(welcome ? [welcome] : []),
    ...(limits.data ? createLimitNotifications(limits.data) : []),
    ...(goals.data ? createGoalNotifications(goals.data, financialToday()) : []),
    ...(game.data ? createGameNotifications(game.data) : []),
  ].filter(({ id }) => statuses[id] !== 'dismissed');
  const unread = alerts.filter(({ id }) => !statuses[id]);

  function update(ids: string[], status: NotificationStatus) {
    if (!storageKey || !ids.length) return;
    const next = { ...statuses, ...loadNotificationStatuses(storageKey) };
    for (const id of ids) {
      if (next[id] !== 'dismissed') next[id] = status;
    }
    setStored({ key: storageKey, statuses: next });
    saveNotificationStatuses(storageKey, next);
  }

  return (
    <NotificationsContext.Provider value={{
      signedIn, limits, goals, game, alerts, statuses, unreadCount: unread.length, refresh,
      markRead: (id) => update([id], 'read'),
      markAllRead: () => update(unread.map(({ id }) => id), 'read'),
      dismiss: (id) => update([id], 'dismissed'),
    }}>
      {children}
    </NotificationsContext.Provider>
  );
}
