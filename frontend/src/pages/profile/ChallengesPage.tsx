import { Target } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { MoreHeading } from '@/pages/more/MoreUi';
import { challengePath, profilePath } from './paths';

const filters = [
  { id: 'active', label: 'Активные' },
  { id: 'completed', label: 'Завершённые' },
  { id: 'all', label: 'Все' },
];

export function ChallengesPage() {
  const [params] = useSearchParams();
  const current = filters.find(({ id }) => id === params.get('status'))?.id ?? 'active';

  return (
    <div className="more-page profile-page">
      <MoreHeading title="Челленджи" back={profilePath} />
      <nav className="profile-tabs profile-challenge-tabs" aria-label="Статус челленджей">
        {filters.map(({ id, label }) => (
          <Link key={id} to={challengePath + '?status=' + id}
            aria-current={id === current ? 'page' : false}>
            {label}
          </Link>
        ))}
      </nav>
      <section className="profile-card profile-challenge-empty">
        <span className="profile-level-icon"><Target size={28} aria-hidden="true" /></span>
        <div><h2>Челленджи пока недоступны</h2><p>Здесь появятся задания и прогресс, когда сервис их подключит.</p></div>
      </section>
    </div>
  );
}
