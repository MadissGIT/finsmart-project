import { useState } from 'react';
import { Bookmark, CalendarDays, Copy, ExternalLink, Share, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/model/context';
import type { Discount } from '@/entities/discount/model/types';
import { formatMoney } from '@/shared/lib/format';
import { Modal } from '@/shared/ui/Modal';
import { offerDate, partnerLink } from '../model/discounts';
import { OfferArtwork } from './OfferCard';

export function OfferDetail({ offer, back, saved, onSave }: {
  offer: Discount;
  back: string;
  saved: boolean;
  onSave: () => void;
}) {
  const { status } = useAuth();
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState('');
  const code = offer.promocode?.trim();
  const activation = offer.activation.trim();
  const showActivation = activation && (!code || activation.toLowerCase() !== ('промокод ' + code.toLowerCase()));
  const partnerUrl = offer.is_demo ? undefined : partnerLink(offer.affiliate_url);
  const purchaseQuery = new URLSearchParams({
    add: '1', merchant: offer.partner_name, purchase_category: String(offer.category_id),
  });

  async function copyCode() {
    if (!code) return;
    setMessage('');
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setMessage('Не удалось скопировать автоматически. Выделите промокод и скопируйте его вручную.');
    }
  }

  async function shareOffer() {
    const link = new URL('/discounts', window.location.origin);
    link.searchParams.set('offer', offer.id);
    try {
      if (navigator.share) {
        await navigator.share({ title: offer.partner_name + ' — ' + offer.title, url: link.href });
      } else {
        await navigator.clipboard.writeText(link.href);
        setMessage('Ссылка на акцию скопирована.');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setMessage('Скопируйте ссылку из адресной строки браузера.');
    }
  }

  return (
    <article className="offer-detail">
      <div className="offer-detail-hero">
        <div className="offer-detail-toolbar">
          <Link to={back} className="icon-button" aria-label="К скидкам">
            <img src="/figma/transactions/de43d.svg" alt="" />
          </Link>
          <div className="offer-detail-actions">
            <button type="button" className="icon-button" aria-label="Избранное" aria-pressed={saved} onClick={onSave}>
              <Bookmark size={20} fill={saved ? 'currentColor' : 'none'} />
            </button>
            <button type="button" className="icon-button" aria-label="Поделиться акцией" onClick={() => void shareOffer()}>
              <Share size={20} />
            </button>
          </div>
        </div>
        <img className="offer-hero-ellipse" src="/figma/discounts/promo-ellipse.svg" alt="" />
        <div className="offer-detail-art"><OfferArtwork categoryId={offer.category_id} eager /></div>
        {offer.benefit && <span className="offer-benefit">{offer.benefit}</span>}
      </div>
      <div className="offer-detail-body">
        <h1>{offer.partner_name}</h1>
        <p className="offer-detail-title">{offer.title}</p>
        {offer.is_demo && <p className="offer-demo-note">Демонстрационное предложение. Действие скидки и промокода не подтверждено магазином.</p>}
        <div className="offer-detail-facts">
          <p><CalendarDays size={20} aria-hidden="true" />{offerDate(offer.valid_until)}</p>
          <p><Tag size={20} aria-hidden="true" />{offer.category_name}</p>
        </div>
        {offer.original_price != null && offer.sale_price != null && (
          <p className="offer-detail-prices"><s>{formatMoney(offer.original_price)}</s> <strong>{formatMoney(offer.sale_price)}</strong></p>
        )}
        {offer.conditions && <section><h2>Условия</h2><p>{offer.conditions}</p></section>}
        {showActivation && <section><h2>Как получить</h2><p>{activation}</p></section>}
        {code && <>
          <p className="offer-code"><span>Промокод</span><code>{code}</code></p>
          <button type="button" className="button-primary" onClick={() => void copyCode()}>
            <Copy size={16} aria-hidden="true" />Скопировать промокод
          </button>
        </>}
        {partnerUrl && <a className={code ? 'button-secondary' : 'button-primary'} href={partnerUrl} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={16} aria-hidden="true" />Перейти в магазин
        </a>}
        {partnerUrl && status === 'authenticated' && <Link className="button-secondary"
          to={'/transactions?' + purchaseQuery}>
          Записать покупку со скидкой
        </Link>}
        {message && <p className="offer-action-message" role="status">{message}</p>}
      </div>
      <Modal open={copied} title="Промокод скопирован" onClose={() => setCopied(false)}>
        <div className="offer-copy-success">
          <img src="/figma/discounts/code-copied.png" alt="" width="112" height="95" />
          <p><strong>{code}</strong></p>
          {offer.is_demo && <p>Это пример промокода для демонстрации каталога.</p>}
          <button type="button" className="button-primary" onClick={() => setCopied(false)}>Готово</button>
        </div>
      </Modal>
    </article>
  );
}
