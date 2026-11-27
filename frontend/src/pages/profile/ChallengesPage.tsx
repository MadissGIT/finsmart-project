import { CalendarDays, PiggyBank, Target, Trophy } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { acceptChallenge } from '@/entities/gamification/api';
import type { Challenge } from '@/entities/gamification/api';
import { useNotifications } from '@/features/notifications/model/context';
import { MoreError, MoreHeading } from '@/pages/more/MoreUi';
import { useApiMutation } from '@/shared/api/useApiMutation';
import { formatDeadline } from '@/features/goals/model/goals';
import { financialToday } from '@/shared/lib/calendar';
import { ChallengeProgress } from './ProfileUi';
import { challengePath, profilePath } from './paths';

const filters = [
  { id: 'active', label: 'Активные' },
  { id: 'completed', label: 'Завершённые' },
  { id: 'all', label: 'Все' },
];
const icons = { expenses: Target, days: CalendarDays, rubles: PiggyBank };

function ChallengeCard({ challenge, accept, disabled }: {
  challenge: Challenge;
  accept: (code: string) => void;
  disabled: boolean;
}) {
  const { title, description, deadline, points, status } = challenge;
  const Icon = icons[challenge.unit];
  const available = status === 'available';
  return (
    <li className={'profile-card profile-challenge-item' + (available ? ' profile-challenge-offer' : '')}>
      <span className="profile-level-icon"><Icon size={24} aria-hidden="true" /></span>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
        {!available && <ChallengeProgress challenge={challenge} />}
        <p className="profile-challenge-meta">
          {status === 'active' && deadline && 'До ' + formatDeadline(financialToday(new Date(deadline))) + ' · '}
          {status === 'expired' && 'Срок истёк · '}
          {status === 'completed' ? 'Завершён · +' + points : 'Награда: ' + points} баллов
        </p>
        {available && <button className="button-primary profile-challenge-accept" type="button"
          aria-label={'Принять челлендж «' + title + '»'} disabled={disabled} onClick={() => accept(challenge.code)}>
          Принять
        </button>}
      </div>
    </li>
  );
}

export function ChallengesPage() {
  const [params] = useSearchParams();
  const current = filters.find(({ id }) => id === params.get('status'))?.id ?? 'active';
  const { game: { data, error, loading, retry } } = useNotifications();
  const mutation = useApiMutation();
  const entries = data?.challenges ?? [];
  const visible = entries.filter(({ status }) => status !== 'available' && (current === 'all' || status === current));
  const available = current === 'completed' ? [] : entries.filter(({ status }) => status === 'available');

  function accept(code: string) {
    void mutation.run(() => acceptChallenge(code), retry);
  }

  return (
    <div className="more-page profile-page">
      <MoreHeading title="Челленджи" back={profilePath} />
      <nav className="profile-tabs profile-challenge-tabs" aria-label="Статус челленджей">
        {filters.map(({ id, label }) => (
          <Link key={id} to={challengePath + '?status=' + id} aria-current={id === current ? 'page' : false}>
            {label}
          </Link>
        ))}
      </nav>
      {loading && !data && <p className="profile-note" role="status">Загружаем челленджи…</p>}
      {error && <MoreError error={error} retry={retry} />}
      {mutation.error && <p className="field-error" role="alert">{mutation.error}</p>}
      {data && <>
        {visible.length > 0 && <ul className="profile-levels">
          {visible.map((challenge) => <ChallengeCard key={challenge.code} challenge={challenge}
            accept={accept} disabled={mutation.busy || loading} />)}
        </ul>}
        {!visible.length && current !== 'all' && <section className="profile-card profile-challenge-empty">
          <span className="profile-level-icon"><Target size={28} aria-hidden="true" /></span>
          <h2>{current === 'completed' ? 'Завершённых челленджей пока нет' : 'Активных челленджей пока нет'}</h2>
        </section>}
        {available.length > 0 && <section className="profile-section profile-challenge-offers">
          <div className="profile-section-heading"><h2><Trophy size={16} aria-hidden="true" /> Доступные челленджи</h2></div>
          <ul className="profile-levels">
            {available.map((challenge) => <ChallengeCard key={challenge.code} challenge={challenge}
              accept={accept} disabled={mutation.busy || loading} />)}
          </ul>
        </section>}
      </>}
    </div>
  );
}
