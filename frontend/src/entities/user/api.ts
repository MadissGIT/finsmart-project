import { api } from '@/shared/api/client';
import { isCalendarDate } from '@/shared/lib/calendar';
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

function parseUserProfile(data: unknown): UserProfile {
  if (!isRecord(data) || !isUuid(data.id) || typeof data.email !== 'string'
    || typeof data.full_name !== 'string' || !data.full_name.trim() || typeof data.created_at !== 'string') throw new ApiContractError();
  return { id: data.id, email: data.email, full_name: data.full_name, created_at: data.created_at,
    birth_date: typeof data.birth_date === 'string' && isCalendarDate(data.birth_date) ? data.birth_date : null,
    goal: typeof data.goal === 'string' ? data.goal : null,
    income_range: typeof data.income_range === 'string' ? data.income_range : null,
    preferences_saved: data.preferences_saved === true,
    role: data.role === 'admin' || data.role === 'moderator' ? data.role : 'user',
  };
}

export async function getCurrentUser(signal?: AbortSignal): Promise<UserProfile> {
  const { data } = await api.get<unknown>('/users/me', { signal });
  return parseUserProfile(data);
}

export async function updateCurrentUser(fields: Pick<UserProfile, 'full_name' | 'goal' | 'income_range'>): Promise<UserProfile> {
  const { data } = await api.patch<unknown>('/users/me', fields);
  return parseUserProfile(data);
}
