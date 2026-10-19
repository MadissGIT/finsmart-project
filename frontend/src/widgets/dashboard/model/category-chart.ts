import type { CategoryExpense } from '@/entities/analytics/model/types';

export interface CategoryChartItem {
  name: string;
  value: number;
  fill: string;
}

const colors = ['#20815e', '#c9864a', '#6c85a0', '#a58ab1', '#b0a05b'];

export function toCategoryChartData(categories: CategoryExpense[], total: number): CategoryChartItem[] {
  const items = categories.filter((category) => category.amount > 0).map((category, index) => ({
    name: category.name,
    value: category.amount,
    fill: colors[index % colors.length],
  }));
  // В примере API перечислены только две категории; сохраняем полную сумму.
  const remainder = Math.round((total - items.reduce((sum, item) => sum + item.value, 0)) * 100) / 100;
  if (remainder > 0) items.push({ name: 'Остальные категории', value: remainder, fill: '#d6d3ce' });
  return items;
}
