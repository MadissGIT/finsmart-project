import { useState } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import { Mail } from 'lucide-react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/features/auth/model/context';
import { useOnboarding } from '@/features/onboarding/model/context';
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
  const [loginDestination, setLoginDestination] = useState<string | null>(null);

  function signOut() { auth.signOut(); resetSession(); navigate('/welcome'); }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || password.length < 10 || password.length > 128) {
      setError('Укажите корректный email и пароль от 10 до 128 символов.');
      return;
    }
    const next = search.get('next');
    const allowed = ['/', '/setup', '/analytics', '/transactions', '/discounts', '/goals',
      '/admin', '/more/support', '/more/settings', '/more/profile', '/more/profile/settings', '/more/profile/achievements',
      '/more/profile/achievements/statistics', '/more/profile/challenges'];
    setLoginDestination(next && allowed.includes(next) ? next : '/');
    setBusy(true); setError('');
    try {
      await auth.signIn({ email: email.trim(), password });
      const sameAccount = session.email.toLowerCase() === email.trim().toLowerCase();
      updateSession({ email: email.trim(), stage: 'complete', ...(!sameAccount ? { fullName: '', goal: '', incomeRange: '' } : {}) });
      setPassword('');
    } catch (err) {
      setError(axios.isAxiosError(err) && err.response?.status === 401
        ? (err.response.data?.detail === 'Учетная запись заблокирована'
          ? 'Учетная запись заблокирована.' : 'Неверный email или пароль.') : getRequestErrorMessage(err, 'Не удалось войти. Попробуйте ещё раз.'));
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

  return <Navigate to={loginDestination ?? '/more/profile'} replace />;
}
