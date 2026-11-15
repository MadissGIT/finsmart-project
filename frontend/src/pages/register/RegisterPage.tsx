import { useState } from 'react';
import type { FormEvent } from 'react';
import { Mail } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useOnboarding } from '@/features/onboarding/model/context';
import { validateRegistration } from '@/features/onboarding/model/validation';
import type { RegistrationErrors } from '@/features/onboarding/model/validation';
import { FormField } from '@/shared/ui/FormField';
import { Modal } from '@/shared/ui/Modal';
import { RegistrationSteps } from '@/widgets/onboarding/RegistrationSteps';

export function RegisterPage() {
  const { session, updateSession, setRegistrationDraft } = useOnboarding();
  const navigate = useNavigate();
  const [email, setEmail] = useState(session.email);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [legal, setLegal] = useState<'terms' | 'privacy' | null>(null);
  const [googleNotice, setGoogleNotice] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateRegistration({ email, password, confirmPassword, consent });
    setErrors(nextErrors);
    const first = Object.keys(nextErrors)[0];
    if (first) { document.getElementById(first)?.focus(); return; }
    setRegistrationDraft({ email: email.trim(), password });
    updateSession({ email: email.trim(), stage: 'registered' });
    setPassword('');
    setConfirmPassword('');
    navigate('/register/profile');
  }

  return (
    <>
      <RegistrationSteps step={1} backTo="/welcome" />
      <h1 className="onboarding-title">Создать аккаунт</h1>
      <p className="onboarding-description">Начните управлять финансами проще</p>
      <form className="registration-form" noValidate onSubmit={submit}>
        <FormField id="email" label="Email" type="email" autoComplete="email" inputMode="email" placeholder="example@mail.ru" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} icon={<Mail size={16} />} error={errors.email} required />
        <FormField id="password" label="Пароль" type="password" autoComplete="new-password" placeholder="••••••••" maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} hint="От 10 до 128 символов: буквы и цифры." required />
        <FormField id="confirmPassword" label="Повторите пароль" type="password" autoComplete="new-password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} error={errors.confirmPassword} required />
        <div className="consent-field">
          <div className="consent-row"><input id="consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} aria-invalid={!!errors.consent} aria-describedby={errors.consent ? 'consent-error' : undefined} /><label htmlFor="consent">Я ознакомился с <button className="inline-link" type="button" onClick={() => setLegal('terms')}>информацией о сервисе</button> и <button className="inline-link" type="button" onClick={() => setLegal('privacy')}>обработке данных</button></label></div>
          {errors.consent ? <p id="consent-error" className="field-error">{errors.consent}</p> : null}
        </div>
        <button className="button-primary" type="submit">Продолжить</button>
      </form>
      <div className="form-divider"><span>или</span></div>
      <button type="button" className="button-google" onClick={() => setGoogleNotice(true)}><span className="google-letter" aria-hidden="true">G</span>Продолжить с Google</button>
      {googleNotice ? <p className="field-hint" role="status">Google-вход ещё не подключён. Используйте email и пароль.</p> : null}
      <p className="onboarding-footer">Уже есть аккаунт? <Link className="inline-link" to="/auth">Войти</Link></p>
      <Modal open={legal !== null} onClose={() => setLegal(null)} title={legal === 'privacy' ? 'Обработка данных' : 'Информация о сервисе'}>
        <p>ФинСмарт — учебный проект для учёта личных финансов. После заполнения имени на следующем шаге email, имя и пароль передаются на сервер для создания аккаунта.</p>
        <p>Пароль не сохраняется в браузере. На сервере хранится его хеш. В текущей вкладке сохраняются токены входа и выбранные настройки. Выйти из аккаунта можно в профиле.</p>
      </Modal>
    </>
  );
}
