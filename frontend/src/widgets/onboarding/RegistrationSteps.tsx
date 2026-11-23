import { ArrowLeft, Check, Ellipsis } from 'lucide-react';
import { Link } from 'react-router-dom';

export function RegistrationSteps({ step, backTo }: { step: 1 | 2 | 3; backTo?: string }) {
  return (
    <div className="registration-progress">
      {backTo ? <Link className="registration-back" to={backTo} aria-label="Назад"><ArrowLeft size={20} /></Link> : null}
      <ol aria-label="Этапы регистрации" className="registration-steps">
        {['Аккаунт', 'Данные', 'Готово'].map((label, index) => (
          <li key={label} className={index + 1 <= step ? 'step-active' : ''} aria-current={index + 1 === step ? 'step' : undefined}>
            <span className="step-circle" aria-hidden="true">{index + 1 < step || step === 3 ? <Check size={10} /> : <Ellipsis size={10} />}</span><span>{label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
