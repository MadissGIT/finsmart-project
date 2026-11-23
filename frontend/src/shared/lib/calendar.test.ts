import { expect, it } from 'vitest';
import { dateTimeInput, dateTimeToTimestamp, financialToday } from './calendar';

it('показывает московские дату и время независимо от зоны браузера', () => {
  expect(dateTimeInput('2026-11-23T00:30:00+05:00')).toBe('2026-11-22T22:30');
  expect(financialToday(new Date('2026-11-22T21:30:00Z'))).toBe('2026-11-23');
  expect(dateTimeToTimestamp('2026-11-23T00:30')).toBe('2026-11-22T21:30:00.000Z');
});

it.each(['2026-02-29T12:00', '2026-11-31T12:00', '2026-11-23T24:00', '2026-11-23T12:60', '', '2026-11-23'])('не отправляет неверное время %s', (value) => {
  expect(dateTimeToTimestamp(value)).toBeNull();
});

it('учитывает переходы на летнее время при другой зоне учёта', () => {
  expect(dateTimeToTimestamp('2026-03-08T02:30', 'America/New_York')).toBeNull();
  const timestamp = dateTimeToTimestamp('2026-11-01T01:30', 'America/New_York');
  expect(timestamp).not.toBeNull();
  expect(dateTimeInput(timestamp!, 'America/New_York')).toBe('2026-11-01T01:30');
});
