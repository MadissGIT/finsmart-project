import { expect, it } from 'vitest';
import type { Category } from '@/entities/category/model/types';
import type { Transaction } from '@/entities/transaction/model/types';
import { dayLabel, groupTransactions, readTransactionFilters, transactionDraft, validateTransactionDraft } from './transactions';

const categories: Category[] = [{ id: 1, name: 'Супермаркеты', budget_group: 'NEEDS' }, { id: 10, name: 'Доходы', budget_group: 'INCOME' }];
const transaction: Transaction = { id: 'dc028083-bc14-459d-b42b-123456789abc', amount: 123.45, operation_type: 'DEBIT', category_id: 1, category_name: 'Супермаркеты', transaction_date: '2026-11-22T21:30:45.123Z', merchant_name: 'магазин', comment: 'Комментарий', mcc_code: null, bank_source: 'MANUAL', requires_review: false, confidence: 1 };

it('сохраняет точное время и очищает комментарий при редактировании', () => {
  const draft = { ...transactionDraft(transaction), comment: '' };
  const result = validateTransactionDraft(draft, categories, transaction);
  expect(result.errors).toEqual({});
  expect(result.fields).toMatchObject({ amount: 123.45, comment: null, transaction_date: transaction.transaction_date });
});

it.each(['0', '-100', '1,001', 'NaN', '1000000000000', ''])('отклоняет сумму %s до запроса', (amount) => {
  expect(validateTransactionDraft({ ...transactionDraft(transaction), amount }, categories).errors.amount).toBeDefined();
});

it('проверяет категорию, контрагента и длину комментария', () => {
  const draft = { ...transactionDraft(transaction), category_id: '10', merchant_name: ' ', comment: 'а'.repeat(2001) };
  expect(Object.keys(validateTransactionDraft(draft, categories).errors).sort()).toEqual(['category_id', 'comment', 'merchant_name']);
});

it('допускает запятую, копейки и верхнюю границу серверного Decimal', () => {
  const result = validateTransactionDraft({ ...transactionDraft(transaction), amount: '999999999999,99' }, categories);
  expect(result.errors).toEqual({});
  expect(result.fields?.amount).toBe(999999999999.99);
});

it.each(['page=0', 'page=abc', 'page=9007199254740991', 'category_id=-1', 'operation_type=OTHER', 'from_date=2026-02-30', 'from_date=2026-11-23&to_date=2026-11-22', 'transaction=123'])('не запрашивает недопустимые параметры URL %s', (value) => {
  expect(readTransactionFilters(new URLSearchParams(value)).error).not.toBeNull();
});

it('восстанавливает серверные фильтры и страницу из URL', () => {
  const result = readTransactionFilters(new URLSearchParams('q=+магазин+&category_id=1&operation_type=DEBIT&from_date=2026-11-01&to_date=2026-11-30&page=2'));
  expect(result.error).toBeNull();
  expect(result.filters).toEqual({ q: 'магазин', category_id: '1', operation_type: 'DEBIT', from_date: '2026-11-01', to_date: '2026-11-30', page: 2 });
});

it('группирует по финансовой дате, а суммы складывает в копейках', () => {
  const rows = [{ ...transaction, amount: 0.1 }, { ...transaction, id: 'other', amount: 0.2 }, { ...transaction, id: 'income', amount: 1, operation_type: 'CREDIT' as const }];
  const groups = groupTransactions(rows);
  expect(groups).toHaveLength(1);
  expect(groups[0].day).toBe('2026-11-23');
  expect(groups[0].cents).toBe(70);
  expect(dayLabel('2026-12-31', '2027-01-01')).toBe('Вчера');
  expect(dayLabel('2025-11-23', '2026-11-23')).toContain('2025');
});
