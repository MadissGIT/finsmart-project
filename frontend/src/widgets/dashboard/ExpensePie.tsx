import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatMoney } from '@/shared/lib/format';
import type { CategoryChartItem } from './model/category-chart';

interface Props {
  items: CategoryChartItem[];
  selectedId?: string;
  compact: boolean;
  onSelect: (id: string) => void;
}

export default function ExpensePie({ items, selectedId, compact, onSelect }: Props) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <PieChart accessibilityLayer={false}>
        <Pie
          data={items}
          dataKey="value"
          nameKey="name"
          innerRadius={compact ? 43 : 70}
          outerRadius={compact ? 58 : 96}
          paddingAngle={compact ? 1 : 3}
          stroke="none"
          isAnimationActive={false}
          onClick={(_, index) => onSelect(items[index].id)}
        >
          {items.map(({ id, fill }) => <Cell key={id} fill={fill} fillOpacity={selectedId && selectedId !== id ? 0.3 : 1} cursor="pointer" />)}
        </Pie>
        <Tooltip formatter={(value) => formatMoney(Number(value))} />
      </PieChart>
    </ResponsiveContainer>
  );
}
