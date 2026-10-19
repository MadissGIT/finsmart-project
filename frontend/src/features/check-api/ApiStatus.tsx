import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { checkReadiness } from '@/shared/api/health';
import { getApiErrorMessage } from '@/shared/api/client';

type ConnectionState =
  | { status: 'idle' | 'loading' | 'success' }
  | { status: 'error'; message: string };

export function ApiStatus() {
  const [state, setState] = useState<ConnectionState>({ status: 'idle' });

  async function checkConnection() {
    setState({ status: 'loading' });
    try {
      await checkReadiness();
      setState({ status: 'success' });
    } catch (error) {
      setState({ status: 'error', message: getApiErrorMessage(error) });
    }
  }

  const message = state.status === 'error' ? state.message : {
    idle: 'Подключение ещё не проверено.',
    loading: 'Проверяем соединение…',
    success: 'Соединение установлено. Сервис готов к работе.',
  }[state.status];

  return (
    <section className="panel flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" aria-labelledby="connection-title">
      <div>
        <h2 id="connection-title" className="text-sm font-semibold">Подключение к сервису</h2>
        <p role="status" className={`mt-1 text-sm ${state.status === 'success' ? 'text-brand-700' : state.status === 'error' ? 'text-red-700' : 'text-stone-500'}`}>{message}</p>
      </div>
      <button type="button" className="button-secondary shrink-0" disabled={state.status === 'loading'} onClick={checkConnection}>
        <RefreshCw size={16} aria-hidden="true" className={state.status === 'loading' ? 'motion-safe:animate-spin' : ''} />
        {state.status === 'loading' ? 'Проверяем…' : 'Проверить подключение'}
      </button>
    </section>
  );
}
