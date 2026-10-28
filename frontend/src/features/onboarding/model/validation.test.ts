import { describe, expect, it } from 'vitest';
import { validateProfile, validateRegistration } from './validation';

const valid = { email: 'maxim@example.test', password: 'Study1234', confirmPassword: 'Study1234', consent: true };

describe('демонстрационная регистрация', () => {
  it('принимает заполненную форму', () => expect(validateRegistration(valid)).toEqual({}));
  it.each(['', 'maxim', 'maxim@', 'maxim @example.test'])('отклоняет некорректный email: %s', (email) => {
    expect(validateRegistration({ ...valid, email }).email).toBeDefined();
  });
  it.each(['short1', 'abcdefgh', '12345678'])('проверяет минимальную сложность пароля: %s', (password) => {
    expect(validateRegistration({ ...valid, password, confirmPassword: password }).password).toBeDefined();
  });
  it('не пропускает несовпадение паролей и отсутствие согласия', () => {
    const errors = validateRegistration({ ...valid, confirmPassword: 'Different1', consent: false });
    expect(errors.confirmPassword).toBeDefined();
    expect(errors.consent).toBeDefined();
  });
});

describe('данные профиля', () => {
  const today = new Date(2026, 9, 28);
  it('разрешает не указывать необязательную дату рождения', () => expect(validateProfile('Максим', '', today)).toBeNull());
  it('принимает существующую дату високосного года', () => expect(validateProfile('Максим', '2000-02-29', today)).toBeNull());
  it.each(['2025-02-29', '2027-01-01', '1899-01-01', '2020-13-10'])('отклоняет некорректную дату: %s', (date) => {
    expect(validateProfile('Максим', date, today)).not.toBeNull();
  });
  it('не пропускает пустое или слишком длинное имя', () => {
    expect(validateProfile('  ', '', today)).not.toBeNull();
    expect(validateProfile('А'.repeat(61), '', today)).not.toBeNull();
  });
});
