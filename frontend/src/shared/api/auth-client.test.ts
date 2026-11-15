import { afterEach, describe, expect, it, vi } from 'vitest';
import axios, { AxiosError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';

const originalAdapter = axios.defaults.adapter;
const initial = { user_id: 'dc028083-bc14-459d-b42b-123456789abc', email: 'test@example.com', access_token: 'access-old', refresh_token: 'refresh-old', token_type: 'bearer' as const };
const rotated = { ...initial, access_token: 'access-new', refresh_token: 'refresh-new' };

function response(config: InternalAxiosRequestConfig, data: unknown, status = 200) {
  return { config, data, status, statusText: 'test', headers: {} };
}

function unauthorized(config: InternalAxiosRequestConfig) {
  return new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, response(config, { detail: 'Unauthorized' }, 401));
}

afterEach(() => { axios.defaults.adapter = originalAdapter; vi.unstubAllGlobals(); });

describe('Bearer и обновление сессии', () => {
  it('обновляет вращающийся refresh один раз для параллельных 401', async () => {
    vi.resetModules();
    let refreshCount = 0;
    axios.defaults.adapter = async (config) => {
      if (config.url === '/auth/refresh') { refreshCount += 1; return response(config, rotated); }
      if (config.headers.get('Authorization') !== 'Bearer access-new') throw unauthorized(config);
      return response(config, { ok: true });
    };
    const tokens = await import('./tokens');
    const { api } = await import('./client');
    tokens.setAuthTokens(initial);
    await expect(Promise.all([api.get('/protected-a'), api.get('/protected-b')])).resolves.toHaveLength(2);
    expect(refreshCount).toBe(1);
    expect(tokens.getAuthTokens()).toEqual(rotated);
  });

  it('не повторяет бесконечно запрос, если новый access также отклонён', async () => {
    vi.resetModules();
    let refreshCount = 0;
    axios.defaults.adapter = async (config) => {
      if (config.url === '/auth/refresh') { refreshCount += 1; return response(config, rotated); }
      throw unauthorized(config);
    };
    const tokens = await import('./tokens');
    const { api } = await import('./client');
    tokens.setAuthTokens(initial);
    await expect(api.get('/protected')).rejects.toBeInstanceOf(AxiosError);
    expect(refreshCount).toBe(1);
    expect(tokens.getAuthTokens()).toBeNull();
  });

  it('не восстанавливает вход после выхода во время обновления токена', async () => {
    vi.resetModules();
    let finishRefresh: (() => void) | undefined;
    axios.defaults.adapter = async (config) => {
      if (config.url === '/auth/refresh') return new Promise((resolve) => { finishRefresh = () => resolve(response(config, rotated)); });
      throw unauthorized(config);
    };
    const tokens = await import('./tokens');
    const { api } = await import('./client');
    tokens.setAuthTokens(initial);
    const pending = api.get('/protected').catch((error: unknown) => error);
    await vi.waitFor(() => expect(finishRefresh).toBeDefined());
    tokens.setAuthTokens(null);
    finishRefresh!();
    expect(axios.isCancel(await pending)).toBe(true);
    expect(tokens.getAuthTokens()).toBeNull();
  });

  it('сохраняет сессию при временной сетевой ошибке обновления', async () => {
    vi.resetModules();
    axios.defaults.adapter = async (config) => {
      if (config.url === '/auth/refresh') throw new AxiosError('Network Error', 'ERR_NETWORK', config);
      throw unauthorized(config);
    };
    const tokens = await import('./tokens');
    const { api } = await import('./client');
    tokens.setAuthTokens(initial);
    await expect(api.get('/protected')).rejects.toBeInstanceOf(AxiosError);
    expect(tokens.getAuthTokens()).toEqual(initial);
  });

  it('не отправляет Bearer-токен на формы входа и регистрации', async () => {
    vi.resetModules();
    axios.defaults.adapter = async (config) => {
      expect(config.headers.get('Authorization')).toBeUndefined();
      return response(config, initial);
    };
    const tokens = await import('./tokens');
    const { api } = await import('./client');
    tokens.setAuthTokens(initial);
    await api.post('/auth/login', {});
    await api.post('/auth/register', {});
  });
});
