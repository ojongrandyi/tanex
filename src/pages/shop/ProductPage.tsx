import React, { useCallback, useEffect, useState } from 'react';
import { ChevronRight, MessageCircle, Minus, Plus, ShoppingCart, Store, Truck, Wallet } from 'lucide-react';
import { COMPANY, WHATSAPP } from '../../config/brand';
import { Link } from '../../router/Link';
import { setAlternateTargets } from '../../router/navigation';
import { buildPath } from '../../router/routes';
import { useAreaT, useLocale } from '../../i18n/I18nProvider';
import { whatsAppDigits } from '../../shared/whatsapp';
import { addToCart, cartQuantity, subscribeCart } from '../../services/shopCart';
import { shopPublicApi, type PublicProduct } from '../../services/shopPublic';
import { NotFoundPage } from '../NotFoundPage';
import { ProductGallery } from './ProductGallery';
import { CartToast, Price, ProductCard, StockLine, type CartNotice } from './ShopParts';
import '../../styles/blogProse.css';
import './ShopPages.css';

// Public product page (/shop/<slug>, /fr/boutique/<slug>), SHOP_SPEC §8: breadcrumbs, gallery,
// price, stock line, quantity, Add to cart, Ask on WhatsApp (with the product ID), delivery and
// payment lines, description (the server's sanitised HTML), policy links and related products.
// `ProductView` is also what the console's preview shows (no related products there).

type Navigate = (page: string, param?: string) => void;

interface ProductViewProps {
  product: PublicProduct;
  onNavigate: Navigate;
  /** Console preview: Add to cart does nothing. */
  preview?: boolean;
}

/** The quantity a customer may still add, given what is already in the cart. */
function useInCart(id: string): number {
  const [n, setN] = useState(() => cartQuantity(id));
  useEffect(() => {
    setN(cartQuantity(id));
    return subscribeCart(() => setN(cartQuantity(id)));
  }, [id]);
  return n;
}

