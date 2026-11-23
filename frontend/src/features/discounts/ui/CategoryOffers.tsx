import { Link } from 'react-router-dom';
import { useDiscountCatalog } from '../model/useDiscounts';
import { OfferArtwork } from './OfferCard';

export function CategoryOffers({ categoryId, name }: { categoryId: number; name: string }) {
  const offers = useDiscountCatalog(categoryId);
  if (offers.data?.length === 0) return null;

  return (
    <section className="category-offers" aria-label="Скидки по категории">
      <div>
        <h3>Скидки в категории «{name}»</h3>
        {offers.loading && <p role="status">Ищем предложения…</p>}
        {offers.error && <>
          <p role="alert">Не удалось загрузить предложения.</p>
          <button type="button" className="inline-link" onClick={offers.retry}>Повторить</button>
        </>}
        {!!offers.data?.length && <>
          <p>{offers.data.slice(0, 2).map(({ partner_name, benefit }) => benefit ? partner_name + ' · ' + benefit : partner_name).join(' / ')}</p>
          {offers.data.every(({ is_demo }) => is_demo) && <small>Демонстрационные предложения</small>}
          <Link className="button-primary" to={'/discounts?category_id=' + categoryId}>Посмотреть акции</Link>
        </>}
      </div>
      <span className="category-offers-image"><OfferArtwork categoryId={categoryId} /></span>
    </section>
  );
}
