import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { navigation } from '@/shared/config/navigation';

export function RouteEffects() {
  const { pathname } = useLocation();

  useEffect(() => {
    const page = navigation.find((item) => item.to === pathname);
    document.title = `${page?.label ?? 'Страница не найдена'} — ФинСмарт`;
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
