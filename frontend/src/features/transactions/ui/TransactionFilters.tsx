import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Category } from '@/entities/category/model/types';
import type { TransactionFilters as Filters } from '@/entities/transaction/transactions-api';
import { readTransactionFilters } from '../model/transactions';
import { categoryColor } from '../model/presentation';
import { TransactionSheet } from './TransactionSheet';

export function TransactionFilters({ filters, categories, onClose, onApply }: { filters: Filters; categories: Category[]; onClose: () => void; onApply: (fields: Record<string, string>) => void }) {
  const [draft, setDraft] = useState({ operation_type: filters.operation_type, category_id: filters.category_id, from_date: filters.from_date, to_date: filters.to_date });
  const [error, setError] = useState<string | null>(null);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = readTransactionFilters(new URLSearchParams(draft));
    setError(result.error);
    if (!result.error) onApply(draft);
  }
  return <TransactionSheet title="Фильтры" variant="side" onClose={onClose}><form className="transaction-filters" onSubmit={submit} noValidate>
    <fieldset><legend>Тип операции</legend>{[['', 'Все'], ['DEBIT', 'Расходы'], ['CREDIT', 'Доходы']].map(([value, label]) => <label key={value}><input type="radio" name="filter-type" checked={draft.operation_type === value} onChange={() => setDraft({ ...draft, operation_type: value })} />{value ? <span className={'transaction-type-dot ' + (value === 'CREDIT' ? 'is-income' : '')} /> : null}{label}</label>)}</fieldset>
    <fieldset><legend>Категория</legend>{[{ id: '', name: 'Все' }, ...categories].map((category) => <label key={category.id}><input type="radio" name="filter-category" checked={draft.category_id === String(category.id)} onChange={() => setDraft({ ...draft, category_id: String(category.id) })} />{category.id ? <span className="transaction-color-dot" style={{ background: categoryColor(Number(category.id)) }} /> : null}{category.name}</label>)}</fieldset>
    <fieldset className="transaction-date-range"><legend>Период</legend><label>С<input type="date" min="1900-01-01" max="9998-12-31" value={draft.from_date} onChange={(event) => setDraft({ ...draft, from_date: event.target.value })} /></label><label>По<input type="date" min="1900-01-01" max="9998-12-31" value={draft.to_date} onChange={(event) => setDraft({ ...draft, to_date: event.target.value })} /></label></fieldset>
    {error ? <p className="transaction-error" role="alert">{error}</p> : null}
    <div className="transaction-filter-actions"><button type="submit" className="button-primary">Применить</button><button type="button" className="text-link" onClick={() => { setDraft({ operation_type: '', category_id: '', from_date: '', to_date: '' }); setError(null); }}>Сбросить фильтры</button></div>
  </form></TransactionSheet>;
}
