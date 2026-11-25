import { Award, LockKeyhole, Star, Trophy } from 'lucide-react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { getAchievements } from '@/entities/achievement/api';
import type { Achievement } from '@/entities/achievement/api';
import { MoreError, MoreHeading } from '@/pages/more/MoreUi';
import { useApiQuery } from '@/shared/api/useApiQuery';
import { financialToday } from '@/shared/lib/calendar';
import { Modal } from '@/shared/ui/Modal';
import { BadgeEmblem } from './ProfileUi';
import { achievementsPath, profilePath, statisticsPath } from './paths';

const levelOrder: Record<string, number> = { Бронза: 1, Серебро: 2, Золото: 3, Платина: 4 };

function BadgeStatistics({ items, points }: { items: Achievement[]; points: number }) {
  const month = financialToday().slice(0, 7);
  const monthlyCount = items.filter(({ earned_at: earnedAt, unlocked }) =>
    unlocked && earnedAt && financialToday(new Date(earnedAt)).startsWith(month)).length;
  const byLevel = new Map<string, { total: number; earned: number }>();
  for (const badge of items) {
    const count = byLevel.get(badge.level) ?? { total: 0, earned: 0 };
    count.total += 1;
    if (badge.unlocked) count.earned += 1;
    byLevel.set(badge.level, count);
  }

  const levels = Array.from(byLevel).sort(([left], [right]) =>
    (levelOrder[left] ?? 5) - (levelOrder[right] ?? 5));

  return (
    <div className="profile-section">
      <dl className="profile-stat-totals">
        <div><dt><Award size={32} aria-hidden="true" />достижений за месяц</dt><dd>{monthlyCount}</dd></div>
        <div><dt><Star size={26} aria-hidden="true" />баллов всего</dt><dd>{points.toLocaleString('ru-RU')}</dd></div>
      </dl>
      {byLevel.size > 0 && <>
        <h2>Прогресс по уровням</h2>
        <ul className="profile-levels">
          {levels.map(([level, count]) => (
            <li className="profile-card profile-level" key={level}>
              <span className="profile-level-icon"><Award size={22} aria-hidden="true" /></span>
              <div>
                <h3>{level}</h3>
                <div className="profile-level-progress">
                  <progress max={count.total} value={count.earned} aria-label={level} />
                  <span>{count.earned} из {count.total}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </>}
    </div>
  );
}

function Badges({ items, earned }: { items: Achievement[]; earned: Achievement[] }) {
  const [selected, setSelected] = useState<Achievement | null>(null);
  const locked = items.filter((badge) => !badge.unlocked);
  const next = locked[0];
  return (
    <div className="profile-section">
      <h2>Бейджи <span className="profile-muted">({earned.length} из {items.length})</span></h2>
      {items.length === 0 && <p className="profile-card profile-note">Каталог достижений пока пуст.</p>}
      <ul className="profile-badge-grid">
        {earned.concat(locked).map((badge) => (
          <li key={badge.code}>
            <button type="button" onClick={() => setSelected(badge)} aria-label={badge.title + (badge.unlocked ? ', получен' : ', закрыт')}>
              <BadgeEmblem badge={badge} />
              <span>{badge.title}</span>
            </button>
          </li>
        ))}
      </ul>
      {next && <button className="profile-challenge-card profile-next-badge" type="button" onClick={() => setSelected(next)}>
        <span className="profile-level-icon"><LockKeyhole size={23} aria-hidden="true" /></span>
        <span><small>Закрытый бейдж</small><strong>{next.title}</strong><small>{next.condition}</small></span>
      </button>}
      <Modal open={selected !== null} title={selected?.title ?? 'Бейдж'} onClose={() => setSelected(null)}>
        {selected && <div className="profile-badge-details">
          <BadgeEmblem badge={selected} />
          <p>{selected.level} · {selected.points} баллов</p>
          <p>{selected.condition}</p>
          <p>{selected.unlocked ? 'Получен' : 'Пока закрыт'}
            {selected.earned_at && ' · ' + financialToday(new Date(selected.earned_at)).split('-').reverse().join('.')}
          </p>
        </div>}
      </Modal>
    </div>
  );
}

export function AchievementsPage({ statistics = false }: { statistics?: boolean }) {
  const { data, error, loading, retry } = useApiQuery(getAchievements);
  const earned = data?.items.filter(({ unlocked }) => unlocked) ?? [];

  return (
    <div className="more-page profile-page">
      <MoreHeading title="Достижения" back={profilePath} />
      <section className="profile-achievement-hero">
        <span className="profile-trophy" aria-hidden="true"><Trophy size={64} strokeWidth={2.4} /></span>
        <h2>{earned.length ? 'Твои финансовые достижения' : 'Путь к достижениям'}</h2>
        <p>{earned.length ? 'Бейджи за действия в ФинСмарте' : 'Выполняй условия, чтобы получить первые бейджи'}</p>
      </section>
      <nav className="profile-tabs" aria-label="Достижения">
        <NavLink end to={achievementsPath}>Бейджи</NavLink>
        <NavLink end to={statisticsPath}>Статистика</NavLink>
      </nav>
      {loading && <p className="profile-note" role="status">Загружаем достижения…</p>}
      {error && <MoreError error={error} retry={retry} />}
      {data && (statistics
        ? <BadgeStatistics items={data.items} points={data.reward_points} />
        : <Badges items={data.items} earned={earned} />)}
    </div>
  );
}