export const ProductView: React.FC<ProductViewProps> = ({ product: p, onNavigate, preview }) => {
  const t = useAreaT('shop');
  const inCart = useInCart(p.id);
  const room = Math.max(0, p.maxQty - inCart);
  const [qty, setQty] = useState(1);
  const [notice, setNotice] = useState<CartNotice>(null);
  const closeNotice = useCallback(() => setNotice(null), []);
  const out = p.stock.state === 'out';

  useEffect(() => {
    setQty((q) => Math.max(1, Math.min(q, Math.max(1, room))));
  }, [room]);

  const add = () => {
    if (preview) return;
    const now = addToCart(p.id, qty, p.maxQty);
    setNotice(now === null ? { kind: 'limit', max: p.maxQty } : { kind: 'added' });
    if (now !== null) setQty(1);
  };

  const digits = whatsAppDigits(WHATSAPP);
  const message = t('product.whatsAppMessage', { company: COMPANY, product: p.name, code: p.code });
  const whatsApp = digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : null;
  const category = p.categories[0];

  return (
    <div className="tx-shop tx-shop-product">
      <div className="tx-shop__wrap">
        <nav className="tx-shop-crumbs" aria-label={t('product.breadcrumb')}>
          <ol>
            <li>
              <Link page="shop" onNavigate={onNavigate}>{t('product.marketplace')}</Link>
              <ChevronRight aria-hidden="true" />
            </li>
            {category && (
              <li>
                <Link page="shop-category" param={category.slug} onNavigate={onNavigate}>{category.name}</Link>
                <ChevronRight aria-hidden="true" />
              </li>
            )}
            <li aria-current="page">{p.name}</li>
          </ol>
        </nav>

        <div className="tx-shop-product__top">
          <ProductGallery images={p.images} name={p.name} />

          <div className="tx-shop-product__info">
            <h1 className="tx-shop-product__name">{p.name}</h1>
            {p.short && <p className="tx-shop-product__short">{p.short}</p>}
            <Price price={p.price} salePrice={p.salePrice} currency={p.currency} large />
            <p className="tx-shop-product__stock"><StockLine stock={p.stock} showInStock /></p>

            {!out && (
              <div className="tx-shop-qty">
                <label htmlFor="shop-qty" className="tx-shop-qty__label">{t('product.quantity')}</label>
                <div className="tx-shop-qty__stepper">
                  <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label={t('product.decrease')}>
                    <Minus aria-hidden="true" />
                  </button>
                  <input
                    id="shop-qty"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={Math.max(1, room)}
                    value={qty}
                    aria-describedby={room <= qty ? 'shop-qty-limit' : undefined}
                    onChange={(e) => {
                      const n = Number.parseInt(e.target.value, 10);
                      if (Number.isFinite(n)) setQty(Math.max(1, Math.min(n, Math.max(1, room))));
                    }}
                  />
                  <button type="button" onClick={() => setQty((q) => Math.min(Math.max(1, room), q + 1))} disabled={qty >= room} aria-label={t('product.increase')}>
                    <Plus aria-hidden="true" />
                  </button>
                </div>
                {room <= qty && (
                  <p id="shop-qty-limit" className="tx-shop-qty__hint">{t('product.limit', { n: p.maxQty })}</p>
                )}
              </div>
            )}

            <div className="tx-shop-product__actions">
              <button type="button" className="tx-btn tx-btn--primary tx-btn--lg" disabled={out || room === 0} onClick={add}>
                <ShoppingCart aria-hidden="true" />
                {t('product.addToCart')}
              </button>
              {whatsApp && (
                <a className="tx-btn tx-btn--ghost tx-btn--lg" href={whatsApp} target="_blank" rel="noopener noreferrer">
                  <MessageCircle aria-hidden="true" />
                  {t('product.askWhatsApp')}
                </a>
              )}
            </div>
            {inCart > 0 && <p className="tx-shop-product__incart">{t('product.inCart', { n: inCart })}</p>}

            <p className="tx-shop-product__code">{t('product.productId', { code: p.code })}</p>

            <ul className="tx-shop-product__facts">
              <li><Truck aria-hidden="true" /><span>{t('product.delivery', { company: COMPANY })}</span></li>
              <li><Wallet aria-hidden="true" /><span>{t('product.payment')}</span></li>
              <li>
                <Store aria-hidden="true" />
                <span>
                  <Link page="legal" param="returns" onNavigate={onNavigate}>{t('product.returns')}</Link>
                  {' · '}
                  <Link page="legal" param="shipping-terms" onNavigate={onNavigate}>{t('product.shippingTerms')}</Link>
                </span>
              </li>
            </ul>
          </div>
        </div>

        {p.descriptionHtml && (
          <section className="tx-shop-product__description" aria-labelledby="shop-description">
            <h2 id="shop-description" className="tx-shop-product__h2">{t('product.description')}</h2>
            <div className="tx-blog-prose" dangerouslySetInnerHTML={{ __html: p.descriptionHtml }} />
          </section>
        )}

        {p.related.length > 0 && (
          <section className="tx-shop-product__related" aria-labelledby="shop-related">
            <h2 id="shop-related" className="tx-shop-product__h2">{t('product.related')}</h2>
            <ul className="tx-shop__grid">
              {p.related.map((r) => (
                <li key={r.id}>
                  <ProductCard product={r} onNavigate={onNavigate} onNotice={setNotice} headingLevel={3} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <CartToast notice={notice} onClose={closeNotice} onNavigate={onNavigate} />
    </div>
  );
};

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'not-found' }
  | { status: 'ready'; product: PublicProduct };

export const ProductPage: React.FC<{ slug: string; onNavigate: Navigate }> = ({ slug, onNavigate }) => {
  const t = useAreaT('shop');
  const locale = useLocale();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setState({ status: 'loading' });
    shopPublicApi
      .product(locale, slug)
      .then((product) => live && setState({ status: 'ready', product }))
      .catch((err) => live && setState({ status: err?.status === 404 ? 'not-found' : 'error' }));
    return () => {
      live = false;
    };
  }, [locale, slug, attempt]);

  const product = state.status === 'ready' ? state.product : null;

  // Tab title, description and the language switch to the same product in the other language.
  useEffect(() => {
    if (!product) return;
    document.title = `${product.seoTitle} | ${COMPANY}`;
    const desc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (desc) desc.content = product.seoDescription;
    const path = window.location.pathname;
    const other = locale === 'en' ? 'fr' : 'en';
    setAlternateTargets(path, { [other]: product.paths[other] });
    return () => setAlternateTargets(path, null);
  }, [product, locale]);

  // A missing product: the switch goes to the other language's shop.
  useEffect(() => {
    if (state.status !== 'not-found') return;
    const path = window.location.pathname;
    const other = locale === 'en' ? 'fr' : 'en';
    setAlternateTargets(path, { [other]: buildPath('shop', undefined, other) });
    return () => setAlternateTargets(path, null);
  }, [state.status, locale]);

  if (state.status === 'not-found') return <NotFoundPage onNavigate={onNavigate} />;
  if (state.status === 'error') {
    return (
      <div className="tx-shop tx-shop-product">
        <div className="tx-shop__wrap tx-shop__message" role="alert">
          <p>{t('product.loadError')}</p>
          <button type="button" className="tx-btn tx-btn--secondary tx-btn--md" onClick={() => setAttempt((n) => n + 1)}>{t('product.retry')}</button>
        </div>
      </div>
    );
  }
  if (!product) {
    return (
      <div className="tx-shop tx-shop-product" role="status" aria-busy="true">
        <div className="tx-shop__wrap">
          <div className="tx-shop-product__top" aria-hidden="true">
            <div className="tx-shop__skeleton tx-shop__skeleton--square" />
            <div className="tx-shop__skeleton tx-shop__skeleton--text" />
          </div>
        </div>
      </div>
    );
  }
  return <ProductView key={product.id} product={product} onNavigate={onNavigate} />;
};
