import { ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react';
import type { DashboardSummary } from '@/entities/analytics/model/types';
import { formatMoney } from '@/shared/lib/format';

export function SummaryCards({ summary }: { summary: DashboardSummary }) {
  const cards = [
    { title: 'Доходы за месяц', value: summary.total_income, icon: ArrowDownLeft, color: 'bg-brand-50 text-brand-700' },
    { title: 'Расходы за месяц', value: summary.total_expense, icon: ArrowUpRight, color: 'bg-orange-50 text-orange-700' },
    { title: 'Разница доходов и расходов', value: summary.net_balance, icon: Wallet, color: 'bg-stone-100 text-stone-600' },
  ];

  return (
    <dl className="grid gap-4 lg:grid-cols-3">
      {cards.map(({ title, value, icon: Icon, color }) => (
        <div key={title} className="panel">
          <dt className="flex items-center justify-between gap-2 text-sm text-stone-500">
            {title}<span className={`rounded-lg p-2 ${color}`}><Icon size={18} aria-hidden="true" /></span>
          </dt>
          <dd className="mt-4 text-2xl font-semibold tracking-tight tabular-nums">{formatMoney(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
