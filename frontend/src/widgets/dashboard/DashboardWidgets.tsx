import { ChevronRight, Info, Plus, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { DashboardResponse } from '@/entities/analytics/model/types';
import { listGoals } from '@/entities/goal/api';
import { useAuth } from '@/features/auth/model/context';
import { formatDeadline, formatPercent, nearestGoal } from '@/features/goals/model/goals';
import { GoalIcon } from '@/features/goals/ui/GoalVisual';
import { getAuthGeneration } from '@/shared/api/tokens';
import { useApiQuery } from '@/shared/api/useApiQuery';
import { formatMoney } from '@/shared/lib/format';

export function BudgetScore({ score, onHelp }: { score: number | null; onHelp: () => void }) {
  const displayScore = score === null ? null : Math.round(score);

  return (
    <section className="panel" aria-label="Соблюдение бюджета">
      <h2>Соблюдение бюджета</h2>
      <div className="health-content">
        {displayScore === null ? (
          <div className="health-ring health-ring-empty" aria-hidden="true"><span className="health-ring-inner"><strong>—</strong><small>/100</small></span></div>
        ) : (
          <div className="health-ring" role="progressbar" aria-label="Индекс соблюдения бюджета" aria-valuenow={displayScore} aria-valuemin={0} aria-valuemax={100} style={{ background: 'conic-gradient(#65ae9c ' + displayScore + '%, #d9e9ed 0)' }}>
            <span className="health-ring-inner"><strong>{displayScore}</strong><small>/100</small></span>
          </div>
        )}
        <div><p className="health-label">{displayScore === null ? 'Недостаточно данных' : 'Индекс бюджета'} <Info className="inline" size={10} aria-hidden="true" /></p><button type="button" className="health-tip" onClick={onHelp}>О рейтинге</button></div>
      </div>
    </section>
  );
}

const budgetGroups = [
  { key: 'needs', label: 'Необходимое', color: '#65b79e', target: 50 },
  { key: 'wants', label: 'Желания', color: '#6ba8ec', target: 30 },
  { key: 'savings', label: 'Сбережения', color: '#a08ae8', target: 20 },
] as const;

export function BudgetStrip({ budget, to = '/analytics' }: { budget?: DashboardResponse['budget_50_30_20']; to?: string }) {
  return (
    <Link className="budget-strip" to={to} aria-label="Бюджет 50 / 30 / 20 — открыть аналитику">
      <span className="budget-strip-title">Бюджет <span className="text-brand-600">50 / 30 / 20</span><Info size={10} aria-hidden="true" /><ChevronRight size={16} aria-hidden="true" /></span>
      <span className="budget-track" aria-hidden="true">{budget ? budgetGroups.map(({ key, color, target }) => <span className="budget-target-segment" key={key} style={{ width: target + '%' }}><span style={{ width: Math.min(100, budget[key].target_percent > 0 ? budget[key].percent / budget[key].target_percent * 100 : 0) + '%', background: color }} /></span>) : null}</span>
      <dl className="budget-details">{budgetGroups.map(({ key, label, color }) =>
        <div key={key}><dt style={{ color }}><span className="expense-dot" style={{ background: color }} />{budget ? budget[key].percent.toLocaleString('ru-RU') + '%' : '—'}</dt><dd>{label}<strong>{budget ? formatMoney(budget[key].amount) : '—'}</strong></dd></div>)}</dl>
      {budget ? <span className="budget-empty-note">Полосы показывают выполнение ориентиров 50/30/20</span> : null}
      {budget ? null : <span className="budget-empty-note">Распределение появится после добавления операций</span>}
    </Link>
  );
}

export function GoalPreview() {
  const auth = useAuth();
  const signedIn = auth.status === 'authenticated';
  return <GoalPreviewContent key={(auth.user?.id ?? 'guest') + ':' + getAuthGeneration()} signedIn={signedIn} />;
}

function GoalPreviewContent({ signedIn }: { signedIn: boolean }) {
  const query = useApiQuery(listGoals, signedIn);
  const goal = query.data && nearestGoal(query.data);
  return (
    <section aria-label="Ближайшие цели">
      <div className="goals-heading">
        <h2>Ближайшие цели</h2>
        <div className="flex items-center gap-2">
          <Link to="/goals">Все цели</Link>
          <Link className="goal-plus" to="/goals?add=1" aria-label="Создать цель"><Plus size={21} aria-hidden="true" /></Link>
        </div>
      </div>
      {query.loading && <p className="goal-preview" role="status">Загружаем копилки…</p>}
      {query.error && <div className="goal-preview goal-preview-error">
        <p role="alert">Не удалось загрузить копилки.</p>
        <button type="button" className="inline-link" onClick={query.retry}>Повторить</button>
      </div>}
      {goal && <Link className="goal-preview" to={'/goals/' + goal.id}>
        <GoalIcon name={goal.icon} />
        <div className="goal-preview-content">
          <h3>{goal.title}</h3>
          <p>{formatMoney(goal.current_amount)} / {formatMoney(goal.target_amount)}</p>
          <progress className="progress-meter" max={100} value={goal.progress_percent} aria-label={'Прогресс цели ' + goal.title} />
        </div>
        <p className="goal-preview-deadline">{formatPercent(goal.progress_percent)}<span>{formatDeadline(goal.deadline)}</span></p>
      </Link>}
      {(!signedIn || (query.data && !goal)) && (
        <div className="goal-preview goal-empty">
          <Target size={21} aria-hidden="true" />
          <div>
            <p>{query.data?.length ? 'Активных целей пока нет' : 'Целей пока нет'}</p>
            <span>{signedIn ? 'Создайте цель, чтобы начать копить' : 'Войдите, чтобы увидеть свои копилки'}</span>
          </div>
        </div>
      )}
    </section>
  );
}
