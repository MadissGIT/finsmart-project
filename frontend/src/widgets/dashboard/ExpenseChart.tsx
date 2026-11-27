import { lazy, Suspense, useId, useState } from 'react';
import type { ReactNode } from 'react';
import type { CategoryExpense } from '@/entities/analytics/model/types';
import { formatMoney } from '@/shared/lib/format';
import { toCategoryChartData } from './model/category-chart';

const ExpensePie = lazy(() => import('./ExpensePie'));

interface Props {
  categories: CategoryExpense[];
  total: number;
  compact?: boolean;
  title?: string;
  emptyText?: string;
  renderCategory?: (category: CategoryExpense) => ReactNode;
}

export function ExpenseChart({ categories, total, compact = false, title = 'Расходы по категориям', emptyText = 'За этот период расходов пока нет.', renderCategory }: Props) {
  const id = useId();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const data = toCategoryChartData(categories, total);
  const selected = data.find((item) => item.id === selectedId);
  const selectedCategory = selected && categories.find((category) => 'category-' + category.category_id === selected.id);
  const percent = (value: number) => (total > 0 ? value / total * 100 : 0).toLocaleString('ru-RU', { maximumFractionDigits: 1 });
  function select(key: string) { setSelectedId((current) => current === key ? null : key); }

  return <section className="panel min-w-0" aria-labelledby={id}>
    <h2 id={id} className="font-semibold">{title}</h2>
    {total > 0 && data.length > 0 ? <>
      <div className={compact ? 'expense-compact' : ''}>
        <div className="expense-chart" aria-hidden="true">
          <Suspense fallback={null}>
            <ExpensePie items={data} selectedId={selected?.id} compact={compact} onSelect={select} />
          </Suspense>
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
      {selectedCategory && renderCategory?.(selectedCategory)}
    </> : <div className="expense-empty"><div className="expense-empty-ring" aria-hidden="true" /><p>{emptyText}</p></div>}
  </section>;
}
