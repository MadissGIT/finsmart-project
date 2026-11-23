import { Link } from 'react-router-dom';
import type { Discount } from '@/entities/discount/model/types';
import { OfferCard } from './OfferCard';

export function OfferPromo({ offers, back, offerLink }: {
  offers: Discount[];
  back: string;
  offerLink: (id: string) => string;
}) {
  return (
    <div className="offer-detail offer-promo">
      <div className="offer-detail-hero">
        <div className="offer-detail-toolbar">
          <Link to={back} className="icon-button" aria-label="К скидкам">
            <img src="/figma/transactions/de43d.svg" alt="" />
          </Link>
        </div>
        <img className="offer-hero-ellipse" src="/figma/discounts/promo-ellipse.svg" alt="" />
        <img className="offer-hero-orbit" src="/figma/discounts/promo-orbit.svg" alt="" />
        <img className="offer-promo-image" src="/figma/discounts/promo.png" alt="" />
        <div className="offer-promo-heading">
          <h1>Умные скидки</h1>
          <p>Акции и промокоды от ФинСмарт</p>
        </div>
      </div>
      <section className="offer-detail-body" aria-labelledby="offer-promo-title">
        <h2 id="offer-promo-title">Предложения каталога</h2>
        {offers.length === 0 && <p>В каталоге пока нет предложений.</p>}
        <div className="offers-grid">
          {offers.map((offer) => <OfferCard key={offer.id} offer={offer} to={offerLink(offer.id)} />)}
        </div>
        <Link className="button-primary" to={back}>Перейти к акциям</Link>
      </section>
    </div>
  );
}
