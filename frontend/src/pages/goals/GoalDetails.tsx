import { useCallback, useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { deleteGoal, getGoal } from '@/entities/goal/api';
import type { Goal, GoalDepositResponse } from '@/entities/goal/model/types';
import { formatDeadline, goalStatus, goalStatusLabels, remainingAmount } from '@/features/goals/model/goals';
import { GoalDeposit } from '@/features/goals/ui/GoalDeposit';
import { GoalForm } from '@/features/goals/ui/GoalForm';
import { GoalIcon, GoalProgress } from '@/features/goals/ui/GoalVisual';
import { useApiMutation } from '@/shared/api/useApiMutation';
import { useApiQuery } from '@/shared/api/useApiQuery';
import { formatMoney } from '@/shared/lib/format';
import { isUuid } from '@/shared/lib/guards';
import { Modal } from '@/shared/ui/Modal';
import { GoalHistory } from './GoalHistory';

function DeleteGoalDialog({ goal, onClose, onDeleted }: { goal: Goal; onClose: () => void; onDeleted: () => void }) {
  const mutation = useApiMutation();
  return (
    <Modal open title="Удалить копилку?" busy={mutation.busy} className="goal-dialog goal-confirm" onClose={onClose}>
      <p>Копилка «{goal.title}» будет удалена вместе с историей её пополнений.</p>
      {mutation.error && <p className="goal-error" role="alert">{mutation.error}</p>}
      <div className="goal-confirm-actions">
        <button className="button-secondary" type="button" disabled={mutation.busy} onClick={onClose}>Отмена</button>
        <button className="button-primary goal-delete" type="button" disabled={mutation.busy}
          onClick={() => void mutation.run(() => deleteGoal(goal.id), onDeleted)}>
          {mutation.busy ? 'Удаляем…' : 'Удалить копилку'}
        </button>
      </div>
    </Modal>
  );
}

export function GoalDetails({ id, back }: { id: string; back: string }) {
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<'edit' | 'deposit' | 'delete' | null>(null);
  const [receipt, setReceipt] = useState<GoalDepositResponse | null>(null);
  const [notice, setNotice] = useState('');
  const valid = isUuid(id);
  const load = useCallback((signal: AbortSignal) => getGoal(id, signal), [id]);
  const query = useApiQuery(load, valid);
  const goal = query.data;
  const close = () => setDialog(null);

  if (!valid || query.notFound) {
    return (
      <div className="goals-page goal-state">
        <h1>Копилка не найдена</h1>
        <Link to={back} className="button-primary">К копилкам</Link>
      </div>
    );
  }

  const status = goal && goalStatus(goal);

  return (
    <div className="goals-page goal-detail">
      <header className="goal-detail-header">
        <Link to={back} className="icon-button" aria-label="К копилкам"><ArrowLeft size={22} aria-hidden="true" /></Link>
        <span>Копилка</span>
      </header>
      {query.loading && <p className="goal-state" role="status">Загружаем копилку…</p>}
      {query.error && <div className="goal-state">
        <p className="goal-error" role="alert">{query.error}</p>
        <button className="button-secondary" onClick={query.retry}>Повторить загрузку</button>
      </div>}
      {notice && <p className="goal-notice" role="status">{notice}</p>}
      {goal && status && <>
        <section className="goal-hero" aria-labelledby="goal-name">
          <div>
            <p className={'goal-status goal-status-' + status}>{goalStatusLabels[status]}</p>
            <h1 id="goal-name">{goal.title}</h1>
            <p className="goal-muted">Срок достижения · {formatDeadline(goal.deadline)}</p>
          </div>
          <GoalIcon name={goal.icon} />
        </section>
        <section className="goal-totals" aria-label="Прогресс и план">
          <div className="goal-balance"><strong>{formatMoney(goal.current_amount)}</strong><span>из {formatMoney(goal.target_amount)}</span></div>
          <GoalProgress goal={goal} />
          <dl>
            <div><dt>Осталось накопить</dt><dd>{formatMoney(remainingAmount(goal))}</dd></div>
            {status !== 'completed' && <>
              <div><dt>Взнос в месяц</dt><dd>{formatMoney(goal.monthly_payment_recommended)}</dd></div>
              <div><dt>Взнос в неделю</dt><dd>{formatMoney(goal.weekly_payment_recommended)}</dd></div>
            </>}
          </dl>
          {goal.warning && status !== 'completed' && <p className="goal-warning">{goal.warning}</p>}
          {status !== 'completed' && <button type="button" className="button-primary" onClick={() => setDialog('deposit')}>
            <Plus size={17} aria-hidden="true" />Пополнить
          </button>}
        </section>
        <GoalHistory id={id} />
        <div className="goal-detail-actions">
          <button type="button" className="button-secondary" onClick={() => setDialog('edit')}>Редактировать</button>
          <button type="button" className="text-link goal-delete-link" onClick={() => setDialog('delete')}>Удалить копилку</button>
        </div>
        {dialog === 'edit' && <GoalForm original={goal} onClose={close} onSaved={() => {
          close(); setNotice('Изменения сохранены.'); query.retry();
        }} />}
        {dialog === 'deposit' && <GoalDeposit goal={goal} onClose={close} onSaved={(result) => {
          close(); setNotice(''); setReceipt(result); query.retry();
        }} />}
        {dialog === 'delete' && <DeleteGoalDialog goal={goal} onClose={close} onDeleted={() => navigate(back, { replace: true })} />}
      </>}
      {receipt && <Modal open title="Цель пополнена!" className="goal-dialog goal-confirm" onClose={() => setReceipt(null)}>
        <div className="goal-deposit-success">
          <img src="/illustrations/success.png" alt="" width="136" height="100" />
          <p>{receipt.message}. Сейчас в копилке <strong>{formatMoney(receipt.current_amount)}</strong>.</p>
          {receipt.acceleration_days > 0 && <p>По оценке сервера, взнос приблизил достижение цели на {receipt.acceleration_days} дн.</p>}
          <button className="button-primary" onClick={() => setReceipt(null)}>Отлично</button>
        </div>
      </Modal>}
    </div>
  );
}
