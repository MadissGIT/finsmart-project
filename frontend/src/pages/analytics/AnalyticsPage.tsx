import { PeriodFilter } from '@/features/dashboard/PeriodFilter';
import { useDashboard } from '@/features/dashboard/model/useDashboard';
import { CategoryOffers } from '@/features/discounts/ui/CategoryOffers';
import { PageHeading } from '@/shared/ui/PageHeading';
import { ExpenseChart } from '@/widgets/dashboard/ExpenseChart';
import { BudgetOverview } from '@/widgets/dashboard/BudgetOverview';
import { SummaryCards } from '@/widgets/dashboard/SummaryCards';
import { DashboardNotice } from '@/widgets/dashboard/DashboardNotice';
import { formatMoney } from '@/shared/lib/format';
import { getAuthGeneration } from '@/shared/api/tokens';
import { ExpenseTrend } from '@/widgets/dashboard/ExpenseTrend';

export default function AnalyticsPage() {
  const dashboard = useDashboard();
  const { status, data, selection, user, canLoadAnalytics } = dashboard;
  const hasOperations = !!data && (data.summary.total_income > 0 || data.summary.total_expense > 0);
  return <div className="analytics-page">
    <PageHeading title="Аналитика" description="Структура расходов и распределение бюджета за выбранный период." />
    <PeriodFilter selection={selection} onChange={dashboard.setSearch} />
    <DashboardNotice status={status} error={dashboard.error} reload={dashboard.reload} />
    <SummaryCards summary={data?.summary} loading={status === 'loading'} />
    {status === 'ready' || status === 'anonymous' ? <div className="grid items-start gap-5 xl:grid-cols-2">
      <ExpenseChart
        key={selection.range.from + selection.range.to}
        categories={data?.by_categories ?? []}
        total={data?.summary.total_expense ?? 0}
        emptyText={status === 'anonymous' ? 'Данные появятся после входа в аккаунт.' : undefined}
        renderCategory={(category) => <CategoryOffers key={category.category_id} categoryId={category.category_id} name={category.name} />}
      />
      <BudgetOverview budget={hasOperations ? data?.budget_50_30_20 : undefined} />
    </div> : null}
    {hasOperations && data?.deficit_financing ? <p className="budget-context-note">Доходы не учтены: база бюджета — расходы за период.</p> : null}
    {data && data.unallocated_expense > 0 ? <p className="budget-context-note">Вне групп 50/30/20: {formatMoney(data.unallocated_expense)}. Эти расходы включены в общую сумму и диаграмму.</p> : null}
    {canLoadAnalytics && <ExpenseTrend key={user?.id + ':' + getAuthGeneration()} period={selection.range} />}
  </div>;
}
