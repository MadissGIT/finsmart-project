import { useState } from 'react';
import type { FormEvent } from 'react';
import { createGoal, updateGoal } from '@/entities/goal/api';
import type { Goal } from '@/entities/goal/model/types';
import { useApiMutation } from '@/shared/api/useApiMutation';
import { financialToday } from '@/shared/lib/calendar';
import { formatMoney } from '@/shared/lib/format';
import { FormField } from '@/shared/ui/FormField';
import { Modal } from '@/shared/ui/Modal';
import { changedGoalFields, goalIcons, validateGoal } from '../model/goals';
import type { GoalDraft, GoalErrors } from '../model/goals';
import { GoalIcon } from './GoalVisual';

const suggestions = [5000, 70000, 150000, 1000000];

export function GoalForm({ original, onClose, onSaved }: {
  original?: Goal;
  onClose: () => void;
  onSaved: (goal: Goal) => void;
}) {
  const [draft, setDraft] = useState<GoalDraft>(() => ({
    title: original?.title ?? '',
    amount: original ? String(original.target_amount).replace('.', ',') : '',
    deadline: original?.deadline ?? '',
    icon: original?.icon ?? 'target',
  }));
  const [errors, setErrors] = useState<GoalErrors>({});
  const mutation = useApiMutation();
  const today = financialToday();
  const editing = !!original;
  const chooseIcon = (value: string) => setDraft((current) => ({ ...current, icon: value }));
  const chooseAmount = (value: string) => setDraft((current) => ({ ...current, amount: value }));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { fields, errors } = validateGoal(draft, original, today);
    setErrors(errors);
    if (!fields) return;
    if (original) {
      const updated = changedGoalFields(original, fields);
      if (!Object.keys(updated).length) { onClose(); return; }
      void mutation.run(() => updateGoal(original.id, updated), onSaved);
    } else {
      void mutation.run(() => createGoal(fields), onSaved);
    }
  }

  return (
    <Modal open title={editing ? 'Редактировать цель' : 'Создать цель'} busy={mutation.busy} className="goal-dialog" onClose={onClose}>
      <form className="goal-form" noValidate onSubmit={submit}>
        <fieldset disabled={mutation.busy}>
          <legend className="sr-only">Данные копилки</legend>
          <FormField id="goal-title" label="Название" required maxLength={200} placeholder="Например, путешествие"
            value={draft.title} error={errors.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          <div>
            <FormField id="goal-amount" label="Целевая сумма" required inputMode="decimal" placeholder="0 ₽" maxLength={16}
              value={draft.amount} error={errors.amount} onChange={(event) => chooseAmount(event.target.value)} />
            <div className="goal-amount-suggestions" aria-label="Быстрый выбор суммы">
              {suggestions.map((amount) => (
                <button type="button" key={amount} onClick={() => chooseAmount(String(amount))}>{formatMoney(amount)}</button>
              ))}
            </div>
          </div>
          <FormField id="goal-deadline" label="Срок достижения" required type="date" min={today} max="9998-12-31"
            value={draft.deadline} error={errors.deadline}
            onChange={(event) => setDraft({ ...draft, deadline: event.target.value })} />
          <fieldset className="goal-icon-field">
            <legend>Выберите категорию</legend>
            <div className="goal-icon-picker">
              {goalIcons.map(({ value, label }) => (
                <label key={value}>
                  <input type="radio" name="goal-icon" value={value} checked={draft.icon === value} onChange={() => chooseIcon(value)} />
                  <span><GoalIcon name={value} />{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </fieldset>
        {mutation.error && <p className="goal-error" role="alert">{mutation.error}</p>}
        <button type="submit" className="button-primary" disabled={mutation.busy}>
          {mutation.busy ? 'Сохраняем…' : editing ? 'Сохранить изменения' : 'Создать цель'}
        </button>
      </form>
    </Modal>
  );
}
