import { useEffect, useState } from 'react';
import { Bookmark, Search } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Discount } from '@/entities/discount/model/types';
import { useAuth } from '@/features/auth/model/context';
import {
  discountCategories, featuredOffers, filterDiscounts, readDiscountCategory, readSavedOffers, saveOfferIds,
} from '@/features/discounts/model/discounts';
import { useDiscountCatalog, useRecommendedDiscounts } from '@/features/discounts/model/useDiscounts';
import { OfferCard } from '@/features/discounts/ui/OfferCard';
import { OfferDetail } from '@/features/discounts/ui/OfferDetail';
import { OfferPromo } from '@/features/discounts/ui/OfferPromo';
import { Modal } from '@/shared/ui/Modal';
import './discounts.css';

const categoryIcons: Record<number, string> = {
  1: 'category-food.svg',
  2: 'category-transport.svg',
  3: 'category-home.svg',
  5: 'category-food.svg',
  7: 'category-clothes.svg',
};

function OfferGrid({ offers, offerLink }: { offers: Discount[]; offerLink: (id: string) => string }) {
  return (
    <ul className="offers-grid">
      {offers.map((offer) => <li key={offer.id}><OfferCard offer={offer} to={offerLink(offer.id)} /></li>)}
    </ul>
  );
}

function DiscountError({ error, retry }: { error: string; retry: () => void }) {
  return (
    <div className="discount-state">
      <p role="alert">{error}</p>
      <button type="button" className="button-secondary" onClick={retry}>Повторить загрузку</button>
    </div>
  );
}

export function DiscountsPage() {
  const { status, user } = useAuth();
  const accountId = status === 'authenticated' ? user?.id ?? null : null;
  return <DiscountsWorkspace key={accountId ?? 'guest'} accountId={accountId} anonymous={status === 'anonymous'} />;
}

