import { NavLink } from 'react-router-dom';
import { navigation } from '@/shared/config/navigation';

export function MobileNav() {
  return (
    <nav aria-label="Мобильная навигация" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      {navigation.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end className={({ isActive }) => `flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium min-[375px]:text-xs ${isActive ? 'text-brand-700' : 'text-stone-500'}`}>
          <Icon size={21} aria-hidden="true" />{label}
        </NavLink>
      ))}
    </nav>
  );
}
