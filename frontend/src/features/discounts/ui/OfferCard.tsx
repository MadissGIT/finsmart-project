import { Tag } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Discount } from '@/entities/discount/model/types';
import { offerDate } from '../model/discounts';

const assetPath = '/figma/discounts/';
const partnerLogos: Record<string, string> = {
  'пятерочка': 'pyaterochka.png',
  'пятерочка доставка': 'pyaterochka.png',
  lamoda: 'lamoda.png',
  'яндекс go': 'yandex-go.png',
};
const illustrations: Record<number, string> = {
  1: 'groceries.png',
  2: 'transport.png',
  5: 'category-promo.png',
  7: 'clothing.png',
};

export function OfferArtwork({ categoryId, eager = false }: { categoryId: number; eager?: boolean }) {
  const artwork = illustrations[categoryId];
  return artwork
    ? <img className="offer-artwork" src={assetPath + artwork} alt="" loading={eager ? 'eager' : 'lazy'} />
    : <Tag className="offer-artwork-fallback" aria-hidden="true" />;
}

export function OfferCard({ offer, to }: { offer: Discount; to: string }) {
  const logo = partnerLogos[offer.partner_name.toLowerCase().replaceAll('ё', 'е')];

  return (
    <Link to={to} className="offer-card">
      <div className="offer-summary">
        {offer.benefit && <span className="offer-benefit">{offer.benefit}</span>}
        <div className="offer-summary-row">
          <span className="offer-logo" aria-hidden="true">
            {logo
              ? <img src={assetPath + logo} width="28" height="28" alt="" loading="lazy" />
              : offer.partner_name[0]}
          </span>
          <div className="offer-copy">
            <h3>{offer.partner_name}</h3>
            <p>{offer.title}</p>
            <span className="offer-meta"><img src={assetPath + 'clock.svg'} alt="" />{offerDate(offer.valid_until)}</span>
            <span className="offer-meta"><Tag size={10} aria-hidden="true" />{offer.category_name}</span>
            <span className="offer-demo-label">{offer.is_demo ? 'Демо' : 'Условия магазина'}</span>
          </div>
        </div>
      </div>
      <span className="offer-card-image">
        <OfferArtwork categoryId={offer.category_id} />
        <span className="offer-arrow" aria-hidden="true">
          <img src={assetPath + 'circle.svg'} alt="" />
          <img src={assetPath + 'arrow-right.svg'} alt="" />
        </span>
      </span>
    </Link>
  );
}
