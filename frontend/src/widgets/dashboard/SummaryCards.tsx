import { ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react';
import type { DashboardSummary } from '@/entities/analytics/model/types';
import { formatMoney } from '@/shared/lib/format';

export function SummaryCards({ summary, loading = false }: { summary?: DashboardSummary | null; loading?: boolean }) {
  const cards = [
    { key: 'total_income', title: 'Доходы', hint: 'За выбранный период', icon: ArrowDownLeft, color: 'summary-tile-balance' },
    { key: 'total_expense', title: 'Расходы', hint: 'За выбранный период', icon: ArrowUpRight, color: 'summary-tile-expenses' },
    { key: 'net_balance', title: 'Баланс', hint: 'Доходы минус расходы', icon: Wallet, color: 'summary-tile-net' },
  ] as const;
  return <dl className="dashboard-summary" aria-label="Финансовые показатели" aria-busy={loading}>
    {cards.map(({ key, title, hint, icon: Icon, color }) => <div key={key} className={'summary-tile ' + color}>
      <Icon aria-hidden="true" /><div><dt>{title}</dt><dd className={summary && summary[key] < 0 ? 'summary-negative' : undefined}>{loading ? '…' : summary ? formatMoney(summary[key]) : '—'}</dd><small>{hint}</small></div>
    </div>)}
  </dl>;
}
