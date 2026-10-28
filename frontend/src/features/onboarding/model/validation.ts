export interface RegistrationFields {
  email: string;
  password: string;
  confirmPassword: string;
  consent: boolean;
}

export type RegistrationErrors = Partial<Record<keyof RegistrationFields, string>>;

export function validateRegistration(fields: RegistrationFields): RegistrationErrors {
  const errors: RegistrationErrors = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim()) || fields.email.trim().length > 254) {
    errors.email = 'Укажите email в формате name@example.ru.';
  }
  if (fields.password.length < 8 || !/\p{L}/u.test(fields.password) || !/\d/.test(fields.password)) {
    errors.password = 'Минимум 8 символов, включая букву и цифру.';
  }
  if (!fields.confirmPassword || fields.password !== fields.confirmPassword) {
    errors.confirmPassword = 'Пароли должны совпадать.';
  }
  if (!fields.consent) errors.consent = 'Подтвердите согласие, чтобы продолжить демонстрацию.';
  return errors;
}

export function validateProfile(name: string, birthDate: string, today = new Date()): string | null {
  if (!name.trim() || name.trim().length > 60) return 'Укажите имя: от 1 до 60 символов.';
  if (!birthDate) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!match) return 'Укажите корректную дату рождения.';
  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day);
  if (year < 1900 || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date > today) {
    return 'Проверьте дату рождения: она не может быть в будущем.';
  }
  return null;
}

export const profileGoals = [
  { value: 'expenses', label: 'Разобраться в расходах' },
  { value: 'saving', label: 'Накопить на цель' },
  { value: 'budget', label: 'Планировать бюджет' },
  { value: 'habits', label: 'Улучшить финансовые привычки' },
];

export const incomeRanges = [
  { value: 'under-30', label: 'До 30 000 ₽' },
  { value: '30-60', label: '30 000–60 000 ₽' },
  { value: '60-100', label: '60 000–100 000 ₽' },
  { value: 'over-100', label: 'Больше 100 000 ₽' },
  { value: 'private', label: 'Предпочитаю не указывать' },
];
