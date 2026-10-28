import { describe, expect, it } from 'vitest';
import { emptySession, parseSession } from './session';

describe('сохранение демонстрации', () => {
  it.each([null, '{broken', 'null', '[]', '{"stage":"unknown"}'])('восстанавливает безопасное пустое состояние: %s', (value) => {
    expect(parseSession(value)).toEqual(emptySession);
  });
  it('читает прогресс и отбрасывает посторонние поля', () => {
    const state = { email: 'maxim@example.test', fullName: 'Максим', goal: 'saving', incomeRange: '30-60', stage: 'complete' };
    const parsed = parseSession(JSON.stringify({ ...state, password: 'NeverPersist123', birthDate: '2000-01-01' }));
    expect(parsed).toEqual(state);
    expect(JSON.stringify(parsed)).not.toContain('NeverPersist123');
    expect(JSON.stringify(parsed)).not.toContain('2000-01-01');
  });
});
