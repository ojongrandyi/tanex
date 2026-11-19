import React, { useEffect, useState } from 'react';
import { Check, ShoppingCart, X } from 'lucide-react';
import { Link } from '../../router/Link';
import { useAreaT, useLocale } from '../../i18n/I18nProvider';
import { formatMoney } from '../../i18n/format';
import { addToCart, rememberPrice } from '../../services/shopCart';
import type { PublicProductCard } from '../../services/shopPublic';
import type { PublicStock } from '../../shared/shopPublic';
import { ShopImage } from './ShopImage';

// Small pieces shared by the shop and product pages: price, stock line, product card and the
// "added to your cart" message. Text from the "shop" area (CONTENT §17.2–§17.3).

type Navigate = (page: string, param?: string) => void;

export const Price: React.FC<{ price: number; salePrice: number | null; currency: string; large?: boolean }> = ({ price, salePrice, currency, large }) => {
  const t = useAreaT('shop');
  const locale = useLocale();
  const now = formatMoney(salePrice ?? price, currency, locale);
  if (salePrice === null) return <p className={`tx-shop-price${large ? ' tx-shop-price--lg' : ''}`}>{now}</p>;
  const old = formatMoney(price, currency, locale);
  return (
    <p className={`tx-shop-price tx-shop-price--sale${large ? ' tx-shop-price--lg' : ''}`}>
      <span className="tx-visually-hidden">{t('card.wasNow', { old, new: now })}</span>
      <span aria-hidden="true">
        <span className="tx-shop-price__now">{now}</span>{' '}
        <s className="tx-shop-price__old">{old}</s>
      </span>
    </p>
  );
};

export const StockLine: React.FC<{ stock: PublicStock; showInStock?: boolean }> = ({ stock, showInStock }) => {
  const t = useAreaT('shop');
  if (stock.state === 'out') return <span className="tx-shop-stock tx-shop-stock--out">{t('stock.out')}</span>;
  if (stock.state === 'low') return <span className="tx-shop-stock tx-shop-stock--low">{t('stock.low', { n: stock.left })}</span>;
  return showInStock ? <span className="tx-shop-stock tx-shop-stock--in">{t('stock.in')}</span> : null;
};

/** What happened after "Add to cart": shown in one polite live region per page. */
export type CartNotice = { kind: 'added' } | { kind: 'limit'; max: number } | null;

export const CartToast: React.FC<{ notice: CartNotice; onClose: () => void; onNavigate: Navigate }> = ({ notice, onClose, onNavigate }) => {
  const t = useAreaT('shop');
  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(onClose, 6000);
    return () => window.clearTimeout(id);
  }, [notice, onClose]);
  return (
    <div className="tx-shop-toast-region" role="status" aria-live="polite">
      {notice && (
        <div className="tx-shop-toast">
          {notice.kind === 'added' ? <Check aria-hidden="true" /> : <ShoppingCart aria-hidden="true" />}
          <span>{notice.kind === 'added' ? t('product.added') : t('product.limit', { n: notice.max })}</span>
          <Link page="cart" onNavigate={onNavigate} className="tx-shop-toast__link">{t('product.viewCart')}</Link>
          <button type="button" className="tx-shop-toast__close" onClick={onClose} aria-label={t('gallery.close')}>
            <X aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
};

/** Adds one to the cart from a card; reports the outcome to the page. */
function useQuickAdd(product: PublicProductCard, onNotice: (n: CartNotice) => void) {
  const [added, setAdded] = useState(false);
  useEffect(() => {
    if (!added) return;
    const id = window.setTimeout(() => setAdded(false), 2000);
    return () => window.clearTimeout(id);
  }, [added]);
  const add = () => {
    const now = addToCart(product.id, 1, product.maxQty);
    if (now === null) {
      onNotice({ kind: 'limit', max: product.maxQty });
      return;
    }
    rememberPrice(product.id, product.salePrice ?? product.price);
    setAdded(true);
    onNotice({ kind: 'added' });
  };
  return { added, add };
}

interface ProductCardProps {
  product: PublicProductCard;
  onNavigate: Navigate;
  onNotice: (n: CartNotice) => void;
  /** The first row loads its pictures at once. */
  eager?: boolean;
  headingLevel?: 2 | 3;
}

/** A product in a grid: square picture, name, price, stock badge, Add to cart. */
export const ProductCard: React.FC<ProductCardProps> = ({ product, onNavigate, onNotice, eager, headingLevel = 2 }) => {
  const t = useAreaT('shop');
  const { added, add } = useQuickAdd(product, onNotice);
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const out = product.stock.state === 'out';
  return (
    <article className={`tx-shop-card${out ? ' tx-shop-card--out' : ''}`}>
      <Link page="shop-product" param={product.slug} onNavigate={onNavigate} className="tx-shop-card__media" tabIndex={-1} aria-hidden="true">
        {product.image ? (
          <ShopImage
            picture={product.image}
            decorative
            eager={eager}
            sizes="(min-width: 1200px) 300px, (min-width: 768px) 33vw, 50vw"
          />
        ) : (
          <span className="tx-shop-card__placeholder"><ShoppingCart /></span>
        )}
        {product.salePrice !== null && <span className="tx-shop-badge tx-shop-badge--sale">{t('card.sale')}</span>}
      </Link>
      <div className="tx-shop-card__body">
        <Heading className="tx-shop-card__name">
          <Link page="shop-product" param={product.slug} onNavigate={onNavigate}>{product.name}</Link>
        </Heading>
        <Price price={product.price} salePrice={product.salePrice} currency={product.currency} />
        <StockLine stock={product.stock} />
        <button
          type="button"
          className="tx-btn tx-btn--primary tx-btn--sm tx-btn--block tx-shop-card__add"
          disabled={out}
          onClick={add}
        >
          {added ? <Check aria-hidden="true" /> : <ShoppingCart aria-hidden="true" />}
          {added ? t('card.added') : t('card.addToCart')}
        </button>
      </div>
    </article>
  );
};
