import { BadgeAlert, BookText, ChevronRight, MessageSquareHeart, MessagesSquare, Settings, ShieldCheck, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/model/context';
import { profilePath } from '@/pages/profile/paths';
import { MoreHeading } from './MoreUi';
import './more.css';

const links = [
  { to: profilePath, title: 'Профиль', icon: UserRound },
  { to: '/more/knowledge', title: 'База знаний', description: 'Статьи и советы', icon: BookText },
  { to: '/more/faq', title: 'Вопрос-ответ', description: 'Частые вопросы', icon: MessagesSquare },
  { to: '/more/support', title: 'Поддержка', description: 'Помощь и обратная связь', icon: MessageSquareHeart },
  { to: '/more/about', title: 'О приложении', icon: BadgeAlert },
];

export function MorePage() {
  const role = useAuth().user?.role;
  const items = role === 'admin' || role === 'moderator'
    ? [...links, { to: '/admin', title: 'Администрирование', description: 'Панель управления', icon: ShieldCheck }]
    : links;
  return (
    <div className="more-page more-home-page">
      <MoreHeading title="Ещё" action={
        <Link to="/more/settings" className="icon-button" aria-label="Настройки">
          <Settings size={23} strokeWidth={1.7} aria-hidden="true" />
        </Link>
      } />
      <nav className="more-menu" aria-label="Другие разделы">
        {items.map(({ to, title, description, icon: Icon }) => (
          <Link key={to} to={to} className="more-menu-item">
            <span className="more-menu-icon"><Icon size={22} strokeWidth={1.65} aria-hidden="true" /></span>
            <span className="more-menu-copy"><strong>{title}</strong>{description && <span>{description}</span>}</span>
            <ChevronRight className="more-menu-chevron" size={17} strokeWidth={1.35} aria-hidden="true" />
          </Link>
        ))}
      </nav>
    </div>
  );
}
