import { LockKeyhole } from 'lucide-react';
import type { Achievement } from '@/entities/achievement/api';

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
