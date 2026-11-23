import { financialToday, isCalendarDate } from '@/shared/lib/calendar';
export { financialToday, isCalendarDate } from '@/shared/lib/calendar';

export const periodPresets = [
  { value: 'current_month', label: 'Текущий месяц' },
  { value: 'previous_month', label: 'Прошлый месяц' },
  { value: 'last_7_days', label: 'Последние 7 дней' },
  { value: 'last_30_days', label: 'Последние 30 дней' },
  { value: 'custom', label: 'Свой период' },
] as const;

export type PeriodPreset = typeof periodPresets[number]['value'];
export interface DateRange { from: string; to: string }
export interface PeriodSelection { preset: PeriodPreset; range: DateRange; error: string | null }

function iso(date: Date) { return date.toISOString().slice(0, 10); }

export function validateRange(range: DateRange): string | null {
  if (!isCalendarDate(range.from) || !isCalendarDate(range.to)) return 'Укажите обе даты периода.';
  const days = (Date.parse(range.to) - Date.parse(range.from)) / 86_400_000;
  if (days < 0) return 'Дата окончания не может быть раньше даты начала.';
  if (days > 366) return 'Выберите период длиной не больше 367 дней.';
  return null;
}

export function presetRange(preset: Exclude<PeriodPreset, 'custom'>, today: string): DateRange {
  const [year, month] = today.split('-').map(Number);
  if (preset === 'current_month') return { from: iso(new Date(Date.UTC(year, month - 1, 1))), to: iso(new Date(Date.UTC(year, month, 0))) };
  if (preset === 'previous_month') return { from: iso(new Date(Date.UTC(year, month - 2, 1))), to: iso(new Date(Date.UTC(year, month - 1, 0))) };
  const start = new Date(today + 'T00:00:00Z');
  start.setUTCDate(start.getUTCDate() - (preset === 'last_7_days' ? 6 : 29));
  return { from: iso(start), to: today };
}

export function readPeriod(search: URLSearchParams, today = financialToday()): PeriodSelection {
  const value = search.get('period') ?? 'current_month';
  const known = periodPresets.some((item) => item.value === value);
  const preset = known ? value as PeriodPreset : 'current_month';
  const range = preset === 'custom' ? { from: search.get('from_date') ?? '', to: search.get('to_date') ?? '' } : presetRange(preset, today);
  return { preset, range, error: known ? validateRange(range) : 'Неизвестный период. Выберите вариант из списка.' };
}

export function periodSearch(preset: PeriodPreset, range: DateRange): URLSearchParams {
  const search = new URLSearchParams({ period: preset });
  if (preset === 'custom') { search.set('from_date', range.from); search.set('to_date', range.to); }
  return search;
}

export function formatRange(range: DateRange): string {
  if (validateRange(range)) return 'Выберите период';
  const formatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return formatter.format(new Date(range.from + 'T00:00:00Z')) + ' — ' + formatter.format(new Date(range.to + 'T00:00:00Z'));
}
