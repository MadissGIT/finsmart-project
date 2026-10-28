import { useState } from 'react';
import { Bell, CircleUserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Brand } from '@/shared/ui/Brand';
import { Modal } from '@/shared/ui/Modal';

export function Header() {
  const [notifications, setNotifications] = useState(false);
  return (
    <header className="app-header">
      <Link className="header-brand" to="/" aria-label="ФинСмарт — на главную">
        <Brand /><span className="brand-caption">Умные деньги — большие цели</span>
      </Link>
      <div className="header-actions">
        <button className="icon-button" type="button" aria-label="Уведомления" onClick={() => setNotifications(true)}><Bell size={20} aria-hidden="true" /></button>
        <Link className="icon-button" to="/auth" aria-label="Профиль"><CircleUserRound size={23} aria-hidden="true" /></Link>
      </div>
      <Modal open={notifications} title="Уведомления" onClose={() => setNotifications(false)}><p>Новых уведомлений пока нет. Сейчас Вы просматриваете демонстрацию ФинСмарт.</p></Modal>
    </header>
  );
}
