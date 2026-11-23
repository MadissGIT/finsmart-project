import type { Category } from '@/entities/category/model/types';
import type { CreateTransactionRequest, OperationType, Transaction } from '@/entities/transaction/model/types';
import type { TransactionFilters } from '@/entities/transaction/transactions-api';
import { dateTimeInput, dateTimeToTimestamp, financialToday, financialTimezone, isCalendarDate } from '@/shared/lib/calendar';
import { isUuid } from '@/shared/lib/guards';

export function readTransactionFilters(search: URLSearchParams) {
  const rawPage = search.get('page') ?? '1';
  const filters: TransactionFilters = { q: (search.get('q') ?? '').trim(), category_id: search.get('category_id') ?? '', operation_type: search.get('operation_type') ?? '', from_date: search.get('from_date') ?? '', to_date: search.get('to_date') ?? '', page: Number(rawPage) };
  const id = search.get('transaction') ?? '';
  let error: string | null = null;
  if (!/^\d+$/.test(rawPage) || !Number.isSafeInteger(filters.page * 20) || filters.page < 1) error = 'Некорректный номер страницы.';
  if (filters.q.length > 255) error = 'Поисковый запрос должен быть не длиннее 255 символов.';
  if (filters.category_id && (!/^\d+$/.test(filters.category_id) || Number(filters.category_id) < 1 || Number(filters.category_id) > 2147483647)) error = 'Некорректная категория.';
  if (filters.operation_type && !['DEBIT', 'CREDIT'].includes(filters.operation_type)) error = 'Некорректный тип операции.';
  if ((filters.from_date && !isCalendarDate(filters.from_date)) || (filters.to_date && !isCalendarDate(filters.to_date))) error = 'Укажите корректные даты.';
  if (filters.from_date && filters.to_date && filters.to_date < filters.from_date) error = 'Дата окончания не может быть раньше даты начала.';
  if (id && !isUuid(id)) error = 'Некорректный адрес операции.';
  return { filters, id, error };
}

export function eligibleCategories(categories: Category[], type: OperationType) {
  return categories.filter((category) => type === 'CREDIT' ? ['INCOME', 'SAVINGS'].includes(category.budget_group) : category.budget_group !== 'INCOME');
}

export interface TransactionDraft { amount: string; operation_type: OperationType; category_id: string; transaction_date: string; merchant_name: string; comment: string }
export type DraftErrors = Partial<Record<keyof TransactionDraft, string>>;

export function transactionDraft(transaction?: Transaction): TransactionDraft {
  return { amount: transaction ? String(transaction.amount).replace('.', ',') : '', operation_type: transaction?.operation_type ?? 'DEBIT', category_id: transaction ? String(transaction.category_id) : '', transaction_date: dateTimeInput(transaction?.transaction_date), merchant_name: transaction?.merchant_name ?? '', comment: transaction?.comment ?? '' };
}

export function validateTransactionDraft(draft: TransactionDraft, categories: Category[], original?: Transaction): { errors: DraftErrors; fields: CreateTransactionRequest | null } {
  const errors: DraftErrors = {};
  const amount = draft.amount.trim().replace(',', '.');
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) errors.amount = 'Введите положительную сумму, до двух знаков после запятой.';
  if (!eligibleCategories(categories, draft.operation_type).some((category) => String(category.id) === draft.category_id)) errors.category_id = 'Выберите категорию для этого типа операции.';
  const timestamp = original && draft.transaction_date === dateTimeInput(original.transaction_date) ? original.transaction_date : dateTimeToTimestamp(draft.transaction_date);
  if (!timestamp) errors.transaction_date = 'Укажите корректные дату и время.';
  if (!draft.merchant_name.trim() || draft.merchant_name.trim().length > 255) errors.merchant_name = 'Укажите организацию или описание, не длиннее 255 символов.';
  if (draft.comment.length > 2000) errors.comment = 'Комментарий должен быть не длиннее 2000 символов.';
  return { errors, fields: Object.keys(errors).length ? null : { amount: Number(amount), operation_type: draft.operation_type, category_id: Number(draft.category_id), transaction_date: timestamp!, merchant_name: draft.merchant_name.trim(), comment: draft.comment.trim() || null } };
}

export function transactionDay(value: string) { return financialToday(new Date(value)); }
export function transactionTime(value: string) { return new Intl.DateTimeFormat('ru-RU', { timeZone: financialTimezone, hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }

export function dayLabel(day: string, today = financialToday()): string {
  if (day === today) return 'Сегодня';
  const yesterday = new Date(today + 'T00:00:00Z'); yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (day === yesterday.toISOString().slice(0, 10)) return 'Вчера';
  return new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC', day: 'numeric', month: 'long', ...(day.slice(0, 4) !== today.slice(0, 4) ? { year: 'numeric' } : {}) }).format(new Date(day + 'T00:00:00Z'));
}

export function groupTransactions(items: Transaction[]) {
  const groups = new Map<string, { day: string; items: Transaction[]; cents: number }>();
  items.forEach((item) => {
    const day = transactionDay(item.transaction_date);
    const group = groups.get(day) ?? { day, items: [], cents: 0 };
    group.items.push(item); group.cents += Math.round(item.amount * 100) * (item.operation_type === 'DEBIT' ? -1 : 1);
    groups.set(day, group);
  });
  return [...groups.values()];
}
