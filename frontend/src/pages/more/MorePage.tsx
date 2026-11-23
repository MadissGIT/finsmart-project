import { BadgeAlert, BookText, ChevronRight, MessageSquareHeart, MessagesSquare, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MoreHeading } from './MoreUi';
import './more.css';

const links = [
  { to: '/more/knowledge', title: 'База знаний', description: 'Статьи и советы', icon: BookText },
  { to: '/more/faq', title: 'Вопрос-ответ', description: 'Частые вопросы', icon: MessagesSquare },
  { to: '/more/support', title: 'Поддержка', description: 'Помощь и обратная связь', icon: MessageSquareHeart },
  { to: '/more/about', title: 'О приложении', icon: BadgeAlert },
];

export function MorePage() {
  return (
    <div className="more-page more-home-page">
      <MoreHeading title="Ещё" action={
        <Link to="/auth" className="icon-button" aria-label="Профиль">
          <Settings size={23} strokeWidth={1.7} aria-hidden="true" />
        </Link>
      } />
      <nav className="more-menu" aria-label="Другие разделы">
        {links.map(({ to, title, description, icon: Icon }) => (
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
