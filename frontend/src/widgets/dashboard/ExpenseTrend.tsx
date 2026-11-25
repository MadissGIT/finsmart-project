import { lazy, Suspense, useCallback, useId, useState } from 'react';
import { getExpenseTrend } from '@/entities/analytics/api';
import type { ExpenseGrouping, ExpensePoint } from '@/entities/analytics/model/types';
import type { DateRange } from '@/features/dashboard/model/period';
import { useApiQuery } from '@/shared/api/useApiQuery';
import { formatMoney } from '@/shared/lib/format';
import './expense-trend.css';

const ExpenseTrendPlot = lazy(() => import('./ExpenseTrendPlot'));

const groups = [['day', 'По дням'], ['week', 'По неделям']] as const;
const axisDate = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const detailDate = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

function calendarDate(date: string) {
  return new Date(date + 'T00:00:00Z');
}

function bucketLabel(date: string, period: DateRange, group: ExpenseGrouping) {
  const start = calendarDate(date < period.from ? period.from : date);
  if (group === 'day') return detailDate.format(start);

  const end = calendarDate(date);
  end.setUTCDate(end.getUTCDate() + 6);
  return detailDate.formatRange(start, new Date(Math.min(end.getTime(), Date.parse(period.to))));
}

function TrendChart({ points, period, group }: { points: ExpensePoint[]; period: DateRange; group: ExpenseGrouping }) {
  const rows = points.map(({ date, amount }) => ({
    date,
    amount,
    tick: axisDate.format(calendarDate(date < period.from ? period.from : date)),
    label: bucketLabel(date, period, group),
  }));

  return (
    <>
      <div className="expense-trend-scroll">
        <div className="expense-trend-chart" style={{ minWidth: rows.length * 7 + 56 }}>
          <Suspense fallback={null}>
            <ExpenseTrendPlot rows={rows} />
          </Suspense>
        </div>
      </div>
      <details className="expense-trend-values">
        <summary>Суммы по {group === 'day' ? 'дням' : 'неделям'}</summary>
        <div className="expense-trend-table" role="region" aria-label="Таблица расходов" tabIndex={0}>
          <table>
            <thead><tr><th scope="col">Период</th><th scope="col">Расходы</th></tr></thead>
            <tbody>
              {rows.map(({ date, label, amount }) => <tr key={date}><th scope="row">{label}</th><td>{formatMoney(amount)}</td></tr>)}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

export function ExpenseTrend({ period }: { period: DateRange }) {
  const title = useId();
  const [group, setGroup] = useState<ExpenseGrouping>('day');
  const { from, to } = period;
  const load = useCallback((signal: AbortSignal) => getExpenseTrend({ from, to }, group, signal), [from, to, group]);
  const query = useApiQuery(load);
  const hasExpenses = query.data?.some(({ amount }) => amount > 0);

  return (
    <section className="panel expense-trend" aria-labelledby={title} aria-busy={query.loading}>
      <div className="expense-trend-header">
        <h2 id={title} className="font-semibold">Динамика расходов</h2>
        <div className="expense-trend-groups" role="group" aria-label="Группировка расходов">
          {groups.map(([key, label]) => (
            <button key={key} type="button" aria-pressed={group === key} onClick={() => setGroup(key)}>{label}</button>
          ))}
        </div>
      </div>
      {query.loading && <p className="expense-trend-notice" role="status">Загружаем динамику расходов…</p>}
      {query.error && <div className="expense-trend-error">
        <p role="alert">{query.error}</p>
        <button type="button" className="button-secondary" onClick={query.retry}>Повторить загрузку графика</button>
      </div>}
      {query.data && (hasExpenses
        ? <TrendChart points={query.data} period={period} group={group} />
        : <p className="expense-trend-notice">За выбранный период расходов нет.</p>)}
    </section>
  );
}
