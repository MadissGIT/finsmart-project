export const financialTimezone = import.meta.env.VITE_FINANCIAL_TIMEZONE || 'Europe/Moscow';

export function financialToday(now = new Date(), timeZone = financialTimezone): string {
  return dateTimeParts(now, timeZone).slice(0, 3).join('-');
}

function dateTimeParts(date: Date, timeZone: string): string[] {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  return ['year', 'month', 'day', 'hour', 'minute'].map((type) => parts.find((part) => part.type === type)!.value);
}

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '9998-12-31') return false;
  const timestamp = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

export function dateTimeInput(value = new Date().toISOString(), timeZone = financialTimezone): string {
  const [year, month, day, hour, minute] = dateTimeParts(new Date(value), timeZone);
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

// datetime-local не содержит часового пояса. Приводим выбранное время к зоне учёта API.
export function dateTimeToTimestamp(input: string, timeZone = financialTimezone): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input) || !isCalendarDate(input.slice(0, 10))) return null;
  const [year, month, day, hour, minute] = input.split(/[-T:]/).map(Number);
  if (hour > 23 || minute > 59) return null;
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let instant = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const [y, m, d, h, min] = dateTimeParts(new Date(instant), timeZone).map(Number);
    instant += target - Date.UTC(y, m - 1, d, h, min);
  }
  return dateTimeInput(new Date(instant).toISOString(), timeZone) === input ? new Date(instant).toISOString() : null;
}
