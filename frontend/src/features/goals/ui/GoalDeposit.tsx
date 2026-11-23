import { useState } from 'react';
import type { FormEvent } from 'react';
import { depositGoal } from '@/entities/goal/api';
import type { DepositSource, Goal, GoalDepositResponse } from '@/entities/goal/model/types';
import { useApiMutation } from '@/shared/api/useApiMutation';
import { formatMoney } from '@/shared/lib/format';
import { FormField } from '@/shared/ui/FormField';
import { Modal } from '@/shared/ui/Modal';
import { contributionSources, readMoney, remainingAmount } from '../model/goals';
import { GoalIcon, GoalProgress } from './GoalVisual';

const suggestions = [1000, 5000, 10000, 15000];

export function GoalDeposit({ goal, onClose, onSaved }: {
  goal: Goal;
  onClose: () => void;
  onSaved: (response: GoalDepositResponse) => void;
}) {
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState<DepositSource>('free_money');
  const [error, setError] = useState('');
  const mutation = useApiMutation();
  const remaining = remainingAmount(goal);

  function fill(value: number) { setAmount(String(value).replace('.', ',')); setError(''); }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = readMoney(amount);
    if (value === null) { setError('Введите положительную сумму, до двух знаков после запятой.'); return; }
    if (value > remaining) { setError('Взнос превышает остаток до цели.'); return; }
    setError('');
    void mutation.run(() => depositGoal(goal.id, { amount: value, source }), onSaved);
  }

  return (
    <Modal open title="Пополнить цель" busy={mutation.busy} className="goal-dialog" onClose={onClose}>
      <div className="goal-deposit-summary">
        <GoalIcon name={goal.icon} />
        <div><strong>{goal.title}</strong><p>{formatMoney(goal.current_amount)} из {formatMoney(goal.target_amount)}</p><GoalProgress goal={goal} /></div>
      </div>
      <form className="goal-form" noValidate onSubmit={submit}>
        <fieldset disabled={mutation.busy}>
          <legend className="sr-only">Данные взноса</legend>
          <div>
            <FormField id="goal-deposit-amount" label="Сумма пополнения" required inputMode="decimal" placeholder="0 ₽" maxLength={16}
              value={amount} error={error} hint={'Осталось накопить ' + formatMoney(remaining)}
              onChange={(event) => { setAmount(event.target.value); setError(''); }} />
            <div className="goal-amount-suggestions" aria-label="Быстрый выбор суммы">
              {suggestions.filter((value) => value < remaining).map((value) => (
                <button type="button" key={value} onClick={() => fill(value)}>+{formatMoney(value)}</button>
              ))}
              <button type="button" onClick={() => fill(remaining)}>Весь остаток</button>
            </div>
          </div>
          <fieldset className="goal-sources">
            <legend>Источник взноса</legend>
            {(['free_money', 'discount'] as const).map((value) => (
              <label key={value}><input type="radio" name="goal-source" checked={source === value} onChange={() => setSource(value)} />{contributionSources[value]}</label>
            ))}
          </fieldset>
        </fieldset>
        <p className="goal-muted">Взнос изменит сумму в копилке. Деньги с банковского счёта не переводятся.</p>
        {mutation.error && <p className="goal-error" role="alert">{mutation.error}</p>}
        <button type="submit" className="button-primary" disabled={mutation.busy}>{mutation.busy ? 'Сохраняем…' : 'Пополнить'}</button>
      </form>
    </Modal>
  );
}
