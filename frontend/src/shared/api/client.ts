import axios from 'axios';

export const api = axios.create({
  baseURL: '/api/v1',
  timeout: 10_000,
  headers: { Accept: 'application/json' },
});

export function getApiErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) return 'Не удалось проверить подключение. Попробуйте ещё раз.';
  if (error.code === 'ECONNABORTED') return 'Сервис не ответил вовремя. Попробуйте ещё раз.';
  if (error.response?.status === 503) return 'Сервис пока не готов. Попробуйте позже.';
  return 'Нет соединения с сервисом. Попробуйте ещё раз.';
}
