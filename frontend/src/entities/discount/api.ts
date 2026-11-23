import { api } from '@/shared/api/client';
import { isCalendarDate } from '@/shared/lib/calendar';
import { ApiContractError, isRecord, isUuid } from '@/shared/lib/guards';
import type { Discount, RecommendedDiscountsResponse } from './model/types';

function isDiscount(value: unknown): value is Discount {
  if (!isRecord(value) || !isUuid(value.id)) return false;

  const { category_id, category_name, partner_name, title, activation, benefit, conditions,
    discount_percent, promocode, affiliate_url, valid_until, is_demo } = value;

  return typeof category_id === 'number' && Number.isSafeInteger(category_id) && category_id > 0
    && typeof category_name === 'string' && category_name.length > 0
    && typeof partner_name === 'string' && partner_name.length > 0
    && typeof title === 'string' && title.length > 0
    && typeof activation === 'string'
    && typeof benefit === 'string'
    && typeof conditions === 'string'
    && typeof discount_percent === 'number' && Number.isInteger(discount_percent)
    && discount_percent >= 0 && discount_percent <= 100
    && (promocode === null || typeof promocode === 'string')
    && typeof affiliate_url === 'string'
    && typeof valid_until === 'string'
    && (valid_until === '9999-12-31' || isCalendarDate(valid_until))
    && typeof is_demo === 'boolean';
}

function parseDiscounts(data: unknown): Discount[] {
  if (!Array.isArray(data) || !data.every(isDiscount)) throw new ApiContractError();
  return data;
}

export async function getDiscounts(categoryId?: number, signal?: AbortSignal): Promise<Discount[]> {
  const { data } = await api.get<unknown>('/discounts', {
    params: categoryId ? { category_id: categoryId } : undefined,
    signal,
  });
  return parseDiscounts(data);
}

export async function getRecommendedDiscounts(signal?: AbortSignal): Promise<RecommendedDiscountsResponse> {
  const { data } = await api.get<unknown>('/discounts/recommended', { signal });
  if (!isRecord(data) || !Array.isArray(data.recommendation_basis)
    || !data.recommendation_basis.every((name) => typeof name === 'string')) {
    throw new ApiContractError();
  }
  return { recommendation_basis: data.recommendation_basis, items: parseDiscounts(data.items) };
}
