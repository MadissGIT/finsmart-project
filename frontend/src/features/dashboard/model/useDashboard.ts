import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getDashboard } from '@/entities/analytics/api';
import type { DashboardResponse } from '@/entities/analytics/model/types';
import { useAuth } from '@/features/auth/model/context';
import { getRequestErrorMessage } from '@/shared/api/client';
import { readPeriod } from './period';

type Result = { key: string; data: DashboardResponse; error?: never } | { key: string; data?: never; error: string };

export function useDashboard() {
  const auth = useAuth();
  const [search, setSearch] = useSearchParams();
  const selection = readPeriod(search);
  const { from, to } = selection.range;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const userId = auth.user?.id;
  const enabled = auth.status === 'authenticated' && !selection.error;
  const key = [userId, from, to, attempt].join('|');

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    getDashboard({ from, to }, controller.signal).then((data) => {
      if (!controller.signal.aborted) setResult({ key, data });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setResult({ key, error: getRequestErrorMessage(error) });
    });
    return () => controller.abort();
  }, [enabled, key, from, to]);

  const current = enabled && result?.key === key ? result : null;
  const data = current?.data ?? null;
  const error = selection.error || (auth.status === 'error' ? auth.error : current?.error ?? null);
  const status = auth.status === 'anonymous' ? 'anonymous' : error ? 'error' : data ? 'ready' : 'loading';
  return { status, data, error, selection, search, setSearch, user: auth.user, canLoadAnalytics: enabled, revision: attempt,
    reload: () => { if (auth.status === 'error') auth.retryProfile(); else setAttempt((value) => value + 1); } };
}
