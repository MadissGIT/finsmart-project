import { ChevronRight, PiggyBank, Plus } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { listGoals } from '@/entities/goal/api';
import type { Goal } from '@/entities/goal/model/types';
import { useAuth } from '@/features/auth/model/context';
import { formatDeadline, goalStatus, goalStatusLabels } from '@/features/goals/model/goals';
import { GoalForm } from '@/features/goals/ui/GoalForm';
import { GoalIcon, GoalProgress } from '@/features/goals/ui/GoalVisual';
import { getAuthGeneration } from '@/shared/api/tokens';
import { useApiQuery } from '@/shared/api/useApiQuery';
import { financialToday } from '@/shared/lib/calendar';
import { formatMoney } from '@/shared/lib/format';
import { GoalDetails } from './GoalDetails';
import './goals.css';

function GoalsHeading() {
  return <header className="goals-page-heading"><h1>Финансовые цели</h1><p>Создавайте копилки и следите за накоплениями.</p></header>;
}

function GoalCard({ goal, today }: { goal: Goal; today: string }) {
  const status = goalStatus(goal, today);
  return (
    <Link className={'goal-card goal-card-' + status} to={'/goals/' + goal.id}>
      <GoalIcon name={goal.icon} />
      <div className="goal-card-content">
        <h2>{goal.title}</h2>
        <p>{formatMoney(goal.current_amount)} из {formatMoney(goal.target_amount)}</p>
        <GoalProgress goal={goal} />
        <p className={status === 'active' ? 'goal-muted' : 'goal-status goal-status-' + status}>
          {status === 'active' ? 'До ' + formatDeadline(goal.deadline) : goalStatusLabels[status]}
        </p>
      </div>
      <ChevronRight size={17} aria-hidden="true" />
    </Link>
  );
}

function GoalsList() {
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();
  const query = useApiQuery(listGoals);
  const creating = search.get('add') === '1';
  const today = financialToday();

  function closeCreate() {
    const next = new URLSearchParams(search);
    next.delete('add');
    setSearch(next, { replace: true });
  }

  return (
    <div className="goals-page">
      <GoalsHeading />
      <Link className="button-primary goal-create" to="/goals?add=1">
        <Plus size={17} aria-hidden="true" />Создать цель
      </Link>
      {query.loading && <p className="goal-state" role="status">Загружаем копилки…</p>}
      {query.error && <div className="goal-state">
        <p className="goal-error" role="alert">{query.error}</p>
        <button type="button" className="button-secondary" onClick={query.retry}>Повторить загрузку</button>
      </div>}
      {query.data && (query.data.length ? <ul className="goals-grid">
        {query.data.map((goal) => <li key={goal.id}><GoalCard goal={goal} today={today} /></li>)}
      </ul> : <div className="goals-empty">
        <PiggyBank size={38} aria-hidden="true" />
        <h2>Копилок пока нет</h2>
        <p>Создайте цель, чтобы увидеть, сколько нужно откладывать.</p>
      </div>)}
      {creating && <GoalForm onClose={closeCreate} onSaved={(goal) => navigate('/goals/' + goal.id, { replace: true })} />}
    </div>
  );
}

export function GoalsPage() {
  const auth = useAuth();
  const { goalId } = useParams();
  if (auth.status === 'authenticated') {
    const key = auth.user?.id + ':' + getAuthGeneration();
    if (goalId) return <GoalDetails key={key + ':' + goalId} id={goalId.toLowerCase()} back="/goals" />;
    return <GoalsList key={key} />;
  }

  return (
    <div className="goals-page">
      <GoalsHeading />
      {auth.status === 'anonymous' && <div className="goals-empty">
        <PiggyBank size={38} aria-hidden="true" />
        <h2>Копилки доступны после входа</h2>
        <Link to="/auth?next=/goals" className="button-primary">Войти</Link>
      </div>}
      {auth.status === 'loading' && <p className="goal-state" role="status">Загружаем профиль…</p>}
      {auth.status === 'error' && <div className="goal-state">
        <p className="goal-error" role="alert">{auth.error}</p>
        <button type="button" className="button-secondary" onClick={auth.retryProfile}>Повторить загрузку</button>
      </div>}
    </div>
  );
}
