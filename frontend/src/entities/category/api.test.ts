import { afterEach, expect, it } from 'vitest';
import { api } from '@/shared/api/client';
import { getCategories } from './api';

const adapter = api.defaults.adapter;
afterEach(() => { api.defaults.adapter = adapter; });

it('читает справочник существующего backend, включая OTHER', async () => {
  const categories = [{ id: 11, name: 'Другое', budget_group: 'OTHER' }];
  api.defaults.adapter = async (config) => {
    expect(config.url).toBe('/categories');
    return { data: categories, status: 200, statusText: 'OK', headers: {}, config };
  };
  await expect(getCategories()).resolves.toEqual(categories);
});

it.each(['<html>Fallback</html>', { items: [] }, [{ id: 1, name: 'Еда', budget_group: 'UNKNOWN' }]])('не принимает неверный контракт справочника: %j', async (data) => {
  api.defaults.adapter = async (config) => ({ data, status: 200, statusText: 'OK', headers: {}, config });
  await expect(getCategories()).rejects.toThrow('Unexpected categories response');
});
