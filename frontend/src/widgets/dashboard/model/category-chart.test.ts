import { describe, expect, it } from 'vitest';
import { demoDashboard } from '@/entities/analytics/model/demo-dashboard';
import { toCategoryChartData } from './category-chart';

describe('category chart data', () => {
  it('сохраняет общую сумму, если API вернул только часть категорий', () => {
    const items = toCategoryChartData(demoDashboard.by_categories, 54_200);
    expect(items.at(-1)).toMatchObject({ name: 'Остальные категории', value: 23_300 });
    expect(items.reduce((sum, item) => sum + item.value, 0)).toBe(54_200);
  });

  it('не добавляет остаток, если категории покрывают всю сумму', () => {
    expect(toCategoryChartData(demoDashboard.by_categories, 30_900)).toHaveLength(2);
  });

  it('возвращает пустой график без расходов', () => {
    expect(toCategoryChartData([], 0)).toEqual([]);
  });

  it('округляет остаток до копеек', () => {
    const categories = [{ category_id: 1, name: 'Продукты', amount: 0.1, percent: 0 }];
    expect(toCategoryChartData(categories, 0.3).at(-1)?.value).toBe(0.2);
  });
});
