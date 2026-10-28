import { useState } from 'react';
import type { FormEvent } from 'react';
import { Mail } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useDemoSession } from '@/features/onboarding/model/context';
import { validateRegistration } from '@/features/onboarding/model/validation';
import type { RegistrationErrors } from '@/features/onboarding/model/validation';
import { FormField } from '@/shared/ui/FormField';
import { Modal } from '@/shared/ui/Modal';
import { RegistrationSteps } from '@/widgets/onboarding/RegistrationSteps';

export function RegisterPage() {
  const { session, updateSession } = useDemoSession();
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
        <FormField id="password" label="Пароль" type="password" autoComplete="new-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} hint="От 8 символов: буквы и цифры. Используйте учебный пароль." required />
        <FormField id="confirmPassword" label="Повторите пароль" type="password" autoComplete="new-password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} error={errors.confirmPassword} required />
        <div className="consent-field">
          <div className="consent-row"><input id="consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} aria-invalid={!!errors.consent} aria-describedby={errors.consent ? 'consent-error' : undefined} /><label htmlFor="consent">Я принимаю <button className="inline-link" type="button" onClick={() => setLegal('terms')}>условия использования</button> и <button className="inline-link" type="button" onClick={() => setLegal('privacy')}>политику конфиденциальности</button></label></div>
          {errors.consent ? <p id="consent-error" className="field-error">{errors.consent}</p> : null}
        </div>
        <button className="button-primary" type="submit">Создать аккаунт</button>
      </form>
      <div className="form-divider"><span>или</span></div>
      <button type="button" className="button-google" onClick={() => setGoogleNotice(true)}><span className="google-letter" aria-hidden="true">G</span>Продолжить с Google</button>
      {googleNotice ? <p className="field-hint" role="status">Google-вход ещё не подключён. Для демонстрации используйте форму выше.</p> : null}
      <p className="onboarding-footer">Уже есть аккаунт? <Link className="inline-link" to="/auth">Войти</Link></p>
      <Modal open={legal !== null} onClose={() => setLegal(null)} title={legal === 'privacy' ? 'Данные в демоверсии' : 'Условия демонстрации'}>
        <p>Это учебная демонстрация интерфейса. Настоящий аккаунт не создаётся, регистрационные данные не отправляются на сервер.</p>
        <p>Email, имя и выбранные настройки сохраняются только в текущей вкладке браузера. Пароль и дата рождения не сохраняются. Сбросить демонстрацию можно в профиле.</p>
        <p>Полные документы сервиса будут добавлены командой перед подключением реальной регистрации.</p>
      </Modal>
    </>
  );
}
