import { api } from '@/shared/api/client';
import { parseAuthTokens } from '@/shared/api/tokens';
import { ApiContractError, isRecord, isUuid } from '@/shared/lib/guards';
import type { LoginRequest, RegisterRequest, UserProfile } from './model/types';

export async function loginUser(fields: LoginRequest) {
  const { data } = await api.post<unknown>('/auth/login', fields);
  return parseAuthTokens(data);
}

export async function registerUser(fields: RegisterRequest) {
  const { data } = await api.post<unknown>('/auth/register', fields);
  return parseAuthTokens(data);
}

export async function getCurrentUser(signal?: AbortSignal): Promise<UserProfile> {
  const { data } = await api.get<unknown>('/users/me', { signal });
  if (!isRecord(data) || !isUuid(data.id) || typeof data.email !== 'string'
    || typeof data.full_name !== 'string' || !data.full_name.trim() || typeof data.created_at !== 'string') throw new ApiContractError();
  return { id: data.id, email: data.email, full_name: data.full_name, created_at: data.created_at,
    birth_date: typeof data.birth_date === 'string' ? data.birth_date : null };
}
