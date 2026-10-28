import { describe, expect, it } from 'vitest';
import { toCategoryChartData } from './category-chart';

const categories = [
  { category_id: 1, name: 'Продукты', amount: 100, percent: 50 },
  { category_id: 2, name: 'Транспорт', amount: 50, percent: 25 },
];

describe('category chart data', () => {
  it('сохраняет общую сумму, если API вернул только часть категорий', () => {
    const items = toCategoryChartData(categories, 200);
    expect(items.at(-1)).toMatchObject({ name: 'Остальные категории', value: 50 });
    expect(items.reduce((sum, item) => sum + item.value, 0)).toBe(200);
  });

  it('не добавляет остаток, если категории покрывают всю сумму', () => {
    expect(toCategoryChartData(categories, 150)).toHaveLength(2);
  });

  it('возвращает пустой график без расходов', () => {
    expect(toCategoryChartData([], 0)).toEqual([]);
  });

  it('округляет остаток до копеек', () => {
    const categories = [{ category_id: 1, name: 'Продукты', amount: 0.1, percent: 0 }];
    expect(toCategoryChartData(categories, 0.3).at(-1)?.value).toBe(0.2);
  });
});
