import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ExpensePoint } from '@/entities/analytics/model/types';
import { formatMoney } from '@/shared/lib/format';

interface TrendRow extends ExpensePoint {
  tick: string;
  label: string;
}

const axisAmount = new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 });

export default function ExpenseTrendPlot({ rows }: { rows: TrendRow[] }) {
  const dates = new Map(rows.map((row) => [row.date, row]));
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <BarChart data={rows} accessibilityLayer aria-label="Столбчатый график расходов" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#e9e8f3" />
        <XAxis dataKey="date" tickFormatter={(date: string) => dates.get(date)?.tick ?? date} minTickGap={16} tickMargin={8} tickLine={false} axisLine={false} tick={{ fill: '#596782', fontSize: 11 }} />
        <YAxis width={48} tickFormatter={(value: number) => axisAmount.format(value)} tickMargin={6} tickLine={false} axisLine={false} tick={{ fill: '#596782', fontSize: 11 }} />
        <Tooltip
          labelFormatter={(date) => typeof date === 'string' ? dates.get(date)?.label ?? date : ''}
          formatter={(value) => formatMoney(Number(value))}
          cursor={{ fill: '#f0effb' }}
        />
        <Bar dataKey="amount" name="Расходы" fill="#5149dd" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
