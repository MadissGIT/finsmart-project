import { ChevronRight, Info, Paintbrush, Star, Target, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getAchievements } from '@/entities/achievement/api';
import { getDiagnosis } from '@/entities/analytics/api';
import type { UserProfile } from '@/entities/user/model/types';
import { presetRange } from '@/features/dashboard/model/period';
import { MoreError, MoreHeading } from '@/pages/more/MoreUi';
import { useApiQuery } from '@/shared/api/useApiQuery';
import { financialToday } from '@/shared/lib/calendar';
import { BadgeEmblem } from './ProfileUi';
import { achievementsPath, challengePath, settingsPath } from './paths';

function getCurrentDiagnosis(signal: AbortSignal) {
  return getDiagnosis(presetRange('current_month', financialToday()), signal);
}

export function ProfileAvatar({ editable = false }: { editable?: boolean }) {
  return (
    <div className="profile-avatar">
      <UserRound size={50} strokeWidth={1.45} aria-hidden="true" />
      {editable && (
        <Link className="profile-avatar-edit" to={settingsPath} aria-label="Редактировать профиль">
          <Paintbrush size={15} strokeWidth={1.6} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

function ProfileHealth() {
  const { data, error, loading, retry } = useApiQuery(getCurrentDiagnosis);
  const health = data && (data.summary.total_income > 0 || data.summary.total_expense > 0) ? data.diagnostics : undefined;

  return (
    <section className="profile-card profile-health" aria-labelledby="profile-health-title">
      <h2 id="profile-health-title">Финансовое здоровье</h2>
      {error && <MoreError error={error} retry={retry} />}
      {loading && <p className="profile-note" role="status">Загружаем рейтинг…</p>}
      {!error && !loading && (
        <div className="profile-health-content">
          <div className="profile-health-ring" role={health ? 'meter' : undefined}
            aria-label={health ? 'Рейтинг финансового здоровья' : undefined}
            aria-valuenow={health?.health_score} aria-valuemin={health ? 0 : undefined} aria-valuemax={health ? 100 : undefined}
            style={{ background: 'conic-gradient(' + (health?.color ?? '#a4afce') + ' ' + (health?.health_score ?? 0) + '%, #dce5ee 0)' }}>
            <div><strong>{health?.health_score ?? '—'}</strong><span>/100</span></div>
          </div>
          <div>
            <p>{health?.status ?? 'Появится после добавления операций'}</p>
            <Link className="profile-health-link" to="/">
              <Info size={12} aria-hidden="true" /> Открыть обзор
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

export function ProfilePage({ user }: { user: UserProfile }) {
  const { data, error, loading, retry } = useApiQuery(getAchievements);
  const earned = data?.items.filter(({ unlocked }) => unlocked).slice(0, 4) ?? [];

  return (
    <div className="more-page profile-page">
      <MoreHeading title="Профиль" />
      <section className="profile-identity" aria-labelledby="profile-name">
        <ProfileAvatar editable />
        <h2 id="profile-name">{user.full_name}</h2>
        {data && <p>{data.reward_points.toLocaleString('ru-RU')} баллов <Star size={16} aria-hidden="true" /></p>}
      </section>
      <ProfileHealth />
      <section className="profile-section">
        <div className="profile-section-heading">
          <h2>Ваши достижения</h2>
          <Link to={achievementsPath}>Все бейджи <ChevronRight size={13} aria-hidden="true" /></Link>
        </div>
        {loading && <p className="profile-note" role="status">Загружаем достижения…</p>}
        {error && <MoreError error={error} retry={retry} />}
        {data && (earned.length ? (
          <ul className="profile-preview-badges">
            {earned.map((badge) => (
              <li key={badge.code} title={badge.title}><BadgeEmblem badge={badge} /><span className="sr-only">{badge.title}</span></li>
            ))}
          </ul>
        ) : <p className="profile-card profile-note">Первые бейджи появятся после действий в сервисе.</p>)}
      </section>
      <section className="profile-section">
        <div className="profile-section-heading">
          <h2>Активные челленджи</h2>
          <Link to={challengePath}>Все <ChevronRight size={13} aria-hidden="true" /></Link>
        </div>
        <Link className="profile-challenge-card" to={challengePath}>
          <Target size={40} strokeWidth={1.65} aria-hidden="true" />
          <span><strong>Челленджи</strong><small>Пока недоступны</small></span>
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}

