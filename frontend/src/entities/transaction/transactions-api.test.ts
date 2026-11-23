import { afterEach, expect, it } from 'vitest';
import { api } from '@/shared/api/client';
import { changeTransactionCategory, getTransaction, listTransactions, parseTransaction, saveTransaction } from './transactions-api';

const originalAdapter = api.defaults.adapter;
afterEach(() => { api.defaults.adapter = originalAdapter; });
const item = { id: 'dc028083-bc14-459d-b42b-123456789abc', amount: 250, operation_type: 'DEBIT', category_id: 1, category_name: 'Супермаркеты', transaction_date: '2026-11-23T12:00:00Z', merchant_name: 'магазин', comment: null, mcc_code: null, bank_source: 'MANUAL', requires_review: false, confidence: 1 };

it('передаёт поиск, даты и фильтры серверу и запрашивает следующую запись для пагинации', async () => {
  api.defaults.adapter = async (config) => {
    expect(config.params).toEqual({ limit: 21, offset: 20, q: 'магазин', category_id: '1', operation_type: 'DEBIT', from_date: '2026-11-01', to_date: '2026-11-30' });
    return { data: Array.from({ length: 21 }, () => item), status: 200, statusText: 'OK', headers: {}, config };
  };
  const result = await listTransactions({ q: 'магазин', category_id: '1', operation_type: 'DEBIT', from_date: '2026-11-01', to_date: '2026-11-30', page: 2 });
  expect(result.items).toHaveLength(20);
  expect(result.hasNext).toBe(true);
});

it.each([{ ...item, amount: -1 }, { ...item, amount: '250' }, { ...item, transaction_date: '2026-11-23' }, { ...item, confidence: 2 }, '<html>fallback</html>'])('не принимает испорченный ответ операции', (value) => {
  expect(() => parseTransaction(value)).toThrow('неожиданном формате');
});

it('не принимает карточку другого id', async () => {
  api.defaults.adapter = async (config) => ({ data: item, status: 200, statusText: 'OK', headers: {}, config });
  await expect(getTransaction('dc028083-bc14-459d-b42b-000000000001')).rejects.toThrow('неожиданном формате');
});

it('передаёт очищение комментария и сохраняет положительную сумму', async () => {
  const fields = { amount: 250, operation_type: 'DEBIT' as const, category_id: 1, transaction_date: item.transaction_date, merchant_name: 'магазин', comment: null };
  api.defaults.adapter = async (config) => {
    expect(config.method).toBe('patch'); expect(JSON.parse(config.data)).toEqual(fields);
    return { data: item, status: 200, statusText: 'OK', headers: {}, config };
  };
  await expect(saveTransaction(fields, item.id)).resolves.toEqual(item);
});

it('сохраняет правило только явным запросом отдельного endpoint', async () => {
  api.defaults.adapter = async (config) => {
    expect(config.url).toBe('/transactions/' + item.id + '/category');
    expect(JSON.parse(config.data)).toEqual({ category_id: 4, save_as_global_rule: true });
    return { data: { status: 'success' }, status: 200, statusText: 'OK', headers: {}, config };
  };
  await expect(changeTransactionCategory(item.id, { category_id: 4, save_as_global_rule: true })).resolves.toBeUndefined();
});
