import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const titles: Record<string, string> = {
  '/': 'Обзор', '/welcome': 'Добро пожаловать', '/register': 'Регистрация',
  '/register/profile': 'Немного о себе', '/register/success': 'Регистрация успешна',
  '/setup': 'Первичная настройка', '/transactions': 'Операции', '/analytics': 'Аналитика',
  '/goals': 'Цели', '/auth': 'Профиль', '/discounts': 'Скидки', '/more': 'Ещё',
};

export function RouteEffects() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = (titles[pathname] ?? 'Страница не найдена') + ' — ФинСмарт';
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
