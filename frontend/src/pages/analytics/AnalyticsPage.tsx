import { PageHeading } from '@/shared/ui/PageHeading';
import { ExpenseChart } from '@/widgets/dashboard/ExpenseChart';
import { BudgetOverview } from '@/widgets/dashboard/BudgetOverview';
import { demoDashboard } from '@/entities/analytics/model/demo-dashboard';

export default function AnalyticsPage() {
  return (
    <>
      <PageHeading title="Аналитика" description="Структура расходов и распределение бюджета за месяц." />
      <p className="mb-6 text-sm leading-6 text-stone-500">Демонстрационные данные за октябрь 2026. Подключение личной статистики — в следующем этапе.</p>
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <ExpenseChart categories={demoDashboard.by_categories} total={demoDashboard.summary.total_expense} />
        <BudgetOverview budget={demoDashboard.budget_50_30_20} />
      </div>
    </>
  );
}
