import { PageHeading } from '@/shared/ui/PageHeading';
import { ExpenseChart } from '@/widgets/dashboard/ExpenseChart';
import { BudgetOverview } from '@/widgets/dashboard/BudgetOverview';

export default function AnalyticsPage() {
  return (
    <>
      <PageHeading title="Аналитика" description="Структура расходов и распределение бюджета за месяц." />
      <p className="mb-6 text-sm leading-6 text-stone-500">Пока нет операций для анализа.</p>
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <ExpenseChart categories={[]} total={0} />
        <BudgetOverview />
      </div>
    </>
  );
}
