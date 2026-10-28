import { useState } from 'react';
import type { FormEvent } from 'react';
import { CalendarDays, ChevronRight, Coins, Trophy, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useDemoSession } from '@/features/onboarding/model/context';
import { incomeRanges, profileGoals, validateProfile } from '@/features/onboarding/model/validation';
import { FormField } from '@/shared/ui/FormField';
import { RegistrationSteps } from '@/widgets/onboarding/RegistrationSteps';

export function ProfileSetupPage() {
  const { session, updateSession } = useDemoSession();
  const navigate = useNavigate();
  const [name, setName] = useState(session.fullName);
  const [birthDate, setBirthDate] = useState('');
  const [goal, setGoal] = useState(session.goal);
  const [incomeRange, setIncomeRange] = useState(session.incomeRange);
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = validateProfile(name, birthDate);
    setError(message);
    if (message) return;
    updateSession({ fullName: name.trim(), goal, incomeRange, stage: 'complete' });
    navigate('/register/success');
  }

  return (
    <>
      <RegistrationSteps step={2} backTo="/register" />
      <h1 className="onboarding-title">Немного о себе</h1>
      <p className="onboarding-description">Это поможет нам точнее анализировать Ваши расходы и давать полезные рекомендации</p>
      <form className="profile-form" noValidate onSubmit={submit}>
        <FormField id="fullName" label="Имя" placeholder="Максим" autoComplete="given-name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} icon={<UserRound size={16} />} required />
        <FormField id="birthDate" label="Дата рождения" type="date" autoComplete="bday" min="1900-01-01" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} icon={<CalendarDays size={16} />} />
        <div className="profile-preferences">
          <div className="form-field"><label htmlFor="goal">Цель</label><div className="field-control"><Trophy size={16} aria-hidden="true" /><select id="goal" value={goal} onChange={(e) => setGoal(e.target.value)}><option value="">Выберите цель</option>{profileGoals.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><ChevronRight size={16} aria-hidden="true" /></div></div>
          <div className="form-field"><label htmlFor="incomeRange">Уровень дохода (в месяц)</label><div className="field-control"><Coins size={16} aria-hidden="true" /><select id="incomeRange" value={incomeRange} onChange={(e) => setIncomeRange(e.target.value)}><option value="">Выберите диапазон</option>{incomeRanges.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><ChevronRight size={16} aria-hidden="true" /></div></div>
        </div>
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        <div className="profile-form-actions"><button className="button-primary" type="submit">Продолжить</button><Link className="text-link" to="/register/success" onClick={() => updateSession({ stage: 'complete' })}>Пропустить</Link></div>
      </form>
    </>
  );
}
