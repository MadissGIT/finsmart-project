export interface OnboardingSession {
  email: string;
  fullName: string;
  goal: string;
  incomeRange: string;
  stage: 'new' | 'registered' | 'complete';
}

export const SESSION_KEY = 'finsmart.onboarding.v1';
export const emptySession: OnboardingSession = { email: '', fullName: '', goal: '', incomeRange: '', stage: 'new' };

// Пароль регистрации живёт только в памяти до отправки формы на сервер.
export function parseSession(value: string | null): OnboardingSession {
  if (!value) return { ...emptySession };
  try {
    const data: unknown = JSON.parse(value);
    if (typeof data !== 'object' || data === null) return { ...emptySession };
    const candidate = data as Record<string, unknown>;
    if (!['new', 'registered', 'complete'].includes(String(candidate.stage))) return { ...emptySession };
    for (const key of ['email', 'fullName', 'goal', 'incomeRange']) {
      if (typeof candidate[key] !== 'string' || candidate[key].length > 254) return { ...emptySession };
    }
    return {
      email: String(candidate.email), fullName: String(candidate.fullName),
      goal: String(candidate.goal), incomeRange: String(candidate.incomeRange),
      stage: candidate.stage as OnboardingSession['stage'],
    };
  } catch {
    return { ...emptySession };
  }
}
