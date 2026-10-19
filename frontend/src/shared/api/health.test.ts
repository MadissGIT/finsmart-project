import { afterEach, describe, expect, it } from 'vitest';
import { AxiosError } from 'axios';
import { api, getApiErrorMessage } from './client';
import { checkReadiness } from './health';

const originalAdapter = api.defaults.adapter;
afterEach(() => { api.defaults.adapter = originalAdapter; });

describe('readiness', () => {
  it('обращается к readiness с общим префиксом API', async () => {
    api.defaults.adapter = async (config) => {
      expect(config.baseURL).toBe('/api/v1');
      expect(config.url).toBe('/health/ready');
      return { data: { status: 'ok' }, status: 200, statusText: 'OK', headers: {}, config };
    };
    await expect(checkReadiness()).resolves.toBeUndefined();
  });

  it.each([null, '<html>SPA fallback</html>', {}, { status: 'error' }])('не принимает произвольный HTTP 200 за готовность: %j', async (data) => {
    api.defaults.adapter = async (config) => ({ data, status: 200, statusText: 'OK', headers: {}, config });
    await expect(checkReadiness()).rejects.toThrow('Unexpected readiness response');
  });

  it('отличает таймаут от обычной ошибки соединения', () => {
    expect(getApiErrorMessage(new AxiosError('timeout', 'ECONNABORTED'))).toContain('не ответил вовремя');
    expect(getApiErrorMessage(new AxiosError('Network Error', 'ERR_NETWORK'))).toContain('Нет соединения');
  });
});
