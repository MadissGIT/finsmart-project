import { useState } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  icon?: ReactNode;
  error?: string;
  hint?: string;
}

export function FormField({ id, label, icon, error, hint, type, ...inputProps }: Props) {
  const [visible, setVisible] = useState(false);
  const password = type === 'password';
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <div className={`field-control ${error ? 'field-control-invalid' : ''}`}>
        <span className="field-icon" aria-hidden="true">{password ? <LockKeyhole size={16} /> : icon}</span>
        <input {...inputProps} id={id} type={password && visible ? 'text' : type} aria-invalid={!!error} aria-describedby={error || hint ? `${id}-help` : undefined} />
        {password ? <button type="button" className="password-toggle" aria-label={`${visible ? 'Скрыть' : 'Показать'} ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <Eye size={17} /> : <EyeOff size={17} />}</button> : null}
      </div>
      {error || hint ? <p id={`${id}-help`} className={error ? 'field-error' : 'field-hint'}>{error ?? hint}</p> : null}
    </div>
  );
}
