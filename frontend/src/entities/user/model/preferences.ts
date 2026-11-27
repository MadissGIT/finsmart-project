import { isRecord } from '@/shared/lib/guards';

export interface ProfilePreferences {
  goal: string;
  incomeRange: string;
}

const preferencesKey = (userId: string) => 'finsmart.profile-preferences.v1:' + userId;

export function readProfilePreferences(userId: string): ProfilePreferences | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(preferencesKey(userId)) ?? 'null');
    if (!isRecord(value) || typeof value.goal !== 'string' || typeof value.incomeRange !== 'string') return null;
    return { goal: value.goal, incomeRange: value.incomeRange };
  } catch {
    return null;
  }
}
