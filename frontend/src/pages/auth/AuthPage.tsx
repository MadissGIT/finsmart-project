import { useState } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import { Mail } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/features/auth/model/context';
import { useOnboarding } from '@/features/onboarding/model/context';
import { incomeRanges, profileGoals } from '@/features/onboarding/model/validation';
import { getRequestErrorMessage } from '@/shared/api/client';
import { FormField } from '@/shared/ui/FormField';
import { PageHeading } from '@/shared/ui/PageHeading';

export function AuthPage() {
  const auth = useAuth();
  const { session, updateSession, resetSession } = useOnboarding();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const [email, setEmail] = useState(session.email);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function signOut() { auth.signOut(); resetSession(); navigate('/welcome'); }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || password.length < 10 || password.length > 128) {
      setError('Укажите корректный email и пароль от 10 до 128 символов.');
      return;
    }
    setBusy(true); setError('');
    try {
      await auth.signIn({ email: email.trim(), password });
      const sameAccount = session.email.toLowerCase() === email.trim().toLowerCase();
      updateSession({ email: email.trim(), stage: 'complete', ...(!sameAccount ? { fullName: '', goal: '', incomeRange: '' } : {}) });
      setPassword('');
      const next = search.get('next');
      navigate(next && ['/', '/setup', '/analytics', '/transactions', '/discounts', '/goals'].includes(next) ? next : '/');
    } catch (err) {
      setError(axios.isAxiosError(err) && err.response?.status === 401 ? 'Неверный email или пароль.' : getRequestErrorMessage(err, 'Не удалось войти. Попробуйте ещё раз.'));
    } finally { setBusy(false); }
  }

  if (auth.status === 'loading' || auth.status === 'error') {
    return <section className="panel"><PageHeading title="Профиль" description="Вход в ФинСмарт" />
      {auth.error ? <><p role="alert">{auth.error}</p><button type="button" className="button-primary mt-4" onClick={auth.retryProfile}>Повторить</button></> : <p role="status">Загружаем профиль…</p>}
      <button type="button" className="button-secondary ml-3" onClick={signOut}>Выйти</button>
    </section>;
  }

  if (!auth.user) {
    return <div className="mx-auto max-w-sm">
      <PageHeading title="С возвращением!" description="Войдите в свой аккаунт, чтобы продолжить." />
      <form className="registration-form" onSubmit={signIn} noValidate aria-busy={busy}>
        <FormField id="login-email" label="Email" type="email" autoComplete="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} icon={<Mail size={16} />} placeholder="example@mail.ru" disabled={busy} required />
        <FormField id="login-password" label="Пароль" type="password" autoComplete="current-password" maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} required />
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        <button className="button-primary" type="submit" disabled={busy}>{busy ? 'Входим…' : 'Войти'}</button>
      </form>
      <p className="onboarding-footer">Нет аккаунта? <Link className="inline-link" to="/register">Создать аккаунт</Link></p>
    </div>;
  }

  const ownPreferences = session.email.toLowerCase() === auth.user.email.toLowerCase();
  return <>
    <PageHeading title="Профиль" description="Данные аккаунта и настройка приложения." />
    <section className="panel max-w-lg">
      <h2 className="font-semibold">{auth.user.full_name}</h2>
      <dl className="profile-details">
        <div><dt>Email</dt><dd>{auth.user.email}</dd></div>
        <div><dt>Цель использования</dt><dd>{ownPreferences ? profileGoals.find((item) => item.value === session.goal)?.label || 'Не выбрана' : 'Не выбрана'}</dd></div>
        <div><dt>Диапазон дохода</dt><dd>{ownPreferences ? incomeRanges.find((item) => item.value === session.incomeRange)?.label || 'Не указан' : 'Не указан'}</dd></div>
      </dl>
      <p className="mb-5 text-xs leading-5 text-slate-500">Предпочтения из анкеты сохраняются в текущей вкладке. Финансовый обзор рассчитывается по операциям в аккаунте.</p>
      <div className="flex flex-wrap gap-3"><Link className="button-primary" to="/setup">Загрузить выписку</Link><button type="button" className="button-secondary" onClick={signOut}>Выйти</button></div>
    </section>
  </>;
}
