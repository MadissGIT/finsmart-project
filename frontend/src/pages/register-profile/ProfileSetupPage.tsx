import { useState } from 'react';
import type { FormEvent } from 'react';
import { CalendarDays, ChevronRight, Coins, Trophy, UserRound } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/model/context';
import { useOnboarding } from '@/features/onboarding/model/context';
import { incomeRanges, profileGoals, validateProfile } from '@/features/onboarding/model/validation';
import { getRequestErrorMessage } from '@/shared/api/client';
import { FormField } from '@/shared/ui/FormField';
import { RegistrationSteps } from '@/widgets/onboarding/RegistrationSteps';

export function ProfileSetupPage() {
  const { session, updateSession, registrationDraft, setRegistrationDraft } = useOnboarding();
  const auth = useAuth();
  const [name, setName] = useState(session.fullName);
  const [birthDate, setBirthDate] = useState('');
  const [goal, setGoal] = useState(session.goal);
  const [incomeRange, setIncomeRange] = useState(session.incomeRange);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [registered, setRegistered] = useState(false);

  if (registered) return <Navigate to="/register/success" replace />;
  if (!registrationDraft) return <Navigate to={auth.status === 'anonymous' ? '/register' : '/auth'} replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !registrationDraft) return;
    const message = validateProfile(name, birthDate);
    setError(message);
    if (message) return;
    setBusy(true);
    try {
      await auth.createAccount({ ...registrationDraft, full_name: name.trim(), ...(birthDate ? { birth_date: birthDate } : {}) });
      updateSession({ fullName: name.trim(), goal, incomeRange, stage: 'complete' });
      setRegistered(true);
      setRegistrationDraft(null);
    } catch (err) { setError(getRequestErrorMessage(err, 'Не удалось создать аккаунт. Попробуйте ещё раз.')); }
    finally { setBusy(false); }
  }

  return <>
    <RegistrationSteps step={2} backTo="/register" />
    <h1 className="onboarding-title">Немного о себе</h1>
    <p className="onboarding-description">Укажите имя для профиля. Остальные сведения необязательны.</p>
    <form className="profile-form" noValidate onSubmit={submit} aria-busy={busy}>
      <FormField id="fullName" label="Имя" placeholder="Ваше имя" autoComplete="given-name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} icon={<UserRound size={16} />} disabled={busy} required />
      <FormField id="birthDate" label="Дата рождения" type="date" autoComplete="bday" min="1900-01-01" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} icon={<CalendarDays size={16} />} disabled={busy} />
      <div className="profile-preferences">
        <div className="form-field"><label htmlFor="goal">Цель использования</label><div className="field-control"><Trophy size={16} aria-hidden="true" /><select id="goal" value={goal} onChange={(e) => setGoal(e.target.value)} disabled={busy}><option value="">Выберите цель</option>{profileGoals.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><ChevronRight size={16} aria-hidden="true" /></div></div>
        <div className="form-field"><label htmlFor="incomeRange">Уровень дохода (в месяц)</label><div className="field-control"><Coins size={16} aria-hidden="true" /><select id="incomeRange" value={incomeRange} onChange={(e) => setIncomeRange(e.target.value)} disabled={busy}><option value="">Выберите диапазон</option>{incomeRanges.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><ChevronRight size={16} aria-hidden="true" /></div></div>
      </div>
      <p className="field-hint">Цель и диапазон дохода сохраняются в текущей вкладке. Они не создают операции и копилки.</p>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      <div className="profile-form-actions"><button className="button-primary" type="submit" disabled={busy}>{busy ? 'Создаём аккаунт…' : 'Создать аккаунт'}</button></div>
    </form>
  </>;
}
