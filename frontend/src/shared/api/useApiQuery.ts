import { useCallback, useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { getRequestErrorMessage } from '@/shared/api/client';

type Result<T> = { data: T; error?: never; notFound?: never } | {
  data?: never;
  error: string;
  notFound: boolean;
};

export function useApiQuery<T>(load: (signal: AbortSignal) => Promise<T>, enabled = true, keepPreviousData = false) {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<{ load: typeof load; attempt: number; result: Result<T> }>();

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setSettled({ load, attempt, result: { data } });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        const notFound = isAxiosError(error) && error.response?.status === 404;
        setSettled({
          load, attempt,
          result: { error: getRequestErrorMessage(error), notFound },
        });
      },
    );
    return () => controller.abort();
  }, [load, attempt, enabled]);

  const result = enabled && settled?.load === load && settled.attempt === attempt ? settled.result : undefined;
  const previousData = keepPreviousData && !result && enabled && settled?.load === load
    ? settled.result.data : undefined;
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return {
    data: result?.data ?? previousData,
    error: result?.error,
    notFound: result?.notFound,
    loading: enabled && !result,
    retry,
  };
}
