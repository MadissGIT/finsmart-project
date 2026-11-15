import axios, { CanceledError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { ApiContractError, isRecord } from '@/shared/lib/guards';
import { getAuthGeneration, getAuthTokens, parseAuthTokens, setAuthTokens } from './tokens';
import type { AuthTokens } from './tokens';

export const api = axios.create({
  baseURL: '/api/v1',
  timeout: 10_000,
  headers: { Accept: 'application/json' },
});

const refreshClient = axios.create({ baseURL: '/api/v1', timeout: 10_000 });
const publicAuthPath = /^\/auth\/(login|register|refresh)(\?|$)/;
type AuthRequestConfig = InternalAxiosRequestConfig & { authRetried?: boolean; authGeneration?: number };
let refreshTask: { token: string; promise: Promise<AuthTokens> } | null = null;

function refreshTokens(): Promise<AuthTokens> {
  const original = getAuthTokens();
  if (!original) return Promise.reject(new CanceledError('Сессия завершена'));
  if (refreshTask?.token === original.refresh_token) return refreshTask.promise;
  const task = { token: original.refresh_token, promise: Promise.resolve(original) };
  task.promise = refreshClient.post<unknown>('/auth/refresh', { refresh_token: original.refresh_token })
    .then(({ data }) => {
      const tokens = parseAuthTokens(data);
      if (getAuthTokens()?.refresh_token !== original.refresh_token) throw new CanceledError('Сессия изменилась');
      if (tokens.user_id !== original.user_id) throw new ApiContractError();
      setAuthTokens(tokens, true);
      return tokens;
    })
    .catch((error: unknown) => {
      if (axios.isAxiosError(error) && [401, 403, 422].includes(error.response?.status ?? 0)
        && getAuthTokens()?.refresh_token === original.refresh_token) setAuthTokens(null);
      throw error;
    })
    .finally(() => { if (refreshTask === task) refreshTask = null; });
  refreshTask = task;
  return task.promise;
}

api.interceptors.request.use((config) => {
  const authenticated = config as AuthRequestConfig;
  if (authenticated.authGeneration !== undefined && authenticated.authGeneration !== getAuthGeneration()) throw new CanceledError('Сессия изменилась');
  authenticated.authGeneration = getAuthGeneration();
  const tokens = getAuthTokens();
  if (tokens && !publicAuthPath.test(config.url ?? '')) config.headers.set('Authorization', 'Bearer ' + tokens.access_token);
  return config;
});

api.interceptors.response.use((response) => response, async (error: unknown) => {
  if (!axios.isAxiosError(error) || error.response?.status !== 401 || !error.config) throw error;
  const config = error.config as AuthRequestConfig;
  if (config.authGeneration !== getAuthGeneration()) throw new CanceledError('Сессия изменилась');
  if (publicAuthPath.test(config.url ?? '')) throw error;
  const tokens = getAuthTokens();
  if (!tokens) throw error;
  if (config.authRetried) {
    if (config.headers.get('Authorization') === 'Bearer ' + tokens.access_token) setAuthTokens(null);
    throw error;
  }
  config.authRetried = true;
  if (config.headers.get('Authorization') === 'Bearer ' + tokens.access_token) await refreshTokens();
  if (!getAuthTokens()) throw new CanceledError('Сессия завершена');
  return api.request(config);
});

export function getRequestErrorMessage(error: unknown, fallback = 'Не удалось загрузить данные. Попробуйте ещё раз.'): string {
  if (error instanceof ApiContractError) return error.message;
  if (!axios.isAxiosError(error)) return fallback;
  if (error.code === 'ECONNABORTED') return 'Сервис не ответил вовремя. Попробуйте ещё раз.';
  if (!error.response) return 'Нет соединения с сервисом. Попробуйте ещё раз.';
  const { status, data } = error.response;
  if (status === 503) return 'Сервис пока не готов. Попробуйте позже.';
  if ([409, 413, 422].includes(status) && isRecord(data) && typeof data.detail === 'string') return data.detail;
  if (status === 422) return 'Проверьте введённые данные и попробуйте ещё раз.';
  if (status === 401) return 'Войдите в аккаунт, чтобы продолжить.';
  if (status === 403) return 'Нет доступа к этим данным.';
  return fallback;
}

export function getApiErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) return 'Не удалось проверить подключение. Попробуйте ещё раз.';
  if (error.code === 'ECONNABORTED') return 'Сервис не ответил вовремя. Попробуйте ещё раз.';
  if (error.response?.status === 503) return 'Сервис пока не готов. Попробуйте позже.';
  return 'Нет соединения с сервисом. Попробуйте ещё раз.';
}
