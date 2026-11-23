import { useCallback, useId, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getExpenseTrend } from '@/entities/analytics/api';
import type { ExpenseGrouping, ExpensePoint } from '@/entities/analytics/model/types';
import type { DateRange } from '@/features/dashboard/model/period';
import { useApiQuery } from '@/shared/api/useApiQuery';
import { formatMoney } from '@/shared/lib/format';
import './expense-trend.css';

const groups = [['day', 'По дням'], ['week', 'По неделям']] as const;
const axisDate = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const detailDate = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const axisAmount = new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 });

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
    label: bucketLabel(date, period, group),
  }));

  return (
    <>
      <div className="expense-trend-scroll">
        <div className="expense-trend-chart" style={{ minWidth: rows.length * 7 + 56 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={rows} accessibilityLayer aria-label="Столбчатый график расходов" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#e9e8f3" />
              <XAxis dataKey="date" tickFormatter={(date: string) => axisDate.format(calendarDate(date < period.from ? period.from : date))} minTickGap={16} tickMargin={8} tickLine={false} axisLine={false} tick={{ fill: '#596782', fontSize: 11 }} />
              <YAxis width={48} tickFormatter={(value: number) => axisAmount.format(value)} tickMargin={6} tickLine={false} axisLine={false} tick={{ fill: '#596782', fontSize: 11 }} />
              <Tooltip
                labelFormatter={(date) => typeof date === 'string' ? bucketLabel(date, period, group) : ''}
                formatter={(value) => formatMoney(Number(value))}
                cursor={{ fill: '#f0effb' }}
              />
              <Bar dataKey="amount" name="Расходы" fill="#5149dd" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
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
