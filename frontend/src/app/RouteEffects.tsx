import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const titles: Record<string, string> = {
  '/': 'Обзор', '/welcome': 'Добро пожаловать', '/register': 'Регистрация',
  '/register/profile': 'Немного о себе', '/register/success': 'Регистрация успешна',
  '/setup': 'Первичная настройка', '/transactions': 'Операции', '/analytics': 'Аналитика',
  '/goals': 'Финансовые цели', '/auth': 'Профиль', '/discounts': 'Скидки', '/more': 'Ещё',
  '/more/knowledge': 'База знаний', '/more/faq': 'Вопрос-ответ',
  '/more/support': 'Поддержка', '/more/about': 'О приложении',
};

export function RouteEffects() {
  const { pathname } = useLocation();
  useEffect(() => {
    let title = titles[pathname];
    if (!title && pathname.startsWith('/more/knowledge/')) title = 'Статья';
    if (!title && pathname.startsWith('/goals/')) title = 'Копилка';
    title ||= 'Страница не найдена';
    document.title = title + ' — ФинСмарт';
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
