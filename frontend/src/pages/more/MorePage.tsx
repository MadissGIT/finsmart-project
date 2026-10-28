import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ApiStatus } from '@/features/check-api/ApiStatus';
import { PageHeading } from '@/shared/ui/PageHeading';

export function MorePage() {
  return (
    <>
      <PageHeading title="Ещё" description="Профиль, аналитика и подключение к сервису." />
      <nav className="more-links mb-6" aria-label="Другие разделы">
        {[['/analytics', 'Аналитика'], ['/auth', 'Профиль'], ['/welcome', 'Начальный экран']].map(([to, label]) => <Link key={to} to={to}>{label}<ChevronRight size={18} aria-hidden="true" /></Link>)}
      </nav>
      <ApiStatus />
    </>
  );
}
