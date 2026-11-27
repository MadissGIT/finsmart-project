import { useState } from 'react';
import { Bell, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getDiscounts } from '@/entities/discount/api';
import { useApiQuery } from '@/shared/api/useApiQuery';
import { Modal } from '@/shared/ui/Modal';
import { useNotifications } from '../model/context';
import type { FinancialNotification } from '../model/notifications';
import './notifications.css';

const assetPath = '/figma/notifications/';

function NotificationCard({ alert, onNavigate }: { alert: FinancialNotification; onNavigate?: () => void }) {
  const { statuses, dismiss, markRead } = useNotifications();
  const unread = !statuses[alert.id];

  return (
    <article className={'notification-card notification-card--' + alert.tone}
      data-unread={unread ? 'true' : undefined}>
      <span className="notification-icon" aria-hidden="true">
        {alert.tone === 'welcome' ? <Sparkles size={20} /> : <>
          <img src={assetPath + alert.tone + '-background.svg'} alt="" width={32} height={32} />
          <img src={assetPath + alert.tone + '.svg'} alt="" width={20} height={20} />
        </>}
      </span>
      <div className="notification-card-copy">
        <h3>{unread && <span className="sr-only">Непрочитано. </span>}{alert.title}</h3>
        <p>{alert.message}</p>
        <Link className="notification-cta" to={alert.to} onClick={() => { markRead(alert.id); onNavigate?.(); }}>
          {alert.action}
        </Link>
      </div>
      <button type="button" className="notification-dismiss" aria-label={'Скрыть: ' + alert.title}
        onClick={() => dismiss(alert.id)}>
        <img src={assetPath + 'dismiss.svg'} alt="" width={20} height={20} />
      </button>
    </article>
  );
}

function loadDiscounts(signal: AbortSignal) {
  return getDiscounts(undefined, signal);
}

function DiscountSuggestion({ onNavigate }: { onNavigate: () => void }) {
  const { limits } = useNotifications();
  const overspent = limits.data?.items.filter(({ status, spent, amount }) => status === 'reached' && spent > amount) ?? [];
  const { data: discounts } = useApiQuery(loadDiscounts, overspent.length > 0);
  const category = overspent.find((limit) => discounts?.some(({ category_id }) => category_id === limit.category_id));
  if (!category || !discounts) return null;
  const demo = discounts.filter(({ category_id }) => category_id === category.category_id)
    .every(({ is_demo }) => is_demo);

  return (
    <aside className="notification-card notification-card--discount">
      <div className="notification-card-copy">
        <h3>Скидки в категории с перерасходом</h3>
        <p>В категории «{category.category_name}» есть {demo ? 'демонстрационные ' : ''}предложения.</p>
        <Link className="notification-cta" to={'/discounts?category_id=' + category.category_id} onClick={onNavigate}>
          Посмотреть акции
        </Link>
      </div>
      <img className="notification-discount-image" src="/figma/discounts/category-promo.png" alt="" width={77} height={78} />
    </aside>
  );
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const { alerts, unreadCount, signedIn, limits, goals, game, refresh, markAllRead } = useNotifications();
  const loading = (limits.loading && !limits.data) || (goals.loading && !goals.data) || (game.loading && !game.data);
  const error = limits.error || goals.error || game.error;
  const close = () => setOpen(false);

  return (
    <>
      <button className="icon-button notification-bell" type="button" aria-haspopup="dialog"
        aria-label={unreadCount ? 'Уведомления, непрочитанных: ' + unreadCount : 'Уведомления'}
        onClick={() => { refresh(); setOpen(true); }}>
        <Bell size={20} aria-hidden="true" />
        {unreadCount > 0 && <span className="notification-counter" aria-hidden="true">{unreadCount}</span>}
      </button>
      <Modal open={open} title="Уведомления" onClose={close} className="notifications-dialog">
        {open && (!signedIn ? <p>Войдите, чтобы получать уведомления о лимитах, целях и достижениях.</p> : <>
          {unreadCount > 0 && <button className="notification-mark-all" type="button" onClick={markAllRead}>
            Отметить все прочитанными
          </button>}
          {loading && <p role="status">Загружаем уведомления…</p>}
          {error && <div className="notification-error">
            <p role="alert">Не удалось загрузить часть уведомлений.</p>
            <button className="button-secondary" type="button" onClick={refresh}>Повторить</button>
          </div>}
          {!alerts.length && !loading && !error && <p>Уведомлений пока нет.</p>}
          {alerts.length > 0 && <ul className="notification-list">
            {alerts.map((alert) => <li key={alert.id}><NotificationCard alert={alert} onNavigate={close} /></li>)}
          </ul>}
          <DiscountSuggestion onNavigate={close} />
        </>)}
      </Modal>
    </>
  );
}

export function DashboardNotification() {
  const { alerts, statuses } = useNotifications();
  const alert = alerts.find(({ id }) => !statuses[id]);

  return (
    <div className="dashboard-notifications" aria-live="polite">
      {alert && <NotificationCard alert={alert} />}
    </div>
  );
}
