import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Category } from '@/entities/category/model/types';
import type { OperationType, Transaction } from '@/entities/transaction/model/types';
import { saveTransaction } from '@/entities/transaction/transactions-api';
import { financialTimezone } from '@/shared/lib/calendar';
import { FormField } from '@/shared/ui/FormField';
import { eligibleCategories, transactionDraft, validateTransactionDraft } from '../model/transactions';
import type { DraftErrors } from '../model/transactions';
import { useApiMutation } from '@/shared/api/useApiMutation';
import { CategoryIcon, TransactionAsset } from './CategoryIcon';
import { TransactionSheet } from './TransactionSheet';

export function TransactionForm({ categories, original, merchant, categoryId, onClose, onSaved }: { categories: Category[]; original?: Transaction; merchant?: string; categoryId?: string; onClose: () => void; onSaved: (item: Transaction) => void }) {
  const [draft, setDraft] = useState(() => {
    const initial = transactionDraft(original);
    if (original) return initial;
    return {
      ...initial,
      merchant_name: merchant ?? '',
      category_id: categoryId && eligibleCategories(categories, 'DEBIT').some(({ id }) => String(id) === categoryId) ? categoryId : '',
    };
  });
  const [errors, setErrors] = useState<DraftErrors>({});
  const mutation = useApiMutation();
  const available = eligibleCategories(categories, draft.operation_type);
  function changeType(operation_type: OperationType) {
    setDraft((current) => ({ ...current, operation_type, category_id: eligibleCategories(categories, operation_type).some((category) => String(category.id) === current.category_id) ? current.category_id : '' }));
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateTransactionDraft(draft, categories, original);
    setErrors(result.errors);
    if (result.fields) void mutation.run(() => saveTransaction(result.fields!, original?.id), onSaved);
  }
  return <TransactionSheet title={original ? 'Редактировать операцию' : 'Добавить операцию'} busy={mutation.busy} onClose={onClose}>
    <form className="transaction-form" onSubmit={submit} noValidate>
      <fieldset disabled={mutation.busy}>
        <legend className="sr-only">Данные операции</legend>
        <div className="transaction-type-switch" role="group" aria-label="Тип операции">{([['DEBIT', 'Расход'], ['CREDIT', 'Доход']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={draft.operation_type === value} onClick={() => changeType(value)}>{label}</button>)}</div>
        <div><FormField id="transaction-amount" label="Сумма" inputMode="decimal" placeholder="0 ₽" maxLength={16} value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} error={errors.amount} required />
          <div className="transaction-presets" aria-label="Быстрый выбор суммы">{[100, 500, 1000, 1500, 2000].map((amount) => <button key={amount} type="button" aria-label={'Сумма ' + amount + ' рублей'} onClick={() => setDraft({ ...draft, amount: String(amount) })}>{draft.operation_type === 'DEBIT' ? '−' : '+'}{amount.toLocaleString('ru-RU')}₽</button>)}</div>
        </div>
        <fieldset className="transaction-category-picker" aria-describedby={errors.category_id ? 'transaction-category-error' : undefined}>
          <legend>Категория</legend><div className="transaction-category-grid">{available.map((category) => <label className="transaction-category-choice" key={category.id}>
            <input type="radio" name="entry-category" value={category.id} checked={draft.category_id === String(category.id)} onChange={() => setDraft({ ...draft, category_id: String(category.id) })} /><span><CategoryIcon id={category.id} picker /><span>{category.name}</span></span>
          </label>)}</div>
          {errors.category_id ? <p className="field-error" id="transaction-category-error" role="alert">{errors.category_id}</p> : null}
        </fieldset>
        <FormField id="transaction-date" label="Дата и время" type="datetime-local" min="1900-01-01T00:00" max="9998-12-31T23:59" value={draft.transaction_date} onChange={(event) => setDraft({ ...draft, transaction_date: event.target.value })} icon={<TransactionAsset name="325d5.svg" />} error={errors.transaction_date} hint={financialTimezone === 'Europe/Moscow' ? 'Московское время' : 'Часовой пояс: ' + financialTimezone} required />
        <FormField id="transaction-merchant" label="Организация или описание" placeholder="Укажите организацию" maxLength={255} value={draft.merchant_name} onChange={(event) => setDraft({ ...draft, merchant_name: event.target.value })} error={errors.merchant_name} required />
        <details className="transaction-comment" open={!!original?.comment}><summary>Комментарий</summary><label htmlFor="transaction-comment" className="sr-only">Комментарий к операции</label><textarea id="transaction-comment" maxLength={2000} rows={3} value={draft.comment} onChange={(event) => setDraft({ ...draft, comment: event.target.value })} placeholder="Необязательно" />{errors.comment ? <p className="field-error" role="alert">{errors.comment}</p> : null}</details>
      </fieldset>
      {mutation.error ? <p className="transaction-error" role="alert">{mutation.error}</p> : null}
      <button className="button-primary" type="submit" disabled={mutation.busy}>{mutation.busy ? 'Сохраняем…' : original ? 'Сохранить изменения' : draft.operation_type === 'DEBIT' ? 'Добавить расход' : 'Добавить доход'}</button>
    </form>
  </TransactionSheet>;
}
