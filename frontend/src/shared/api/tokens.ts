import { ApiContractError, isRecord, isUuid } from '@/shared/lib/guards';

export interface AuthTokens {
  user_id: string;
  email: string;
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
}

export const AUTH_STORAGE_KEY = 'finsmart.auth.v1';

export function parseAuthTokens(data: unknown): AuthTokens {
  if (!isRecord(data) || !isUuid(data.user_id) || typeof data.email !== 'string'
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || data.token_type !== 'bearer'
    || typeof data.access_token !== 'string' || !data.access_token || data.access_token.length > 4096
    || typeof data.refresh_token !== 'string' || !data.refresh_token || data.refresh_token.length > 4096) {
    throw new ApiContractError();
  }
  return { user_id: data.user_id, email: data.email, access_token: data.access_token,
    refresh_token: data.refresh_token, token_type: 'bearer' };
}

function restoreTokens(): AuthTokens | null {
  try {
    const value = window.sessionStorage.getItem(AUTH_STORAGE_KEY);
    return value ? parseAuthTokens(JSON.parse(value)) : null;
  } catch { return null; }
}

let currentTokens = restoreTokens();
let authGeneration = 0;
const listeners = new Set<() => void>();

export function getAuthTokens() { return currentTokens; }
export function getAuthGeneration() { return authGeneration; }

export function subscribeAuth(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function setAuthTokens(tokens: AuthTokens | null, refreshing = false) {
  if (!refreshing) authGeneration += 1;
  currentTokens = tokens;
  try {
    if (tokens) window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(tokens));
    else window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
  } catch { /* Без sessionStorage вход работает до перезагрузки вкладки. */ }
  listeners.forEach((listener) => listener());
}
