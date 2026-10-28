import type { DashboardResponse } from '@/entities/analytics/model/types';
import { formatMoney } from '@/shared/lib/format';

const groups = [
  { key: 'needs', label: 'Необходимое', color: '' },
  { key: 'wants', label: 'Желания', color: 'progress-wants' },
  { key: 'savings', label: 'Сбережения', color: 'progress-savings' },
] as const;

export function BudgetOverview({ budget }: { budget?: DashboardResponse['budget_50_30_20'] }) {
  return (
    <section className="panel" aria-labelledby="budget-title">
      <h2 id="budget-title" className="font-semibold">Бюджет 50 / 30 / 20</h2>
      <p className="mt-2 text-sm leading-6 text-stone-500">Как распределяются необходимые траты, желания и сбережения.</p>
      {budget ? <div className="mt-7 space-y-6">
        {groups.map(({ key, label, color }) => (
          <div key={key}>
            <div className="mb-2 flex justify-between gap-3 text-sm">
              <label htmlFor={`budget-${key}`} className="font-medium">{label}</label>
              <span className="tabular-nums text-stone-600">{formatMoney(budget[key].amount)}</span>
            </div>
            <progress id={`budget-${key}`} max={100} value={budget[key].percent} className={`progress-meter ${color}`}>{budget[key].percent}%</progress>
            <p className="mt-2 text-xs text-stone-500">{budget[key].percent.toLocaleString('ru-RU')}% · ориентир {budget[key].target_percent}%</p>
          </div>
        ))}
      </div> : <p className="py-16 text-center text-sm text-slate-500">Распределение появится после добавления операций.</p>}
    </section>
  );
}
