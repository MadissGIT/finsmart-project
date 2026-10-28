import { useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { DemoContext } from './model/context';
import { emptySession, parseSession, SESSION_KEY } from './model/session';
import type { DemoSession } from './model/session';

export function DemoSessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<DemoSession>(() => {
    try { return parseSession(window.sessionStorage.getItem(SESSION_KEY)); }
    catch { return { ...emptySession }; }
  });

  useEffect(() => {
    try { window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
    catch { /* Без доступа к storage сценарий продолжает работать в памяти. */ }
  }, [session]);

  return (
    <DemoContext.Provider value={{
      session,
      updateSession: (patch) => setSession((current) => ({ ...current, ...patch })),
      resetSession: () => setSession({ ...emptySession }),
    }}>
      {children}
    </DemoContext.Provider>
  );
}
