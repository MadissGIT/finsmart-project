import { useState } from 'react';
import type { FormEvent } from 'react';
import { Mail } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useDemoSession } from '@/features/onboarding/model/context';
import { incomeRanges, profileGoals } from '@/features/onboarding/model/validation';
import { FormField } from '@/shared/ui/FormField';
import { PageHeading } from '@/shared/ui/PageHeading';

export function AuthPage() {
  const { session, updateSession, resetSession } = useDemoSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState(session.email);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !password) {
      setError('Укажите корректный email и заполните пароль для демонстрации.');
      return;
    }
    updateSession({ email: email.trim(), stage: 'complete' });
    setPassword('');
    navigate('/');
  }

  if (session.stage !== 'complete') {
    return (
      <div className="mx-auto max-w-sm">
        <PageHeading title="С возвращением!" description="Войдите в свой аккаунт, чтобы продолжить." />
        <p className="mb-5 text-xs leading-5 text-slate-500">Демонстрационный вход. Пароль не проверяется на сервере и не сохраняется.</p>
        <form className="registration-form" onSubmit={signIn} noValidate>
          <FormField id="login-email" label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} icon={<Mail size={16} />} placeholder="example@mail.ru" />
          <FormField id="login-password" label="Пароль" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error ? <p className="field-error" role="alert">{error}</p> : null}
          <button className="button-primary" type="submit">Войти в демоверсию</button>
        </form>
        <p className="onboarding-footer">Нет аккаунта? <Link className="inline-link" to="/register">Создать аккаунт</Link></p>
      </div>
    );
  }

  return (
    <>
      <PageHeading title="Профиль" description="Настройки демонстрационного профиля." />
      <section className="panel max-w-lg">
        <h2 className="font-semibold">{session.fullName || 'Демо-профиль'}</h2>
        <dl className="profile-details">
          <div><dt>Email</dt><dd>{session.email || 'Не указан'}</dd></div>
          <div><dt>Цель</dt><dd>{profileGoals.find((item) => item.value === session.goal)?.label || 'Не выбрана'}</dd></div>
          <div><dt>Доход</dt><dd>{incomeRanges.find((item) => item.value === session.incomeRange)?.label || 'Не указан'}</dd></div>
        </dl>
        <p className="mb-5 text-xs leading-5 text-slate-500">Это демоверсия. Настоящего аккаунта на сервере пока нет.</p>
        <div className="flex flex-wrap gap-3">
          <Link className="button-primary" to="/register/profile">Изменить данные</Link>
          <button type="button" className="button-secondary" onClick={() => { resetSession(); navigate('/welcome'); }}>Сбросить демо</button>
        </div>
      </section>
    </>
  );
}
