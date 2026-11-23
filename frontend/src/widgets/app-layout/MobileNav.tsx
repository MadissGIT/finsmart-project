import { CircleEllipsis, Tag } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { navigation } from '@/shared/config/navigation';

const compactIcons: Partial<Record<string, LucideIcon>> = {
  '/more': CircleEllipsis,
  '/discounts': Tag,
};

export function MobileNav({ compact = false }: { compact?: boolean }) {
  return (
    <nav aria-label="Мобильная навигация" className={compact ? 'mobile-nav more-mobile-nav' : 'mobile-nav'}>
      {navigation.map(({ to, label, icon }) => {
        const Icon = compact ? compactIcons[to] ?? icon : icon;
        return (
          <NavLink key={to} to={to} end={to !== '/more' && to !== '/goals'}>
            <Icon size={compact ? 16 : 19} strokeWidth={compact ? 1.55 : undefined} aria-hidden="true" />
            {label}
          </NavLink>
        );
      })}
    </nav>
  );
}
