export const text = (form: FormData, name: string) => String(form.get(name) ?? '').trim();
export const lines = (value: string) => value.split('\n').map((part) => part.trim()).filter(Boolean);
export const displayDate = (value: string | null) => value
  ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  : '—';
