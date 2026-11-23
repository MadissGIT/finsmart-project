import type { ReactNode } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

export function MoreHeading({ title, back, action }: { title: string; back?: string; action?: ReactNode }) {
  return (
    <header className="more-heading">
      {back && (
        <Link to={back} className="icon-button more-back" aria-label="Назад">
          <ArrowLeft size={22} aria-hidden="true" />
        </Link>
      )}
      <h1>{title}</h1>
      {action && <div className="more-heading-action">{action}</div>}
    </header>
  );
}

export function MoreSearch({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="more-search">
      <Search size={16} aria-hidden="true" />
      <span className="sr-only">{label}</span>
      <input type="search" placeholder={label + '…'} maxLength={120} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export function MoreError({ error, retry }: { error: string; retry: () => void }) {
  return (
    <div className="more-state">
      <p role="alert">{error}</p>
      <button type="button" className="button-secondary" onClick={retry}>Повторить загрузку</button>
    </div>
  );
}
