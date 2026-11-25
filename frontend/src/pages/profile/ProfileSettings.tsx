import { CalendarDays, ChevronDown, Coins, Trophy, UserRound } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { updateCurrentUserName } from '@/entities/user/api';
import { readProfilePreferences, saveProfilePreferences } from '@/entities/user/model/preferences';
import type { UserProfile } from '@/entities/user/model/types';
import { useAuth } from '@/features/auth/model/context';
import { useOnboarding } from '@/features/onboarding/model/context';
import { incomeRanges, profileGoals } from '@/features/onboarding/model/validation';
import { MoreHeading } from '@/pages/more/MoreUi';
import { useApiMutation } from '@/shared/api/useApiMutation';
import { FormField } from '@/shared/ui/FormField';
import { ProfileAvatar } from './ProfilePage';
import { profilePath } from './paths';

function PreferenceField({ label, value, options, onChange, icon, disabled }: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  icon: ReactNode;
  disabled: boolean;
}) {
  const id = useId();
  return (
    <div className="profile-setting-field">
      <label htmlFor={id}>{label}</label>
      <span className="profile-setting-select">
        {icon}
        <select id={id} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
          <option value="">Не указано</option>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <ChevronDown size={14} aria-hidden="true" />
      </span>
    </div>
  );
}

export function ProfileSettings({ user }: { user: UserProfile }) {
  const auth = useAuth();
  const { session, updateSession, resetSession } = useOnboarding();
  const mutation = useApiMutation();
  const ownSession = session.stage === 'complete' && session.email.toLowerCase() === user.email.toLowerCase();
  const oldGoal = ownSession ? session.goal : '';
  const oldIncome = ownSession ? session.incomeRange : '';
  const [savedPreferences, setSavedPreferences] = useState(() =>
    readProfilePreferences(user.id) ?? { goal: oldGoal, incomeRange: oldIncome });
  const { goal: savedGoal, incomeRange: savedIncome } = savedPreferences;
  const [fullName, setFullName] = useState(user.full_name);
  const [goal, setGoal] = useState(savedGoal);
  const [incomeRange, setIncomeRange] = useState(savedIncome);
  const [notice, setNotice] = useState(false);
  const [preferencesError, setPreferencesError] = useState(false);
  const name = fullName.trim();
  const preferencesChanged = goal !== savedGoal || incomeRange !== savedIncome;
  const dirty = name !== user.full_name || preferencesChanged;

  useEffect(() => {
    if ((oldGoal || oldIncome) && !readProfilePreferences(user.id)) {
      saveProfilePreferences(user.id, { goal: oldGoal, incomeRange: oldIncome });
    }
  }, [user.id, oldGoal, oldIncome]);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name || !dirty || mutation.busy) return;
    setNotice(false);
    setPreferencesError(false);

    function finish(savedName: string) {
      setFullName(savedName);
      if (preferencesChanged) {
        const preferences = { goal, incomeRange };
        if (!saveProfilePreferences(user.id, preferences)) {
          setPreferencesError(true);
          return;
        }
        setSavedPreferences(preferences);
      }
      updateSession({ email: user.email, fullName: savedName, goal, incomeRange, stage: 'complete' });
      setNotice(true);
    }

    if (name === user.full_name) {
      finish(name);
    } else {
      void mutation.run(() => updateCurrentUserName(name), (updated) => {
        finish(updated.full_name);
        auth.retryProfile();
      });
    }
  }

  function signOut() {
    resetSession();
    auth.signOut();
    window.location.replace('/welcome');
  }

  return (
    <div className="more-page profile-page profile-settings">
      <MoreHeading title="Профиль" back={profilePath} />
      <div className="profile-identity"><ProfileAvatar /><p>{user.email}</p></div>
      <form className="profile-settings-form" onChange={() => setNotice(false)} onSubmit={save} aria-busy={mutation.busy}>
        <div className="profile-card profile-settings-fields">
          <FormField id="profile-full-name" label="Имя" value={fullName} maxLength={200} autoComplete="name"
            onChange={(event) => setFullName(event.target.value)} disabled={mutation.busy} required
            icon={<UserRound size={16} />} />
          <FormField id="profile-birth-date" label="Дата рождения" value={user.birth_date?.split('-').reverse().join('.') ?? ''}
            placeholder="Не указана" readOnly icon={<CalendarDays size={16} />} />
        </div>
        <div className="profile-card profile-settings-fields">
          <PreferenceField label="Цель" value={goal} options={profileGoals} onChange={setGoal}
            icon={<Trophy size={16} aria-hidden="true" />} disabled={mutation.busy} />
          <PreferenceField label="Уровень дохода (в месяц)" value={incomeRange} options={incomeRanges}
            onChange={setIncomeRange} icon={<Coins size={16} aria-hidden="true" />} disabled={mutation.busy} />
        </div>
        {mutation.error && <p className="field-error" role="alert">{mutation.error}</p>}
        {preferencesError && <p className="field-error" role="alert">Браузер не разрешил сохранить цель и доход.</p>}
        {notice && <p className="profile-note" role="status">Изменения сохранены.</p>}
        <button className="button-primary profile-save" type="submit" disabled={mutation.busy || !name || !dirty}>
          {mutation.busy ? 'Сохраняем…' : 'Сохранить'}
        </button>
      </form>
      <button className="profile-sign-out" type="button" onClick={signOut} disabled={mutation.busy}>Выйти</button>
    </div>
  );
}
