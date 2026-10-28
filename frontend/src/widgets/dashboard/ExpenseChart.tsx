import { useId } from 'react';
import { Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { CategoryExpense } from '@/entities/analytics/model/types';
import { formatMoney } from '@/shared/lib/format';
import { toCategoryChartData } from './model/category-chart';

interface Props {
  categories: CategoryExpense[];
  total: number;
  compact?: boolean;
  title?: string;
}

export function ExpenseChart({ categories, total, compact = false, title = 'Расходы по категориям' }: Props) {
  const id = useId();
  const data = toCategoryChartData(categories, total);
  return (
    <section className="panel min-w-0" aria-labelledby={id}>
      <h2 id={id} className="font-semibold">{title}</h2>
      {total > 0 && data.length > 0 ? (
        <div className={compact ? 'expense-compact' : ''}>
          <div className="expense-chart" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <PieChart accessibilityLayer={false}>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={compact ? 43 : 70} outerRadius={compact ? 58 : 96} paddingAngle={compact ? 1 : 3} stroke="none" isAnimationActive={false} />
                <Tooltip formatter={(value) => formatMoney(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
            <div className="expense-total">{compact ? <><strong>{formatMoney(total)}</strong><span>всего</span></> : <><span>Всего расходов</span><strong>{formatMoney(total)}</strong></>}</div>
          </div>
          <ul className="expense-legend" aria-label="Суммы расходов по категориям">
            {data.map((item) => (
              <li key={item.name}>
                <span className="expense-name"><span className="expense-dot" style={{ background: item.fill }} />{item.name}</span>
                {compact ? <span className="expense-percent">{Math.round(item.value / total * 100)}%</span> : null}
                <span className="expense-amount">{formatMoney(item.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : <div className="expense-empty"><div className="expense-empty-ring" aria-hidden="true" /><p>За этот период расходов пока нет.</p></div>}
    </section>
  );
}
