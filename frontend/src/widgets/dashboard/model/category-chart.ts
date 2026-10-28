import type { CategoryExpense } from '@/entities/analytics/model/types';

export interface CategoryChartItem {
  name: string;
  value: number;
  fill: string;
}

const colors = ['#8d7bf3', '#72b6ed', '#79c5a6', '#93cc65', '#eebb65', '#ca99ed', '#98cbe1', '#cfd3dc'];

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
