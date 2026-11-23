import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { getCategories } from '@/entities/category/api';
import type { Category } from '@/entities/category/model/types';
import { getTransaction, listTransactions } from '@/entities/transaction/transactions-api';
import type { Transaction } from '@/entities/transaction/model/types';
import { useAuth } from '@/features/auth/model/context';
import { getRequestErrorMessage } from '@/shared/api/client';
import { getAuthGeneration } from '@/shared/api/tokens';
import { readTransactionFilters } from './transactions';

interface Data { categories: Category[]; items: Transaction[]; hasNext: boolean; detail: Transaction | null }
type Result = { key: string; data: Data; error?: never } | { key: string; data?: never; error: string };

export function useTransactions() {
  const auth = useAuth();
  const [search, setSearch] = useSearchParams();
  const { filters, id, error: validationError } = readTransactionFilters(search);
  const { q, category_id, operation_type, from_date, to_date, page } = filters;
  const [debounced, setDebounced] = useState(q);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  useEffect(() => { const timer = setTimeout(() => setDebounced(q), 300); return () => clearTimeout(timer); }, [q]);
  const enabled = auth.status === 'authenticated' && !validationError && q === debounced;
  const key = JSON.stringify([auth.user?.id, getAuthGeneration(), q, category_id, operation_type, from_date, to_date, page, id, attempt]);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    Promise.all([getCategories(controller.signal), id ? getTransaction(id, controller.signal).then((detail) => ({ items: [], hasNext: false, detail })) : listTransactions({ q, category_id, operation_type, from_date, to_date, page }, controller.signal).then((list) => ({ ...list, detail: null }))])
      .then(([categories, list]) => { if (!controller.signal.aborted) setResult({ key, data: { categories, ...list } }); })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setResult({ key, error: id && axios.isAxiosError(error) && error.response?.status === 404 ? 'Операция не найдена или уже удалена.' : getRequestErrorMessage(error) });
      });
    return () => controller.abort();
  }, [enabled, key, q, category_id, operation_type, from_date, to_date, page, id]);
  const current = enabled && result?.key === key ? result : null;
  const data = current?.data ?? null;
  const error = validationError || (auth.status === 'error' ? auth.error : current?.error ?? null);
  const status = auth.status === 'anonymous' ? 'anonymous' : error ? 'error' : data ? 'ready' : 'loading';
  return { auth, status, data, categories: result?.data?.categories ?? [], error, filters, id, search, setSearch,
    reload: () => { if (auth.status === 'error') auth.retryProfile(); else setAttempt((value) => value + 1); },
  };
}
