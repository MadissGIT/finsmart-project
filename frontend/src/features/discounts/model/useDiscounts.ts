import { useCallback, useEffect, useState } from 'react';
import { getDiscounts, getRecommendedDiscounts } from '@/entities/discount/api';
import { getRequestErrorMessage } from '@/shared/api/client';

type QueryResult<T> = { data: T; error?: never } | { data?: never; error: string };

function useDiscountRequest<T>(load: (signal: AbortSignal) => Promise<T>, key: string | null) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; result: QueryResult<T> }>();
  const requestKey = key === null ? null : key + ':' + attempt;

  useEffect(() => {
    if (requestKey === null) return;
    const controller = new AbortController();
    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setResult({ key: requestKey, result: { data } });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setResult({ key: requestKey, result: { error: getRequestErrorMessage(error) } });
        }
      },
    );
    return () => controller.abort();
  }, [load, requestKey]);

  const current = result?.key === requestKey ? result.result : undefined;
  return {
    data: current?.data,
    error: current?.error,
    loading: requestKey !== null && !current,
    retry: () => setAttempt((value) => value + 1),
  };
}

export function useDiscountCatalog(categoryId?: number, enabled = true) {
  const load = useCallback((signal: AbortSignal) => getDiscounts(categoryId, signal), [categoryId]);
  return useDiscountRequest(load, enabled ? String(categoryId ?? 'all') : null);
}

export function useRecommendedDiscounts(account: string | null) {
  return useDiscountRequest(getRecommendedDiscounts, account);
}
