import { useState } from 'react';
import type { Category } from '@/entities/category/model/types';
import type { Transaction } from '@/entities/transaction/model/types';
import { changeTransactionCategory } from '@/entities/transaction/transactions-api';
import { formatMoney } from '@/shared/lib/format';
import { eligibleCategories } from '../model/transactions';
import { useTransactionMutation } from '../model/useTransactionMutation';
import { CategoryIcon, TransactionAsset } from './CategoryIcon';
import { TransactionSheet } from './TransactionSheet';

export function TransactionCategory({ item, categories, onClose, onSaved }: { item: Transaction; categories: Category[]; onClose: () => void; onSaved: () => void }) {
  const [selected, setSelected] = useState(item.category_id);
  const [rule, setRule] = useState(false);
  const mutation = useTransactionMutation();
  const category = categories.find((value) => value.id === selected);
  function save(remember: boolean) { void mutation.run(() => changeTransactionCategory(item.id, { category_id: selected, save_as_global_rule: remember }), onSaved); }
  return <TransactionSheet key={rule ? 'rule' : 'category'} title={rule ? 'Запомнить правило?' : 'Изменить категорию'} variant={rule ? 'center' : 'bottom'} busy={mutation.busy} onClose={rule ? () => setRule(false) : onClose}>
    {rule ? <div className="transaction-rule"><div className="transaction-rule-icon" aria-hidden="true"><TransactionAsset name="c1a75.svg" /><TransactionAsset name="97326.svg" style={{ left: 14, top: 14 }} /></div><p>Всегда относить «{item.merchant_name}» к категории «{category?.name}»?</p><p className="transaction-muted">Правило применяется при следующем импорте выписки в вашем аккаунте.</p><div className="transaction-rule-actions"><button type="button" className="button-secondary" disabled={mutation.busy} onClick={() => save(false)}>Только эту операцию</button><button type="button" className="button-primary" disabled={mutation.busy} onClick={() => save(true)}>{mutation.busy ? 'Сохраняем…' : 'Запомнить'}</button></div></div> : <>
      <div className="transaction-category-summary"><CategoryIcon id={item.category_id} /><span>{item.merchant_name}</span><strong>{formatMoney(item.amount)}</strong></div>
      <fieldset className="transaction-category-list" disabled={mutation.busy}><legend>Выберите категорию</legend>{eligibleCategories(categories, item.operation_type).map((value) => <label key={value.id}><input type="radio" name="correct-category" checked={selected === value.id} onChange={() => setSelected(value.id)} /><span><CategoryIcon id={value.id} picker />{value.name}</span></label>)}</fieldset>
      <button className="button-primary" type="button" disabled={!category} onClick={() => setRule(true)}>Сохранить</button>
    </>}
    {mutation.error ? <p className="transaction-error" role="alert">{mutation.error}</p> : null}
  </TransactionSheet>;
}
