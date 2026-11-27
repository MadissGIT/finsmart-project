import { ArrowLeft, Award, BookOpen, ChartNoAxesColumn, Inbox, Layers, LogOut, Tag, Users } from 'lucide-react';
import { Link, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/features/auth/model/context';
import { useOnboarding } from '@/features/onboarding/model/context';
import { Brand } from '@/shared/ui/Brand';
import { AdminLoad } from './AdminUi';
import { ArticlesPage, BadgesPage, CategoriesPage, DiscountsPage } from './CatalogPages';
import { AnalyticsPage, TicketsPage, UsersPage } from './OperationsPages';
import './admin.css';

const sections = [
  { path: 'analytics', name: 'Сводка', icon: ChartNoAxesColumn, admin: true, component: AnalyticsPage },
  { path: 'users', name: 'Пользователи', icon: Users, admin: true, component: UsersPage },
  { path: 'categories', name: 'Категории', icon: Layers, admin: false, component: CategoriesPage },
  { path: 'discounts', name: 'Скидки и купоны', icon: Tag, admin: false, component: DiscountsPage },
  { path: 'articles', name: 'База знаний', icon: BookOpen, admin: false, component: ArticlesPage },
  { path: 'badges', name: 'Достижения', icon: Award, admin: false, component: BadgesPage },
  { path: 'tickets', name: 'Обращения', icon: Inbox, admin: false, component: TicketsPage },
];

export default function AdminRoutes() {
  const auth = useAuth();
  const { resetSession } = useOnboarding();
  const user = auth.user;
  if (auth.status === 'anonymous') return <Navigate to="/auth?next=/admin" replace />;
  if (!user) return <main className="admin-access"><AdminLoad
    loading={auth.status === 'loading'} error={auth.error ?? undefined} retry={auth.retryProfile} />
  </main>;
  if (user.role === 'user') return <main className="admin-access">
    <h1>Нет доступа к администрированию</h1>
    <p>Для работы нужна роль администратора или модератора.</p>
    <Link className="admin-button" to="/">Вернуться в ФинСмарт</Link>
    <button className="admin-button" type="button" onClick={() => { resetSession(); auth.signOut(); }}>
      Войти под другим аккаунтом
    </button>
  </main>;

  const allowed = sections.filter((section) => !section.admin || user.role === 'admin');
  const defaultPage = '/admin/' + (user.role === 'admin' ? 'analytics' : 'discounts');

  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <div className="admin-brand"><Brand /><span>Администрирование</span></div>
      <nav aria-label="Разделы администрирования">
        {allowed.map(({ path, name, icon: Icon }) => <NavLink key={path} to={'/admin/' + path}>
          <Icon size={18} aria-hidden="true" />{name}
        </NavLink>)}
      </nav>
      <Link className="admin-back" to="/"><ArrowLeft size={16} />Вернуться в ФинСмарт</Link>
    </aside>
    <div className="admin-main">
      <header className="admin-account">
        <span>{user.full_name}<small>{user.role === 'admin' ? 'Администратор' : 'Модератор'}</small></span>
        <button type="button" className="admin-button" onClick={() => { resetSession(); auth.signOut(); }}>
          <LogOut size={16} aria-hidden="true" />Выйти
        </button>
      </header>
      <main className="admin-content">
        <Routes>
          <Route index element={<Navigate to={defaultPage} replace />} />
          {allowed.map(({ path, component: Page }) => <Route key={path} path={path} element={<Page />} />)}
          <Route path="*" element={<Navigate to={defaultPage} replace />} />
        </Routes>
      </main>
    </div>
  </div>;
}
