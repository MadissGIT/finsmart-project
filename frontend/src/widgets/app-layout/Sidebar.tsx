import { Sprout } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { navigation } from '@/shared/config/navigation';

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-stone-200 bg-white px-5 py-7 md:flex">
      <Link to="/" className="mb-10 flex items-center gap-2.5 px-2 text-xl font-semibold tracking-tight" aria-label="ФинСмарт — на главную">
        <span className="rounded-xl bg-brand-700 p-2 text-white"><Sprout size={22} aria-hidden="true" /></span>
        ФинСмарт
      </Link>
      <p className="mb-3 px-3 text-xs font-medium uppercase tracking-wider text-stone-400">Мои финансы</p>
      <nav aria-label="Основная навигация" className="space-y-1">
        {navigation.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end className={({ isActive }) => `flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium ${isActive ? 'bg-brand-50 text-brand-700' : 'text-stone-500 hover:bg-stone-50 hover:text-stone-900'}`}>
            <Icon size={20} aria-hidden="true" />{label}
          </NavLink>
        ))}
      </nav>
      <p className="mt-auto px-3 text-xs leading-5 text-stone-400">Личные финансы<br />под твоим контролем</p>
    </aside>
  );
}
