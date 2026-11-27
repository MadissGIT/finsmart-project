import { createContext, useContext } from 'react';
import type { LoginRequest, RegisterRequest, UserProfile } from '@/entities/user/model/types';

interface AuthContextValue {
  status: 'anonymous' | 'loading' | 'authenticated' | 'error';
  user: UserProfile | null;
  error: string | null;
  signIn: (fields: LoginRequest) => Promise<void>;
  createAccount: (fields: RegisterRequest) => Promise<string>;
  signOut: () => void;
  retryProfile: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider is missing');
  return context;
}
