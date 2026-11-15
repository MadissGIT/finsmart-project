import { useId, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { CategoryExpense } from '@/entities/analytics/model/types';
import { formatMoney } from '@/shared/lib/format';
import { toCategoryChartData } from './model/category-chart';

interface Props {
  categories: CategoryExpense[];
  total: number;
  compact?: boolean;
  title?: string;
  emptyText?: string;
}

export function ExpenseChart({ categories, total, compact = false, title = 'Расходы по категориям', emptyText = 'За этот период расходов пока нет.' }: Props) {
  const id = useId();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const data = toCategoryChartData(categories, total);
  const selected = data.find((item) => item.id === selectedId);
  const percent = (value: number) => (total > 0 ? value / total * 100 : 0).toLocaleString('ru-RU', { maximumFractionDigits: 1 });
  function select(key: string) { setSelectedId((current) => current === key ? null : key); }

  return <section className="panel min-w-0" aria-labelledby={id}>
    <h2 id={id} className="font-semibold">{title}</h2>
    {total > 0 && data.length > 0 ? <>
      <div className={compact ? 'expense-compact' : ''}>
        <div className="expense-chart" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <PieChart accessibilityLayer={false}>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={compact ? 43 : 70} outerRadius={compact ? 58 : 96} paddingAngle={compact ? 1 : 3} stroke="none" isAnimationActive={false} onClick={(_, index) => select(data[index].id)}>
                {data.map((item) => <Cell key={item.id} fill={item.fill} fillOpacity={selected && selected.id !== item.id ? 0.3 : 1} cursor="pointer" />)}
              </Pie>
              <Tooltip formatter={(value) => formatMoney(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
          <div className="expense-total"><strong>{formatMoney(selected?.value ?? total)}</strong><span>{selected?.name ?? 'всего расходов'}</span></div>
        </div>
        <ul className="expense-legend" aria-label="Суммы расходов по категориям">
          {data.map((item) => <li key={item.id}>
            <button type="button" className="expense-category" aria-pressed={selected?.id === item.id} onClick={() => select(item.id)}>
              <span className="expense-name"><span className="expense-dot" style={{ background: item.fill }} />{item.name}</span>
              <span className="expense-amount">{formatMoney(item.value)}</span><span className="expense-percent">{percent(item.value)}%</span>
            </button>
          </li>)}
        </ul>
      </div>
      <div className="expense-selection"><p role="status">{selected ? selected.name + ': ' + formatMoney(selected.value) + ' · ' + percent(selected.value) + '%' : 'Выберите категорию на диаграмме или в списке.'}</p>
        {selected ? <button type="button" className="inline-link" onClick={() => setSelectedId(null)}>Показать все расходы</button> : null}
      </div>
    </> : <div className="expense-empty"><div className="expense-empty-ring" aria-hidden="true" /><p>{emptyText}</p></div>}
  </section>;
}
