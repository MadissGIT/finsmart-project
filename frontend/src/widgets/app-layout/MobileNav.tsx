import { NavLink } from 'react-router-dom';
import { navigation } from '@/shared/config/navigation';

export function MobileNav() {
  return (
    <nav aria-label="Мобильная навигация" className="mobile-nav">
      {navigation.map(({ to, label, icon: Icon }) =>
        <NavLink key={to} to={to} end><Icon size={19} aria-hidden="true" />{label}</NavLink>)}
    </nav>
  );
}
