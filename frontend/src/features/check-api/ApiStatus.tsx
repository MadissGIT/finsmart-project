import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { checkReadiness } from '@/shared/api/health';
import { getApiErrorMessage } from '@/shared/api/client';
import { getCategories } from '@/entities/category/api';
import type { Category } from '@/entities/category/model/types';

type ConnectionState =
  | { status: 'idle' | 'loading' }
  | { status: 'success'; categories: Category[] }
  | { status: 'error'; message: string };

export function ApiStatus() {
  const [state, setState] = useState<ConnectionState>({ status: 'idle' });

  async function checkConnection() {
    setState({ status: 'loading' });
    try {
      const [, categories] = await Promise.all([checkReadiness(), getCategories()]);
      setState({ status: 'success', categories });
    } catch (error) {
      setState({ status: 'error', message: getApiErrorMessage(error) });
    }
  }

  const message = state.status === 'error' ? state.message :
    state.status === 'success' ? 'Соединение установлено. Сервис готов к работе.' :
    state.status === 'loading' ? 'Проверяем соединение…' : 'Подключение ещё не проверено.';

  return (
    <section className="panel" aria-labelledby="connection-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 id="connection-title" className="text-sm font-semibold">Подключение к сервису</h2><p role="status" className={'mt-1 text-sm ' + (state.status === 'success' ? 'text-brand-700' : state.status === 'error' ? 'text-red-700' : 'text-slate-500')}>{message}</p></div>
        <button type="button" className="button-secondary shrink-0" disabled={state.status === 'loading'} onClick={checkConnection}>
          <RefreshCw size={16} aria-hidden="true" className={state.status === 'loading' ? 'motion-safe:animate-spin' : ''} />
          {state.status === 'loading' ? 'Проверяем…' : 'Проверить подключение'}
        </button>
      </div>
      {state.status === 'success' ? <details className="mt-4 text-sm text-slate-500"><summary className="cursor-pointer">Категории сервиса: {state.categories.length}</summary><ul className="mt-3 list-inside list-disc space-y-1">{state.categories.map((category) => <li key={category.id}>{category.name}</li>)}</ul></details> : null}
    </section>
  );
}
