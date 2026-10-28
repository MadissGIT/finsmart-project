import { createContext, useContext } from 'react';
import type { DemoSession } from './session';

interface DemoContextValue {
  session: DemoSession;
  updateSession: (patch: Partial<DemoSession>) => void;
  resetSession: () => void;
}

export const DemoContext = createContext<DemoContextValue | null>(null);

export function useDemoSession() {
  const context = useContext(DemoContext);
  if (!context) throw new Error('DemoSessionProvider is missing');
  return context;
}
