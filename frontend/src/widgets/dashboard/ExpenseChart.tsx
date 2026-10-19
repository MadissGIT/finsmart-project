import { Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { CategoryExpense } from '@/entities/analytics/model/types';
import { formatMoney } from '@/shared/lib/format';
import { toCategoryChartData } from './model/category-chart';

interface Props {
  categories: CategoryExpense[];
  total: number;
}

export function ExpenseChart({ categories, total }: Props) {
  const data = toCategoryChartData(categories, total);

  return (
    <section className="panel min-w-0" aria-labelledby="expenses-title">
      <h2 id="expenses-title" className="font-semibold">Расходы по категориям</h2>
      {total > 0 && data.length > 0 ? (
        <>
          <div className="relative my-3 h-60 min-w-0" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <PieChart accessibilityLayer={false}>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={70} outerRadius={96} paddingAngle={3} stroke="none" isAnimationActive={false} />
                <Tooltip formatter={(value) => formatMoney(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xs text-stone-500">Всего расходов</span>
              <span className="mt-1 text-lg font-semibold tabular-nums">{formatMoney(total)}</span>
            </div>
          </div>
          <ul className="space-y-3 text-sm" aria-label="Суммы расходов по категориям">
            {data.map((item) => (
              <li key={item.name} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-stone-600"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.fill }} />{item.name}</span>
                <span className="shrink-0 font-medium tabular-nums">{formatMoney(item.value)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : <p className="py-16 text-center text-sm text-stone-500">За этот период расходов пока нет.</p>}
    </section>
  );
}
