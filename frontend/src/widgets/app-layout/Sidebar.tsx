import { ChartPie, CircleUserRound } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { navigation } from '@/shared/config/navigation';
import { Brand } from '@/shared/ui/Brand';

export function Sidebar() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    'flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium ' +
    (isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-brand-50');
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-100 bg-white px-5 py-7 md:flex">
      <Link className="sidebar-brand" to="/" aria-label="ФинСмарт — на главную"><Brand /></Link>
      <nav aria-label="Основная навигация" className="space-y-1">
        {navigation.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end className={linkClass}><Icon size={20} aria-hidden="true" />{label}</NavLink>)}
      </nav>
      <nav aria-label="Дополнительная навигация" className="mt-5 space-y-1 border-t border-slate-100 pt-5">
        <NavLink to="/analytics" className={linkClass}><ChartPie size={20} aria-hidden="true" />Аналитика</NavLink>
        <NavLink to="/auth" className={linkClass}><CircleUserRound size={20} aria-hidden="true" />Профиль</NavLink>
      </nav>
      <p className="sidebar-note">Умные деньги — большие цели</p>
    </aside>
  );
}
