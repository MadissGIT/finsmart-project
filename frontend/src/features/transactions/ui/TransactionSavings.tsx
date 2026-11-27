import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { listGoals } from '@/entities/goal/api';
import type { Transaction } from '@/entities/transaction/model/types';
import { recordDiscountSavings, removeDiscountSavings } from '@/entities/transaction/transactions-api';
import { goalStatus, readMoney, remainingAmount } from '@/features/goals/model/goals';
import { useApiMutation } from '@/shared/api/useApiMutation';
import { useApiQuery } from '@/shared/api/useApiQuery';
import { formatMoney } from '@/shared/lib/format';
import { FormField } from '@/shared/ui/FormField';
import { TransactionSheet } from './TransactionSheet';

export function TransactionSavings({ item, onChange }: { item: Transaction; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [original, setOriginal] = useState('');
  const [goalId, setGoalId] = useState('');
  const mutation = useApiMutation();
  const list = useApiQuery(listGoals, open);
  const id = useId();
  const savings = item.discount_savings;
  const goals = list.data?.filter((goal) => goalStatus(goal) === 'active') ?? [];
  const originalAmount = readMoney(original);
  const difference = ((originalAmount === null ? 0 : Math.round(originalAmount * 100)) - Math.round(item.amount * 100)) / 100;
  const goal = goals.find((entry) => entry.id === goalId);
  const fitsGoal = goal && difference <= remainingAmount(goal);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!originalAmount || difference <= 0 || !fitsGoal) return;
    void mutation.run(() => recordDiscountSavings(item.id, goalId, originalAmount), onChange);
  }

  return (
    <section className="transaction-savings">
      {savings ? <>
        <p>Из экономии отложено <strong>{formatMoney(savings.amount)}</strong></p>
        <Link className="inline-link" to={'/goals/' + savings.goal_id}>Открыть копилку</Link>
        <button type="button" className="inline-link" disabled={mutation.busy}
          onClick={() => { void mutation.run(() => removeDiscountSavings(item.id), onChange); }}>
          Отменить взнос
        </button>
        {mutation.error && <p className="transaction-error" role="alert">{mutation.error}</p>}
      </> : (
        <button type="button" className="button-secondary" onClick={() => setOpen(true)}>Отложить экономию</button>
      )}
      {open && (
        <TransactionSheet title="Экономия на скидке" busy={mutation.busy} onClose={() => setOpen(false)}>
          <form className="transaction-form transaction-savings-form" onSubmit={submit}>
            <p>Уплачено по чеку: <strong>{formatMoney(item.amount)}</strong>. Укажите цену до скидки и выберите копилку.</p>
            <FormField id={id + '-original'} label="Цена до скидки, ₽" value={original} maxLength={16}
              inputMode="decimal" onChange={(event) => setOriginal(event.target.value)} disabled={mutation.busy} required />
            {difference > 0 && <p>Экономия: <strong>{formatMoney(difference)}</strong></p>}
            {originalAmount !== null && difference <= 0 && <p className="transaction-error">Цена до скидки должна быть больше уплаченной суммы.</p>}
            {list.loading && <p role="status">Загружаем копилки…</p>}
            {list.error && <><p role="alert">{list.error}</p><button className="button-secondary" type="button" onClick={list.retry}>Повторить</button></>}
            {goals.length > 0 && (
              <div>
                <label htmlFor={id + '-goal'}>Копилка</label>
                <select id={id + '-goal'} value={goalId} onChange={(event) => setGoalId(event.target.value)} required disabled={mutation.busy}>
                  <option value="">Выберите копилку</option>
                  {goals.map((entry) => <option key={entry.id} value={entry.id}>{entry.title}</option>)}
                </select>
              </div>
            )}
            {list.data && !goals.length && <Link className="inline-link" to="/goals">Создать копилку</Link>}
            {goal && !fitsGoal && <p className="transaction-error">Экономия превышает остаток до цели.</p>}
            {mutation.error && <p className="transaction-error" role="alert">{mutation.error}</p>}
            <button className="button-primary" type="submit" disabled={mutation.busy || difference <= 0 || !fitsGoal}>
              {mutation.busy ? 'Сохраняем…' : 'Записать взнос'}
            </button>
          </form>
        </TransactionSheet>
      )}
    </section>
  );
}
