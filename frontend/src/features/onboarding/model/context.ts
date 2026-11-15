import { createContext, useContext } from 'react';
import type { OnboardingSession } from './session';

interface OnboardingContextValue {
  session: OnboardingSession;
  updateSession: (patch: Partial<OnboardingSession>) => void;
  resetSession: () => void;
  registrationDraft: { email: string; password: string } | null;
  setRegistrationDraft: (draft: { email: string; password: string } | null) => void;
}

export const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) throw new Error('OnboardingProvider is missing');
  return context;
}
