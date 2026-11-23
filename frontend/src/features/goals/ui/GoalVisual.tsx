import { CarFront, House, Laptop, Plane, ShieldCheck, Target } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Goal } from '@/entities/goal/model/types';
import { formatPercent } from '../model/goals';

const icons: Partial<Record<string, LucideIcon>> = {
  plane: Plane,
  travel: Plane,
  laptop: Laptop,
  car: CarFront,
  home: House,
  shield: ShieldCheck,
};

export function GoalIcon({ name }: { name: string }) {
  const Icon = icons[name] ?? Target;
  return <span className="goal-icon" aria-hidden="true"><Icon size={25} strokeWidth={1.65} /></span>;
}

export function GoalProgress({ goal }: { goal: Pick<Goal, 'progress_percent' | 'title'> }) {
  return (
    <div className="goal-progress">
      <progress className="progress-meter" max={100} value={goal.progress_percent} aria-label={'Прогресс цели «' + goal.title + '»'} />
      <span>{formatPercent(goal.progress_percent)}</span>
    </div>
  );
}
