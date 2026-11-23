import { describe, expect, it } from 'vitest';
import type { Goal } from '@/entities/goal/model/types';
import { changedGoalFields, goalStatus, nearestGoal, remainingAmount, validateGoal } from './goals';

const today = '2026-11-23';
const goal: Goal = {
  id: '17a943e7-9bc7-4833-8d7c-bba48c997c36',
  title: 'Копилка',
  target_amount: 10000,
  current_amount: 1000,
  deadline: '2026-12-01',
  icon: 'plane',
  monthly_payment_recommended: 9000,
  weekly_payment_recommended: 2078.52,
  progress_percent: 10,
  months_left: 0.26,
  exceeds_half_income: false,
  warning: null,
};

describe('копилки', () => {
  it('не считает цель закрытой, если API округлил прогресс до 100%, но осталась копейка', () => {
    const almostCompleted = { ...goal, current_amount: 9999.99, progress_percent: 100 };
    expect(remainingAmount(almostCompleted)).toBe(0.01);
    expect(goalStatus(almostCompleted, today)).toBe('active');
  });

  it('выбирает ближайшую из активных целей и учитывает сегодняшнюю дату', () => {
    const expired = { ...goal, deadline: '2026-11-22' };
    const completed = { ...goal, deadline: today, current_amount: goal.target_amount };
    const dueToday = { ...goal, deadline: today };
    expect(nearestGoal([expired, goal, completed, dueToday], today)).toBe(dueToday);
  });

  it('позволяет переименовать просроченную цель, сохранив исходный срок', () => {
    const original = { ...goal, deadline: '2026-11-22' };
    const draft = { title: 'Резерв', amount: '10000,00', deadline: original.deadline, icon: original.icon };
    const result = validateGoal(draft, original, today);
    expect(result.errors).toEqual({});
    expect(result.fields && changedGoalFields(original, result.fields)).toEqual({ title: 'Резерв' });
    expect(validateGoal({ ...draft, deadline: '2026-11-21' }, original, today).errors.deadline).toBeDefined();
  });
});
