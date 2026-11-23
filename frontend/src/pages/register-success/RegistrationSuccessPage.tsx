import { ShieldCheck } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/model/context';
import { RegistrationSteps } from '@/widgets/onboarding/RegistrationSteps';

export function RegistrationSuccessPage() {
  const auth = useAuth();
  if (auth.status === 'anonymous') return <Navigate to="/register" replace />;
  if (auth.status === 'loading') return <p role="status">Подтверждаем вход…</p>;
  if (auth.status === 'error') return <Navigate to="/auth" replace />;
  return (
    <>
      <RegistrationSteps step={3} />
      <img className="success-illustration" src="/illustrations/success.png" width="220" height="165" alt="Галочка успешного завершения" />
      <h1 className="onboarding-title success-title">Регистрация<br />успешна!</h1>
      <p className="onboarding-description success-description">Теперь Вы можете начать использовать ФинСмарт и управлять своими финансами</p>
      <div className="onboarding-info"><ShieldCheck size={22} aria-hidden="true" /><div><h2>Аккаунт создан</h2><p>Теперь можно добавить операции и увидеть свой финансовый обзор.</p></div></div>
      <div className="success-actions"><Link className="button-primary" to="/setup">Начать</Link><Link className="text-link" to="/">Пропустить</Link></div>
    </>
  );
}
