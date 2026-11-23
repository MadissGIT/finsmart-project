import { useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { OnboardingContext } from './model/context';
import { emptySession, parseSession, SESSION_KEY } from './model/session';
import type { OnboardingSession } from './model/session';

export function OnboardingProvider({ children }: PropsWithChildren) {
  const [registrationDraft, setRegistrationDraft] = useState<{ email: string; password: string } | null>(null);
  const [session, setSession] = useState<OnboardingSession>(() => {
    try { return parseSession(window.sessionStorage.getItem(SESSION_KEY)); }
    catch { return { ...emptySession }; }
  });

  useEffect(() => {
    try { window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
    catch { /* Без доступа к storage сценарий продолжает работать в памяти. */ }
  }, [session]);

  return (
    <OnboardingContext.Provider value={{
      session,
      registrationDraft, setRegistrationDraft,
      updateSession: (patch) => setSession((current) => ({ ...current, ...patch })),
      resetSession: () => { setSession({ ...emptySession }); setRegistrationDraft(null); },
    }}>
      {children}
    </OnboardingContext.Provider>
  );
}
