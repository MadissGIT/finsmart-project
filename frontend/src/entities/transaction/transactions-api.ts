import { api } from '@/shared/api/client';
import { ApiContractError, isFiniteNumber, isRecord, isUuid } from '@/shared/lib/guards';
import type { CreateTransactionRequest, Transaction, UpdateCategoryRequest } from './model/types';

export interface TransactionFilters {
  q: string;
  category_id: string;
  operation_type: string;
  from_date: string;
  to_date: string;
  page: number;
}

export const TRANSACTIONS_PAGE_SIZE = 20;

export function parseTransaction(data: unknown): Transaction {
  if (!isRecord(data) || !isUuid(data.id) || !isFiniteNumber(data.amount) || data.amount <= 0
    || !['DEBIT', 'CREDIT'].includes(String(data.operation_type)) || !Number.isInteger(data.category_id) || Number(data.category_id) < 1
    || typeof data.category_name !== 'string' || !data.category_name.trim()
    || typeof data.transaction_date !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(data.transaction_date) || !Number.isFinite(Date.parse(data.transaction_date))
    || typeof data.merchant_name !== 'string' || !data.merchant_name.trim()
    || !(data.comment === null || typeof data.comment === 'string') || !(data.mcc_code === null || typeof data.mcc_code === 'string')
    || !['TBANK', 'SBER', 'VTB', 'MANUAL'].includes(String(data.bank_source))
    || typeof data.requires_review !== 'boolean' || !isFiniteNumber(data.confidence) || data.confidence < 0 || data.confidence > 1) throw new ApiContractError();
  return data as unknown as Transaction;
}

export async function listTransactions(filters: TransactionFilters, signal?: AbortSignal) {
  const { page, ...fields } = filters;
  const params: Record<string, string | number> = { limit: TRANSACTIONS_PAGE_SIZE + 1, offset: (page - 1) * TRANSACTIONS_PAGE_SIZE };
  Object.entries(fields).forEach(([key, value]) => { if (value) params[key] = value; });
  const { data } = await api.get<unknown>('/transactions', { params, signal });
  if (!Array.isArray(data)) throw new ApiContractError();
  const items = data.map(parseTransaction);
  return { items: items.slice(0, TRANSACTIONS_PAGE_SIZE), hasNext: items.length > TRANSACTIONS_PAGE_SIZE };
}

export async function getTransaction(id: string, signal?: AbortSignal) {
  const { data } = await api.get<unknown>('/transactions/' + id, { signal });
  const transaction = parseTransaction(data);
  if (transaction.id !== id) throw new ApiContractError();
  return transaction;
}

export async function saveTransaction(fields: CreateTransactionRequest, id?: string) {
  const { data } = id ? await api.patch<unknown>('/transactions/' + id, fields) : await api.post<unknown>('/transactions', fields);
  const transaction = parseTransaction(data);
  if (id && transaction.id !== id) throw new ApiContractError();
  return transaction;
}

export async function deleteTransaction(id: string) {
  await api.delete('/transactions/' + id);
}

export async function changeTransactionCategory(id: string, fields: UpdateCategoryRequest) {
  const { data } = await api.patch<unknown>('/transactions/' + id + '/category', fields);
  if (!isRecord(data) || data.status !== 'success') throw new ApiContractError();
}
