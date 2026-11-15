import { Link } from 'react-router-dom';

interface Props { status: string; error: string | null; reload: () => void; }

export function DashboardNotice({ status, error, reload }: Props) {
  if (status === 'anonymous') return <div className="dashboard-notice"><div><h2>Ваш финансовый обзор</h2><p>Войдите в аккаунт, чтобы увидеть свои доходы, расходы и бюджет.</p></div><Link className="button-primary" to="/auth">Войти</Link></div>;
  if (status === 'loading') return <p className="dashboard-loading" role="status">Загружаем финансовый обзор…</p>;
  if (status === 'error') return <div className="dashboard-notice dashboard-notice-error"><p role="alert">{error}</p><button type="button" className="button-secondary" onClick={reload}>Повторить загрузку</button></div>;
  return null;
}
