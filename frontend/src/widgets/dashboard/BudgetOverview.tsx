import type { DashboardResponse } from '@/entities/analytics/model/types';
import { formatMoney } from '@/shared/lib/format';

const groups = [
  { key: 'needs', label: 'Необходимое', color: '' },
  { key: 'wants', label: 'Желания', color: 'progress-wants' },
  { key: 'savings', label: 'Сбережения', color: 'progress-savings' },
] as const;

export function BudgetOverview({ budget }: { budget?: DashboardResponse['budget_50_30_20'] }) {
  return <section className="panel" aria-labelledby="budget-title">
    <h2 id="budget-title" className="font-semibold">Бюджет 50 / 30 / 20</h2>
    <p className="mt-2 text-sm leading-6 text-slate-500">Суммы и доли за выбранный период относительно ориентиров бюджета.</p>
    {budget ? <div className="mt-7 space-y-6">
      {groups.map(({ key, label, color }) => {
        const item = budget[key];
        const completion = item.target_amount > 0 ? item.amount / item.target_amount * 100 : 0;
        return <div key={key}>
          <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm"><label htmlFor={'budget-' + key} className="font-medium">{label}</label><span className="tabular-nums text-slate-600">{formatMoney(item.amount)}</span></div>
          <progress id={'budget-' + key} max={100} value={Math.min(100, Math.max(0, completion))} aria-valuetext={formatMoney(item.amount) + ' при ориентире ' + formatMoney(item.target_amount)} className={'progress-meter ' + color}>{completion}%</progress>
          <p className="mt-2 text-xs leading-5 text-slate-500">{item.percent.toLocaleString('ru-RU')}% базы · ориентир {item.target_percent}% ({formatMoney(item.target_amount)})</p>
          {item.deviation > 0 ? <p className="mt-1 text-xs leading-5 text-slate-500">Выше ориентира на {formatMoney(item.deviation)}</p> : null}
        </div>;
      })}
    </div> : <p className="py-16 text-center text-sm text-slate-500">Распределение появится после добавления операций.</p>}
  </section>;
}
