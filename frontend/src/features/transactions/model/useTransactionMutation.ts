import { useEffect, useRef, useState } from 'react';
import { getRequestErrorMessage } from '@/shared/api/client';
import { getAuthGeneration } from '@/shared/api/tokens';

export function useTransactionMutation() {
  const alive = useRef(true);
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  async function run<T>(action: () => Promise<T>, onSuccess: (value: T) => void) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(null);
    const generation = getAuthGeneration();
    try {
      const result = await action();
      if (alive.current && generation === getAuthGeneration()) onSuccess(result);
    } catch (err) {
      if (alive.current && generation === getAuthGeneration()) setError(getRequestErrorMessage(err, 'Не удалось сохранить изменения. Попробуйте ещё раз.'));
    } finally {
      locked.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return { run, busy, error };
}
