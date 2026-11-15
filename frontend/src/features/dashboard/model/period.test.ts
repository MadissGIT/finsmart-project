import { describe, expect, it } from 'vitest';
import { financialToday, isCalendarDate, periodSearch, presetRange, readPeriod, validateRange } from './period';

describe('периоды серверной аналитики', () => {
  it('считает день в часовом поясе финансов, а не UTC', () => {
    expect(financialToday(new Date('2026-10-31T22:30:00Z'))).toBe('2026-11-01');
  });
  it('учитывает високосный февраль и переход года', () => {
    expect(presetRange('previous_month', '2024-03-15')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(presetRange('previous_month', '2026-01-01')).toEqual({ from: '2025-12-01', to: '2025-12-31' });
  });
  it('включает текущий день в семь и тридцать дней', () => {
    expect(presetRange('last_7_days', '2026-11-03')).toEqual({ from: '2026-10-28', to: '2026-11-03' });
    expect(presetRange('last_30_days', '2026-11-03')).toEqual({ from: '2026-10-05', to: '2026-11-03' });
  });
  it.each(['2026-02-29', '2026-13-01', '2026-1-01', '', '0001-01-01'])('отклоняет несуществующую или неподдерживаемую дату %s', (date) => expect(isCalendarDate(date)).toBe(false));
  it('допускает один день и максимальные 367 дней по контракту API', () => {
    expect(validateRange({ from: '2026-01-01', to: '2026-01-01' })).toBeNull();
    expect(validateRange({ from: '2026-01-01', to: '2027-01-02' })).toBeNull();
    expect(validateRange({ from: '2026-01-01', to: '2027-01-03' })).toContain('367');
  });
  it('отклоняет перевёрнутый или неполный диапазон', () => {
    expect(validateRange({ from: '2026-11-02', to: '2026-11-01' })).toContain('раньше');
    expect(readPeriod(new URLSearchParams('period=custom&from_date=2026-01-01')).error).not.toBeNull();
  });
  it('восстанавливает свой период из URL без подмены серверными значениями по умолчанию', () => {
    const range = { from: '2026-10-01', to: '2026-10-31' };
    expect(readPeriod(periodSearch('custom', range))).toEqual({ preset: 'custom', range, error: null });
    expect(readPeriod(new URLSearchParams('period=unknown')).error).toContain('Неизвестный');
  });
});
