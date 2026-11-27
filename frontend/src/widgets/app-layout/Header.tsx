import { CircleUserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Brand } from '@/shared/ui/Brand';
import { NotificationsBell } from '@/features/notifications/ui/Notifications';

export function Header() {
  return (
    <header className="app-header">
      <Link className="header-brand" to="/" aria-label="ФинСмарт — на главную">
        <Brand /><span className="brand-caption">Умные деньги — большие цели</span>
      </Link>
      <div className="header-actions">
        <NotificationsBell />
        <Link className="icon-button" to="/more/profile" aria-label="Профиль"><CircleUserRound size={23} aria-hidden="true" /></Link>
      </div>
    </header>
  );
}
