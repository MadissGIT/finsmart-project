import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { PageHeading } from '@/shared/ui/PageHeading';
import { SummaryCards } from '@/widgets/dashboard/SummaryCards';
import { Diagnostics } from '@/widgets/dashboard/Diagnostics';
import { ApiStatus } from '@/features/check-api/ApiStatus';
import { demoDashboard } from '@/entities/analytics/model/demo-dashboard';

export default function DashboardPage() {
  return (
    <>
      <PageHeading title="Обзор финансов" description="Всё важное о твоих деньгах на одном экране." />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="font-medium">Октябрь 2026</p>
        <span className="rounded-full bg-stone-200/70 px-3 py-1 text-xs font-medium text-stone-600">Демонстрационные данные</span>
      </div>
      <div className="space-y-5">
        <SummaryCards summary={demoDashboard.summary} />
        <p className="text-sm leading-6 text-stone-500">Это пример из проектной документации. Личные данные появятся после подключения аккаунта и операций.</p>
        <Diagnostics diagnostics={demoDashboard.diagnostics} />
        <Link to="/analytics" className="button-primary">Посмотреть аналитику <ArrowRight size={16} aria-hidden="true" /></Link>
        <ApiStatus />
      </div>
    </>
  );
}
