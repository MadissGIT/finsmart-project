import { ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react';
import type { DashboardSummary } from '@/entities/analytics/model/types';
import { formatMoney } from '@/shared/lib/format';

const balance = { key: 'net_balance', title: 'Баланс', icon: Wallet, color: 'summary-tile-balance' } as const;
const expenses = { key: 'total_expense', title: 'Расходы', icon: ArrowUpRight, color: 'summary-tile-expenses' } as const;
const overviewCards = [balance, expenses];
const analyticsCards = [
  { key: 'total_income', title: 'Доходы', icon: ArrowDownLeft, color: 'summary-tile-balance' },
  expenses,
  { ...balance, color: 'summary-tile-net' },
] as const;

export function SummaryCards({ summary, loading = false, detailed = false }: {
  summary?: DashboardSummary | null;
  loading?: boolean;
  detailed?: boolean;
}) {
  const cards = detailed ? analyticsCards : overviewCards;

  return (
    <dl className={detailed ? 'dashboard-summary dashboard-summary-detailed' : 'dashboard-summary'}
      aria-label="Финансовые показатели" aria-busy={loading}>
      {cards.map(({ key, title, icon: Icon, color }) => (
        <div key={key} className={'summary-tile ' + color}>
          <Icon aria-hidden="true" />
          <div>
            <dt>{title}</dt>
            <dd className={summary && summary[key] < 0 ? 'summary-negative' : undefined}>
              {loading ? '…' : summary ? formatMoney(summary[key]) : '—'}
            </dd>
            <small>За выбранный период</small>
          </div>
        </div>
      ))}
    </dl>
  );
}
