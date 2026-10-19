import { api } from './client';

export async function checkReadiness(): Promise<void> {
  const { data } = await api.get<unknown>('/health/ready');
  if (typeof data !== 'object' || data === null || !('status' in data) || data.status !== 'ok') {
    throw new Error('Unexpected readiness response');
  }
}
