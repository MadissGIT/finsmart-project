import { useEffect, useState, useSyncExternalStore } from 'react';
import type { PropsWithChildren } from 'react';
import { getCurrentUser, loginUser, registerUser } from '@/entities/user/api';
import type { UserProfile } from '@/entities/user/model/types';
import { getRequestErrorMessage } from '@/shared/api/client';
import { getAuthGeneration, getAuthTokens, setAuthTokens, subscribeAuth } from '@/shared/api/tokens';
import { ApiContractError } from '@/shared/lib/guards';
import { AuthContext } from './model/context';

type ProfileResult = { key: string; generation: number; user: UserProfile; error?: never } | { key: string; generation: number; user?: never; error: string };

export function AuthProvider({ children }: PropsWithChildren) {
  const tokens = useSyncExternalStore(subscribeAuth, getAuthTokens, () => null);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<ProfileResult | null>(null);
  const accessToken = tokens?.access_token;
  const userId = tokens?.user_id;
  const generation = getAuthGeneration();
  const key = generation + ':' + (accessToken ?? '') + ':' + attempt;

  useEffect(() => {
    if (!accessToken || !userId) return;
    const controller = new AbortController();
    getCurrentUser(controller.signal).then((user) => {
      if (user.id !== userId) throw new ApiContractError();
      if (!controller.signal.aborted) setResult({ key, generation, user });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setResult({ key, generation, error: getRequestErrorMessage(error, 'Не удалось загрузить профиль. Попробуйте ещё раз.') });
    });
    return () => controller.abort();
  }, [accessToken, userId, key, generation]);

  const current = result?.key === key ? result : null;
  const user = tokens && result?.generation === generation && result.user?.id === userId ? result.user ?? null : null;
  const error = tokens && current?.error ? current.error : null;
  const status = !tokens ? 'anonymous' : user ? 'authenticated' : error ? 'error' : 'loading';

  return <AuthContext.Provider value={{
    status, user, error,
    signIn: async (fields) => setAuthTokens(await loginUser(fields)),
    createAccount: async (fields) => {
      const registered = await registerUser(fields);
      setAuthTokens(registered);
      return registered.user_id;
    },
    signOut: () => setAuthTokens(null),
    retryProfile: () => setAttempt((value) => value + 1),
  }}>{children}</AuthContext.Provider>;
}
