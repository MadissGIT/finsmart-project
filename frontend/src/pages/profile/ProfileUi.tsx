import { LockKeyhole, Star } from 'lucide-react';
import type { Achievement, Challenge, League } from '@/entities/gamification/api';
import { formatMoney } from '@/shared/lib/format';

const badgeTones: Record<string, string> = {
  'Бронза': 'bronze', 'Серебро': 'silver', 'Золото': 'gold', 'Платина': 'platinum',
};

export function BadgeEmblem({ badge }: { badge: Achievement }) {
  return (
    <span className="profile-badge-emblem" data-tone={badge.unlocked ? badgeTones[badge.level] ?? 'silver' : 'locked'} aria-hidden="true">
      <span>{badge.unlocked ? badge.icon : <LockKeyhole size={21} strokeWidth={1.6} />}</span>
    </span>
  );
}


export function LeagueStatus({ league, points }: { league: League; points: number }) {
  const next = league.next_minimum;
  return (
    <div className="profile-league">
      <div><Star size={16} aria-hidden="true" /> <strong>{league.title} лига</strong></div>
      <div>{points.toLocaleString('ru-RU')} баллов</div>
      {next !== null && <div className="profile-level-progress">
        <progress value={points - league.minimum} max={next - league.minimum}
          aria-label={'Прогресс до следующей лиги · ' + league.next_title} />
        <span>До повышения: {next - points}</span>
      </div>}
    </div>
  );
}

export function ChallengeProgress({ challenge }: { challenge: Challenge }) {
  const { current, target, title, unit } = challenge;
  const amount = unit === 'rubles' ? formatMoney(current) + ' из ' + formatMoney(target) : current + ' из ' + target;
  return (
    <div className="profile-level-progress">
      <progress value={current} max={target} aria-label={title} />
      <span>{amount}</span>
    </div>
  );
}
