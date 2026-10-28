import { ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { RegistrationSteps } from '@/widgets/onboarding/RegistrationSteps';

export function RegistrationSuccessPage() {
  return (
    <>
      <RegistrationSteps step={3} />
      <img className="success-illustration" src="/illustrations/success.png" width="220" height="165" alt="Галочка успешного завершения" />
      <h1 className="onboarding-title success-title">Регистрация<br />успешна!</h1>
      <p className="onboarding-description success-description">Теперь Вы можете начать использовать ФинСмарт и управлять своими финансами</p>
      <div className="onboarding-info"><ShieldCheck size={22} aria-hidden="true" /><div><h2>Всё готово к знакомству</h2><p>Вы прошли демонстрационную регистрацию. Пароль не сохраняется и не отправляется на сервер.</p></div></div>
      <div className="success-actions"><Link className="button-primary" to="/setup">Начать</Link><Link className="text-link" to="/">Пропустить</Link></div>
    </>
  );
}
