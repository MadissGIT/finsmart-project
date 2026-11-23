import type { Discount } from '@/entities/discount/model/types';
import { isUuid } from '@/shared/lib/guards';

const categoryNames: Record<number, string> = {
  1: 'Еда',
  2: 'Транспорт',
  3: 'Дом и связь',
  4: 'Здоровье',
  5: 'Кафе',
  6: 'Развлечения',
  7: 'Одежда',
};

export function discountCategories(offers: Discount[]) {
  const categories = new Map<number, string>();
  for (const offer of offers) categories.set(offer.category_id, offer.category_name);
  const order = [1, 2, 7, 3, 5, 4, 6];
  const ids = [...order.filter((id) => categories.has(id)), ...[...categories.keys()].filter((id) => !order.includes(id))];
  return ids.map((id) => ({ id, label: categoryNames[id] ?? categories.get(id) ?? '' }));
}

export function readDiscountCategory(value: string | null): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const id = Number(value);
  return id >= 1 && id <= 2147483647 ? id : undefined;
}

function searchText(value: string) {
  return value.toLocaleLowerCase('ru-RU').replaceAll('ё', 'е').trim();
}

export function filterDiscounts(offers: Discount[], search: string) {
  const query = searchText(search);
  if (!query) return offers;
  return offers.filter((offer) => (
    [offer.title, offer.partner_name, offer.category_name, categoryNames[offer.category_id] ?? '', offer.benefit]
      .some((value) => searchText(value).includes(query))
  ));
}

export function featuredOffers(offers: Discount[], limit: number) {
  const categories = new Set<number>();
  const featured: Discount[] = [];
  const others: Discount[] = [];
  for (const offer of offers) {
    if (categories.has(offer.category_id)) {
      others.push(offer);
    } else {
      categories.add(offer.category_id);
      featured.push(offer);
    }
  }
  return [...featured, ...others].slice(0, limit);
}

export function offerDate(iso: string) {
  if (iso === '9999-12-31') return 'Без срока окончания';
  const date = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(iso + 'T00:00:00Z'));
  return 'До ' + date;
}

export function partnerLink(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
  } catch {
    // В каталоге ссылка может отсутствовать.
  }
}

export function readSavedOffers(key: string): string[] {
  try {
    const ids: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(ids) ? ids.filter(isUuid) : [];
  } catch {
    return [];
  }
}

export function saveOfferIds(key: string, ids: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // В режиме с заблокированным хранилищем список действует до обновления страницы.
  }
}