function DiscountsWorkspace({ accountId, anonymous }: { accountId: string | null; anonymous: boolean }) {
  const [search, setSearch] = useSearchParams();
  const storageKey = 'finsmart:offers:saved:v1:' + (accountId ?? 'guest');
  const [savedIds, setSavedIds] = useState(() => readSavedOffers(storageKey));
  const [help, setHelp] = useState(false);
  const offerId = search.get('offer');
  const isPromo = search.get('view') === 'offers';
  const isDetail = offerId !== null;
  const isCatalog = !isDetail && !isPromo;
  const categoryId = readDiscountCategory(search.get('category_id'));
  const query = (search.get('q') ?? '').slice(0, 120);
  const savedOnly = search.get('saved') === '1';
  const showRecommended = isCatalog && !categoryId && !query.trim() && !savedOnly;

  const catalog = useDiscountCatalog();
  const byCategory = useDiscountCatalog(categoryId, isCatalog && !!categoryId);
  const recommendations = useRecommendedDiscounts(showRecommended ? accountId : null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [offerId, isPromo]);

  function nextSearch(changes: Record<string, string | undefined>) {
    const result = new URLSearchParams(search);
    for (const [key, value] of Object.entries(changes)) {
      if (value) result.set(key, value);
      else result.delete(key);
    }
    return result;
  }

  function pathTo(changes: Record<string, string | undefined>) {
    const queryString = nextSearch(changes).toString();
    return queryString ? '/discounts?' + queryString : '/discounts';
  }

  const listLink = pathTo({ offer: undefined, view: undefined });
  const backLink = pathTo({ offer: undefined });
  const offerLink = (id: string) => pathTo({ offer: id });

  function toggleSaved(id: string) {
    const ids = savedIds.includes(id) ? savedIds.filter((item) => item !== id) : [...savedIds, id];
    setSavedIds(ids);
    saveOfferIds(storageKey, ids);
  }

  if (!isCatalog) {
    if (catalog.loading || catalog.error) {
      return (
        <div className="discounts-page">
          <Link className="text-link" to={isDetail ? backLink : listLink}>К скидкам</Link>
          {catalog.error
            ? <DiscountError error={catalog.error} retry={catalog.retry} />
            : <p className="discount-state" role="status">Загружаем предложения…</p>}
        </div>
      );
    }
    if (isDetail) {
      const offer = catalog.data?.find(({ id }) => id === offerId);
      return offer
        ? <OfferDetail key={offer.id} offer={offer} back={backLink} saved={savedIds.includes(offer.id)} onSave={() => toggleSaved(offer.id)} />
        : <div className="discount-state">
          <h1>Акция не найдена</h1>
          <p>Возможно, срок предложения закончился.</p>
          <Link className="button-primary" to={backLink}>К скидкам</Link>
        </div>;
    }
    return <OfferPromo back={listLink} offers={featuredOffers(catalog.data ?? [], 2)} offerLink={offerLink} />;
  }

  const categories = discountCategories(catalog.data ?? []);
  const list = categoryId ? byCategory : catalog;
  const recommended = featuredOffers(recommendations.data?.items ?? [], 3);
  const recommendedIds = new Set(recommended.map(({ id }) => id));
  const offers = filterDiscounts(list.data ?? [], query)
    .filter(({ id }) => (!savedOnly || savedIds.includes(id)) && !recommendedIds.has(id));

  return (
    <div className="discounts-page">
      <div className="discount-heading">
        <div>
          <h1>Скидки</h1>
          <p>Акции и промокоды по категориям расходов</p>
        </div>
        <Link className="discount-promo-link" to={pathTo({ view: 'offers' })}>
          <img src="/figma/discounts/sparkles.svg" alt="" />
          <span>Умные скидки</span>
          <img src="/figma/discounts/chevron.svg" alt="" />
        </Link>
      </div>

      <div className="discount-tools">
        <div className="discount-search">
          <Search size={15} aria-hidden="true" />
          <label className="sr-only" htmlFor="discount-search">Поиск скидок</label>
          <input
            id="discount-search"
            type="search"
            maxLength={120}
            placeholder="Акция или магазин"
            value={query}
            onChange={(event) => setSearch(nextSearch({ q: event.target.value }), { replace: true })}
          />
        </div>
        <button
          type="button"
          className="discount-saved-toggle"
          aria-label="Избранные скидки"
          aria-pressed={savedOnly}
          onClick={() => setSearch(nextSearch({ saved: savedOnly ? undefined : '1' }))}
        >
          <Bookmark size={18} fill={savedOnly ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
      </div>

      <div className="discount-categories" role="group" aria-label="Категории скидок">
        <button type="button" aria-pressed={!categoryId} onClick={() => setSearch(nextSearch({ category_id: undefined }))}>Все</button>
        {categories.map(({ id, label }) => (
          <button
            type="button"
            key={id}
            aria-pressed={categoryId === id}
            onClick={() => setSearch(nextSearch({ category_id: String(id) }))}
          >
            {categoryIcons[id] && <img src={'/figma/discounts/' + categoryIcons[id]} alt="" />}
            {label}
          </button>
        ))}
      </div>

      {showRecommended && (
        <section className="discount-section" aria-labelledby="discount-recommended">
          <div className="discount-section-heading">
            <h2 id="discount-recommended"><img src="/figma/discounts/recommendations.svg" alt="" />Подобрано для вас</h2>
            <button className="text-link" type="button" onClick={() => setHelp(true)}>
              Как это работает?<img src="/figma/discounts/chevron.svg" alt="" />
            </button>
          </div>
          {recommendations.loading && <p className="discount-hint" role="status">Загружаем рекомендации…</p>}
          {recommendations.error && (
            <div className="discount-hint">
              <p role="alert">Не удалось загрузить рекомендации.</p>
              <button className="inline-link" type="button" onClick={recommendations.retry}>Повторить</button>
            </div>
          )}
          {anonymous && <p className="discount-hint"><Link className="inline-link" to="/auth?next=/discounts">Войдите</Link>, чтобы увидеть подборку по своим расходам.</p>}
          {recommendations.data && (recommended.length
            ? <OfferGrid offers={recommended} offerLink={offerLink} />
            : <p className="discount-hint">Пока нет акций по вашим расходам за последние 30 дней.</p>)}
        </section>
      )}

      <section className="discount-section" aria-labelledby="discount-catalog">
        <h2 id="discount-catalog">{savedOnly ? 'Избранное' : 'Все предложения'}</h2>
        {list.loading && <p className="discount-state" role="status">Загружаем предложения…</p>}
        {list.error && <DiscountError error={list.error} retry={list.retry} />}
        {list.data && offers.length > 0 && <OfferGrid offers={offers} offerLink={offerLink} />}
        {list.data && offers.length === 0 && (!recommended.length || !!categoryId || !!query || savedOnly) && (
          <div className="discount-state">
            <p>{savedOnly && !query && !categoryId ? 'В избранном пока ничего нет.' : 'Подходящих предложений не найдено.'}</p>
            {(categoryId || query) && (
              <button type="button" className="button-secondary" onClick={() => setSearch(nextSearch({ q: undefined, category_id: undefined }))}>
                Сбросить фильтры
              </button>
            )}
          </div>
        )}
      </section>
      <Modal open={help} title="Как подбираются скидки" onClose={() => setHelp(false)}>
        <p>ФинСмарт смотрит на три категории с наибольшими расходами за последние 30 дней. Если в каталоге есть предложения в этих категориях, они появятся в подборке.</p>
        {!!recommendations.data?.recommendation_basis.length && <p>Ваши категории: {recommendations.data.recommendation_basis.join(', ')}.</p>}
        <p className="discount-hint">Предложения с отметкой «Демо» служат для демонстрации.</p>
      </Modal>
    </div>
  );
}
