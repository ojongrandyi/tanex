import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, MessageCircle, Minus, Plus, ShoppingBag, ShoppingCart, Trash2 } from 'lucide-react';
import { COMPANY, MTN_MOMO_NUMBER, OFFICES, ORANGE_MONEY_NUMBER, WHATSAPP, formatPhone } from '../../config/brand';
import { Button, Checkbox, Input, PageHero, Radio, Select, Textarea } from '../../components/ui';
import { Link } from '../../router/Link';
import { useAreaT, useLocale } from '../../i18n/I18nProvider';
import { formatMoney } from '../../i18n/format';
import { CHECKOUT_LIMITS, cameroonPhone, isCheckoutEmail } from '../../shared/shopCheckout';
import { paymentMethodFits, type DeliveryMethod, type ShopPaymentMethod } from '../../shared/shopOrderStatus';
import { whatsAppDigits } from '../../shared/whatsapp';
import {
  clearCart, readCart, rememberPrice, replaceCart, seenPrice, setCartQuantity, subscribeCart,
} from '../../services/shopCart';
import {
  shopPublicApi, type CartCheckResult, type CheckedCartLine, type DeliveryFeeResult, type PlacedOrder,
} from '../../services/shopPublic';
import { localDeliveryApi, type PublicCity } from '../../services/localDeliveryApi';
import { Price } from './ShopParts';
import { ShopImage } from './ShopImage';
import './ShopPages.css';

// Cart and checkout (/cart, /fr/panier), SHOP_SPEC §8: one page, two steps. 1. Cart: every line read
// again from the server when the page opens (price, stock, limit), with a clear note for anything
// that changed. 2. Your details: contact, delivery or pickup, payment, terms, summary with the
// delivery fee from POST /api/shop/delivery-fee. "Place order" sends ids and quantities only: the
// server takes prices from the database. After placing: the order number and what happens next.

type Navigate = (page: string, param?: string) => void;

/** Area select value for "My area isn't listed": no area, the address says where. */
const OTHER_AREA = '__other';
/** Stand-ins used to split a sentence around the links placed inside it. */
const MARK_A = '\u0001';
const MARK_B = '\u0002';

type CheckState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: CartCheckResult };
type FeeState = { kind: 'choose' } | { kind: 'loading' } | { kind: 'done'; fee: DeliveryFeeResult } | { kind: 'error' };
type FieldKey = 'name' | 'phone' | 'whatsapp' | 'email' | 'receive' | 'area' | 'address' | 'office' | 'payment' | 'terms';

const newKey = () => {
  try {
    return globalThis.crypto.randomUUID();
  } catch {
    return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`.padEnd(20, '0');
  }
};

const unitPrice = (l: CheckedCartLine) => l.salePrice ?? l.price;

/** "{a} … {b}" with a link (or other node) in place of each mark. */
function withNodes(text: string, a: React.ReactNode, b?: React.ReactNode): React.ReactNode {
  const [before, rest = ''] = text.split(MARK_A);
  const [middle, after = ''] = rest.split(MARK_B);
  return <>{before}{a}{middle}{b}{after}</>;
}

export const CartPage: React.FC<{ onNavigate: Navigate }> = ({ onNavigate }) => {
  const t = useAreaT('shop');
  const locale = useLocale();
  const money = useCallback((n: number, currency: string) => formatMoney(n, currency, locale), [locale]);

  const [check, setCheck] = useState<CheckState>({ status: 'loading' });
  const [notices, setNotices] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [step, setStep] = useState<'cart' | 'details'>('cart');
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const noticesRef = useRef<HTMLDivElement>(null);

  // ---- Step 1: the cart, checked by the server ----

  const runCheck = useCallback(async (extra: string[] = []) => {
    const lines = readCart();
    if (lines.length === 0) {
      setCheck({ status: 'ready', data: { lines: [], removed: [], subtotal: 0, currency: 'XAF', options: { paymentMethods: [], pickupOffices: [] } } });
      setNotices(extra);
      return;
    }
    setCheck({ status: 'loading' });
    try {
      const data = await shopPublicApi.checkCart(locale, lines);
      const found: string[] = [...extra];
      for (const r of data.removed) found.push(r.name ? t('cart.removed', { product: r.name }) : t('cart.removedUnnamed'));
      for (const l of data.lines) {
        const price = unitPrice(l);
        const before = seenPrice(l.id);
        if (before !== undefined && before !== price) found.push(t('cart.priceChanged', { product: l.name, price: money(price, l.currency) }));
        rememberPrice(l.id, price);
        if (l.qty < l.requested) {
          found.push(l.stock.state === 'low' && l.qty === l.stock.left
            ? t('cart.reduced', { n: l.qty, product: l.name })
            : t('cart.limited', { n: l.qty, product: l.name }));
        }
      }
      replaceCart(data.lines.map((l) => ({ id: l.id, qty: l.qty })));
      setCheck({ status: 'ready', data });
      setNotices(found);
    } catch {
      setCheck({ status: 'error' });
    }
  }, [locale, t, money]);

  useEffect(() => {
    if (!placed) void runCheck();
    // Only on opening, retry and language change; quantity changes update the lines in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, locale]);

  // Another tab changed the cart: check again (not after this page's own writes, which match).
  useEffect(() => subscribeCart(() => {
    if (placed || check.status !== 'ready') return;
    const stored = readCart();
    const shown = check.data.lines;
    const same = stored.length === shown.length && stored.every((s) => shown.some((l) => l.id === s.id && l.qty === s.qty));
    if (!same) void runCheck();
  }), [check, placed, runCheck]);

  useEffect(() => {
    if (notices.length > 0) noticesRef.current?.focus();
  }, [notices]);

  const data = check.status === 'ready' ? check.data : null;
  const lines = data?.lines ?? [];
  const currency = data?.currency ?? 'XAF';
  const subtotal = lines.reduce((n, l) => n + unitPrice(l) * l.qty, 0);
  const itemCount = lines.reduce((n, l) => n + l.qty, 0);

  const setQty = (id: string, qty: number) => {
    if (check.status !== 'ready') return;
    setCartQuantity(id, qty);
    const next = qty <= 0
      ? check.data.lines.filter((l) => l.id !== id)
      : check.data.lines.map((l) => (l.id === id ? { ...l, qty, requested: qty, lineTotal: unitPrice(l) * qty } : l));
    setCheck({ status: 'ready', data: { ...check.data, lines: next } });
    setNotices([]);
  };

  const goTo = (s: 'cart' | 'details') => {
    setStep(s);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.setTimeout(() => stepHeading.current?.focus(), 0);
  };

  // ---- Step 2: your details ----

  const [cities, setCities] = useState<PublicCity[] | null>(null);
  const [citiesFailed, setCitiesFailed] = useState(false);
  useEffect(() => {
    if (step !== 'details' || cities) return;
    let alive = true;
    localDeliveryApi.areas()
      .then((list) => alive && setCities(list))
      .catch(() => alive && setCitiesFailed(true));
    return () => { alive = false; };
  }, [step, cities]);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [sameAsPhone, setSameAsPhone] = useState(true);
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [receive, setReceive] = useState<DeliveryMethod | ''>('');
  const [cityId, setCityId] = useState('');
  const [zone, setZone] = useState('');
  const [address, setAddress] = useState('');
  const [office, setOffice] = useState('');
  const [note, setNote] = useState('');
  const [payment, setPayment] = useState<ShopPaymentMethod | ''>('');
  const [terms, setTerms] = useState(false);
  const [website, setWebsite] = useState('');
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [formError, setFormError] = useState('');
  const [sending, setSending] = useState(false);
  const idempotencyKey = useRef(newKey());
  const formRef = useRef<HTMLFormElement>(null);

  const options = data?.options ?? { paymentMethods: [], pickupOffices: [] };
  const offices = OFFICES.filter((o) => options.pickupOffices.includes(o.city.toLowerCase()));
  const methods = options.paymentMethods.filter((m) => !receive || paymentMethodFits(m, receive));
  const city = cities?.find((c) => c.id === cityId) ?? null;
  const zoneId = zone && zone !== OTHER_AREA ? zone : null;

  // A payment method that no longer fits the way of receiving the order is cleared.
  useEffect(() => {
    if (payment && receive && !paymentMethodFits(payment, receive)) setPayment('');
  }, [payment, receive]);

  // ---- Delivery fee ----
  const [fee, setFee] = useState<FeeState>({ kind: 'choose' });
  const feeLines = useMemo(() => lines.map((l) => `${l.id}:${l.qty}`).join(','), [lines]);
  useEffect(() => {
    if (step !== 'details' || lines.length === 0) return;
    if (receive === 'PICKUP') {
      setFee({ kind: 'done', fee: { status: 'NONE', fee: 0, currency } });
      return;
    }
    if (receive !== 'DELIVERY' || !cityId) {
      setFee({ kind: 'choose' });
      return;
    }
    let alive = true;
    setFee({ kind: 'loading' });
    const timer = window.setTimeout(() => {
      shopPublicApi.deliveryFee({ lines: lines.map((l) => ({ id: l.id, qty: l.qty })), deliveryMethod: 'DELIVERY', cityId, zoneId })
        .then((f) => alive && setFee({ kind: 'done', fee: f }))
        .catch(() => alive && setFee({ kind: 'error' }));
    }, 250);
    return () => { alive = false; window.clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, receive, cityId, zoneId, feeLines, currency]);

  const knownFee = fee.kind === 'done' && fee.fee.status !== 'TO_CONFIRM' ? fee.fee.fee : null;
  const feeText = fee.kind === 'choose' ? t('checkout.feeChoose')
    : fee.kind === 'loading' ? t('checkout.feeChecking')
      : fee.kind === 'done' && fee.fee.status === 'NONE' ? t('checkout.freePickup')
        : knownFee !== null ? money(knownFee, currency)
          : t('checkout.feeToConfirm');

  // ---- Submit ----

  const validate = (): Partial<Record<FieldKey, string>> => {
    const e: Partial<Record<FieldKey, string>> = {};
    if (!name.trim()) e.name = t('checkout.errors.name');
    if (!cameroonPhone(phone)) e.phone = t('checkout.errors.phone');
    if (!sameAsPhone && !cameroonPhone(whatsapp)) e.whatsapp = t('checkout.errors.phone');
    if (email.trim() && !isCheckoutEmail(email.trim())) e.email = t('checkout.errors.email');
    if (!receive) e.receive = t('checkout.receiveRequired');
    if (receive === 'DELIVERY') {
      if (!cityId || !zone) e.area = t('checkout.errors.area');
      if (!address.trim()) e.address = t('checkout.errors.address');
    }
    if (receive === 'PICKUP' && !office) e.office = t('checkout.errors.office');
    if (!payment) e.payment = t('checkout.errors.payment');
    if (!terms) e.terms = t('checkout.errors.terms');
    return e;
  };

  // A field marked in red loses its message as soon as it is put right.
  useEffect(() => {
    if (Object.keys(errors).length === 0) return;
    const still = validate();
    const kept = Object.fromEntries(Object.entries(errors).filter(([k]) => k in still)) as Partial<Record<FieldKey, string>>;
    if (Object.keys(kept).length !== Object.keys(errors).length) {
      setErrors(kept);
      if (Object.keys(kept).length === 0) setFormError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, phone, sameAsPhone, whatsapp, email, receive, cityId, zone, address, office, payment, terms]);

  const FIELD_CODES: Record<string, [FieldKey, string]> = {
    INVALID_NAME: ['name', t('checkout.errors.name')],
    INVALID_PHONE: ['phone', t('checkout.errors.phone')],
    INVALID_WHATSAPP: ['whatsapp', t('checkout.errors.phone')],
    INVALID_EMAIL: ['email', t('checkout.errors.email')],
    INVALID_CITY: ['area', t('checkout.errors.area')],
    INVALID_AREA: ['area', t('checkout.errors.area')],
    ADDRESS_REQUIRED: ['address', t('checkout.errors.address')],
    INVALID_PICKUP_OFFICE: ['office', t('checkout.errors.office')],
    INVALID_PAYMENT_METHOD: ['payment', t('checkout.errors.payment')],
    TERMS_REQUIRED: ['terms', t('checkout.errors.terms')],
  };
  const CART_CODES = ['OUT_OF_STOCK', 'QUANTITY_LIMIT', 'PRODUCT_UNAVAILABLE', 'PRICE_CHANGED', 'EMPTY_CART', 'INVALID_CART', 'MIXED_CURRENCY'];

  const focusFirstError = () =>
    window.setTimeout(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (sending || lines.length === 0) return;
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setFormError(t('checkout.errors.fix'));
      focusFirstError();
      return;
    }
    setFormError('');
    setSending(true);
    const seenPrices: Record<string, number> = {};
    for (const l of lines) seenPrices[l.id] = unitPrice(l);
    try {
      const order = await shopPublicApi.placeOrder({
        idempotencyKey: idempotencyKey.current,
        lines: lines.map((l) => ({ id: l.id, qty: l.qty })),
        seenPrices,
        name: name.trim(),
        phone: phone.trim(),
        sameAsPhone,
        whatsapp: sameAsPhone ? '' : whatsapp.trim(),
        email: email.trim(),
        locale,
        deliveryMethod: receive as DeliveryMethod,
        cityId: receive === 'DELIVERY' ? cityId : null,
        zoneId: receive === 'DELIVERY' ? zoneId : null,
        address: receive === 'DELIVERY' ? address.trim() : '',
        pickupOffice: receive === 'PICKUP' ? office : null,
        note: note.trim(),
        paymentMethod: payment as ShopPaymentMethod,
        acceptTerms: terms,
        website,
      });
      clearCart();
      setPlaced(order);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      window.setTimeout(() => stepHeading.current?.focus(), 0);
    } catch (err) {
      const e = err as { code?: string; status?: number; details?: { name?: string; available?: number } } | null;
      const code = e?.code ?? '';
      if (FIELD_CODES[code]) {
        const [field, text] = FIELD_CODES[code];
        setErrors({ [field]: text });
        setFormError(t('checkout.errors.fix'));
        focusFirstError();
      } else if (CART_CODES.includes(code)) {
        // The cart changed under the customer: a fresh key, the cart checked again, and back to step 1.
        idempotencyKey.current = newKey();
        const first = code === 'OUT_OF_STOCK' && e?.details?.name !== undefined && e.details.available !== undefined
          ? t('checkout.errors.stock', { n: e.details.available, product: e.details.name })
          : t('checkout.errors.changed');
        setStep('cart');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        await runCheck([first]);
      } else if (code === 'RATE_LIMITED' || e?.status === 429) {
        setFormError(t('checkout.errors.rateLimited'));
      } else {
        setFormError(t('checkout.errors.failed'));
      }
    } finally {
      setSending(false);
    }
  };

  // ---- Parts ----

  const digits = whatsAppDigits(WHATSAPP);
  const hero = (
    <PageHero
      eyebrow={t('index.eyebrow', { company: COMPANY })}
      title={placed ? t('placed.title', { firstName: placed.firstName }) : t('cart.title')}
      titleId="cart-title"
      className="tx-shop__hero tx-cart__hero"
    />
  );

  if (placed) {
    const momoNumber = placed.paymentMethod === 'MTN_MOMO' ? MTN_MOMO_NUMBER : placed.paymentMethod === 'ORANGE_MONEY' ? ORANGE_MONEY_NUMBER : '';
    const message = t('placed.whatsAppMessage', { company: COMPANY, order: placed.orderNumber });
    return (
      <div className="tx-shop tx-cart">
        {hero}
        <section className="tx-shop__section">
          <div className="tx-shop__wrap tx-cart__placed">
            <div className="tx-cart__card" role="status">
              <h2 className="tx-cart__h2" ref={stepHeading} tabIndex={-1}>
                <Check aria-hidden="true" />
                <span>{withNodes(t('placed.number', { order: MARK_A }), <span className="tx-cart__nowrap">{placed.orderNumber}</span>)}</span>
              </h2>
              {placed.confirmationSent && email.trim() && (
                <p className="tx-cart__muted tx-cart__sent">{t('placed.confirmation', { email: email.trim() })}</p>
              )}
              <h3 className="tx-cart__legend">{t('placed.items')}</h3>
              <ul className="tx-cart__placed-items">
                {placed.items.map((i) => (
                  <li key={i.code}>
                    <span className="tx-cart__placed-name">{i.qty} × {i.name}</span>
                    <span className="tx-cart__code">{withNodes(t('product.productId', { code: MARK_A }), <span className="tx-cart__nowrap">{i.code}</span>)}</span>
                    <span className="tx-cart__money">{money(i.lineTotal, placed.currency)}</span>
                  </li>
                ))}
              </ul>
              <dl className="tx-cart__totals">
                <div><dt>{t('checkout.subtotal')}</dt><dd>{money(placed.subtotal, placed.currency)}</dd></div>
                <div>
                  <dt>{t('checkout.deliveryFee')}</dt>
                  <dd>{placed.deliveryFeeStatus === 'NONE' ? t('checkout.freePickup')
                    : placed.deliveryFee !== null ? money(placed.deliveryFee, placed.currency) : t('checkout.feeToConfirm')}</dd>
                </div>
                <div className="tx-cart__total">
                  <dt>{placed.deliveryFeeStatus === 'TO_CONFIRM' ? t('checkout.totalToConfirm') : t('checkout.total')}</dt>
                  <dd>{money(placed.total, placed.currency)}</dd>
                </div>
              </dl>
            </div>

            <div className="tx-cart__card">
              <h2 className="tx-cart__legend">{t('placed.next')}</h2>
              <ol className="tx-cart__next">
                <li>{t('placed.step1')}</li>
                <li>{t('placed.step2')}</li>
                <li>{placed.deliveryMethod === 'PICKUP' ? t('placed.step3Pickup') : t('placed.step3Delivery', { company: COMPANY })}</li>
              </ol>
              {momoNumber && (
                <p className="tx-cart__momo">
                  {t('placed.mobileMoney', {
                    method: t(`checkout.methods.${placed.paymentMethod}.label`), number: formatPhone(momoNumber), order: placed.orderNumber,
                  })}
                </p>
              )}
              <div className="tx-cart__actions">
                {digits && (
                  <a className="tx-btn tx-btn--primary tx-btn--md" href={`https://wa.me/${digits}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
                    <MessageCircle aria-hidden="true" />{t('placed.whatsapp')}
                  </a>
                )}
                <Link page="shop" onNavigate={onNavigate} className="tx-btn tx-btn--ghost tx-btn--md">{t('placed.continueShopping')}</Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const steps = (
    <nav aria-label={t('cart.steps')} className="tx-cart__steps">
      <ol>
        {(['cart', 'details'] as const).map((s, i) => (
          <li key={s} className={step === s ? 'is-current' : ''} aria-current={step === s ? 'step' : undefined}>
            <span className="tx-cart__step-n" aria-hidden="true">{i + 1}</span>
            {s === 'cart' ? t('cart.stepCart') : t('cart.stepDetails')}
          </li>
        ))}
      </ol>
    </nav>
  );

  const noticeBox = notices.length > 0 && (
    <div className="tx-cart__notices" role="status" tabIndex={-1} ref={noticesRef}>
      <ul>{notices.map((n, i) => <li key={i}>{n}</li>)}</ul>
    </div>
  );

  let body: React.ReactNode;
  if (check.status === 'error') {
    body = (
      <div className="tx-shop__message" role="alert">
        <p>{t('cart.loadError')}</p>
        <button type="button" className="tx-btn tx-btn--secondary tx-btn--md" onClick={() => setAttempt((n) => n + 1)}>{t('cart.retry')}</button>
      </div>
    );
  } else if (check.status === 'loading') {
    body = <div className="tx-shop__skeleton tx-shop__skeleton--text" role="status" aria-busy="true" />;
  } else if (lines.length === 0) {
    body = (
      <>
        {noticeBox}
        <div className="tx-shop__message tx-shop__message--empty">
          <ShoppingCart aria-hidden="true" />
          <p className="tx-shop__message-title">{t('cart.emptyTitle')}</p>
          <Link page="shop" onNavigate={onNavigate} className="tx-btn tx-btn--primary tx-btn--md">{t('cart.browse')}</Link>
        </div>
      </>
    );
  } else if (step === 'cart') {
    body = (
      <>
        {steps}
        {noticeBox}
        <div className="tx-cart__grid">
          <div className="tx-cart__card">
            <h2 className="tx-visually-hidden" ref={stepHeading} tabIndex={-1}>{t('cart.stepCart')}</h2>
            <ul className="tx-cart__lines">
              {lines.map((l) => (
                <li key={l.id} className="tx-cart__line">
                  <a href={l.path} className="tx-cart__thumb" tabIndex={-1} aria-hidden="true"
                    onClick={(e) => { e.preventDefault(); onNavigate('shop', l.slug); }}>
                    {l.image ? <ShopImage picture={l.image} sizes="96px" /> : <ShoppingBag aria-hidden="true" />}
                  </a>
                  <div className="tx-cart__line-info">
                    <Link page="shop" param={l.slug} onNavigate={onNavigate} className="tx-cart__name">{l.name}</Link>
                    <span className="tx-cart__code">{withNodes(t('product.productId', { code: MARK_A }), <span className="tx-cart__nowrap">{l.code}</span>)}</span>
                    <Price price={l.price} salePrice={l.salePrice} currency={l.currency} />
                  </div>
                  <div className="tx-cart__line-qty">
                    <div className="tx-shop-qty__stepper">
                      <button type="button" onClick={() => setQty(l.id, l.qty - 1)} disabled={l.qty <= 1} aria-label={t('product.decrease')}>
                        <Minus aria-hidden="true" />
                      </button>
                      <input
                        type="number" inputMode="numeric" min={1} max={Math.max(1, l.maxQty)} value={l.qty}
                        aria-label={t('cart.quantityOf', { product: l.name })}
                        onChange={(e) => {
                          const v = Number.parseInt(e.target.value, 10);
                          if (Number.isFinite(v)) setQty(l.id, Math.max(1, Math.min(v, Math.max(1, l.maxQty))));
                        }}
                      />
                      <button type="button" onClick={() => setQty(l.id, l.qty + 1)} disabled={l.qty >= l.maxQty} aria-label={t('product.increase')}>
                        <Plus aria-hidden="true" />
                      </button>
                    </div>
                    <button type="button" className="tx-cart__remove" onClick={() => setQty(l.id, 0)} aria-label={t('cart.removeItem', { product: l.name })}>
                      <Trash2 aria-hidden="true" />{t('cart.remove')}
                    </button>
                  </div>
                  <span className="tx-cart__money tx-cart__line-total">{money(unitPrice(l) * l.qty, l.currency)}</span>
                </li>
              ))}
            </ul>
          </div>
          <aside className="tx-cart__card tx-cart__aside" aria-label={t('checkout.summary')}>
            <dl className="tx-cart__totals">
              <div>
                <dt>{t('cart.subtotal')} <span className="tx-cart__muted">({itemCount === 1 ? t('checkout.itemsOne') : t('checkout.itemsCount', { n: itemCount })})</span></dt>
                <dd>{money(subtotal, currency)}</dd>
              </div>
            </dl>
            <Button size="lg" block onClick={() => goTo('details')}>{t('cart.toDetails')}</Button>
            <Link page="shop" onNavigate={onNavigate} className="tx-btn tx-btn--ghost tx-btn--md tx-btn--block">{t('cart.continueShopping')}</Link>
          </aside>
        </div>
      </>
    );
  } else {
    const termsText = t('checkout.terms', { terms: MARK_A, returns: MARK_B });
    body = (
      <>
        {steps}
        <form ref={formRef} className="tx-cart__grid" onSubmit={submit} noValidate aria-labelledby="checkout-title">
          <div className="tx-cart__parts">
            <fieldset className="tx-cart__card tx-cart__part">
              <legend className="tx-cart__legend">
                <h2 id="checkout-title" className="tx-cart__h2" ref={stepHeading} tabIndex={-1}>{t('checkout.title')}</h2>
              </legend>
              <Input label={t('checkout.name')} value={name} maxLength={CHECKOUT_LIMITS.name} required autoComplete="name"
                error={errors.name} onChange={(e) => setName(e.target.value)} />
              <div className="tx-cart__row">
                <Input label={t('checkout.phone')} hint={t('checkout.phoneHint')} type="tel" inputMode="tel" value={phone}
                  maxLength={CHECKOUT_LIMITS.phone} required autoComplete="tel" error={errors.phone} onChange={(e) => setPhone(e.target.value)} />
                <Input label={t('checkout.email')} hint={t('checkout.emailHint')} type="email" value={email} maxLength={CHECKOUT_LIMITS.email}
                  autoComplete="email" error={errors.email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <Checkbox label={t('checkout.sameAsPhone')} checked={sameAsPhone} onChange={(e) => setSameAsPhone(e.target.checked)} />
              {!sameAsPhone && (
                <Input label={t('checkout.whatsapp')} type="tel" inputMode="tel" value={whatsapp} maxLength={CHECKOUT_LIMITS.phone}
                  error={errors.whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
              )}
              {/* Left empty by people; robots fill it in. */}
              <div className="tx-cart__hp" aria-hidden="true">
                <label>Website<input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
              </div>
            </fieldset>

            <fieldset className="tx-cart__card tx-cart__part" aria-describedby={errors.receive ? 'cart-receive-error' : undefined}>
              <legend className="tx-cart__legend">{t('checkout.receive')}</legend>
              <div className="tx-cart__choices">
                <Radio name="cart-receive" value="DELIVERY" checked={receive === 'DELIVERY'} error={!!errors.receive}
                  onChange={() => setReceive('DELIVERY')} label={t('checkout.delivery')} />
                {offices.length > 0 && (
                  <Radio name="cart-receive" value="PICKUP" checked={receive === 'PICKUP'} error={!!errors.receive}
                    onChange={() => setReceive('PICKUP')} label={t('checkout.pickup', { company: COMPANY })} />
                )}
              </div>
              {errors.receive && <p className="tx-error" id="cart-receive-error">{errors.receive}</p>}

              {receive === 'DELIVERY' && (
                citiesFailed ? (
                  <div className="tx-shop__message" role="alert">
                    <p>{t('cart.loadError')}</p>
                    <button type="button" className="tx-btn tx-btn--secondary tx-btn--md" onClick={() => { setCitiesFailed(false); setCities(null); }}>{t('cart.retry')}</button>
                  </div>
                ) : (
                  <>
                    <div className="tx-cart__row">
                      <Select label={t('checkout.city')} value={cityId} required disabled={!cities} error={errors.area && !cityId ? errors.area : undefined}
                        onChange={(e) => { setCityId(e.target.value); setZone(''); }}>
                        <option value="" disabled>{t('checkout.cityPlaceholder')}</option>
                        {(cities ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </Select>
                      <Select label={t('checkout.area')} value={zone} required disabled={!city} error={errors.area && cityId ? errors.area : undefined}
                        onChange={(e) => setZone(e.target.value)}>
                        <option value="" disabled>{t('checkout.areaPlaceholder')}</option>
                        {(city?.zones ?? []).map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
                        <option value={OTHER_AREA}>{t('checkout.areaOther')}</option>
                      </Select>
                    </div>
                    <Input label={t('checkout.address')} hint={t('checkout.addressHint')} value={address} maxLength={CHECKOUT_LIMITS.address}
                      required autoComplete="street-address" error={errors.address} onChange={(e) => setAddress(e.target.value)} />
                  </>
                )
              )}

              {receive === 'PICKUP' && (
                <fieldset className="tx-cart__choices tx-cart__offices" aria-describedby={errors.office ? 'cart-office-error' : undefined}>
                  <legend className="tx-visually-hidden">{t('checkout.pickup', { company: COMPANY })}</legend>
                  {offices.map((o) => {
                    const key = o.city.toLowerCase();
                    const where = locale === 'fr' ? o.addressFr : o.address;
                    return (
                      <Radio key={key} name="cart-office" value={key} checked={office === key} error={!!errors.office}
                        onChange={() => setOffice(key)}
                        label={key === 'buea' ? t('checkout.officeBuea', { address: where }) : t('checkout.officeDouala', { address: where })} />
                    );
                  })}
                  {errors.office && <p className="tx-error" id="cart-office-error">{errors.office}</p>}
                  {office === 'douala' && <p className="tx-hint">{t('checkout.doualaNote')}</p>}
                </fieldset>
              )}

              <Textarea label={t('checkout.note')} value={note} maxLength={CHECKOUT_LIMITS.note} rows={3} onChange={(e) => setNote(e.target.value)} />
            </fieldset>

            <fieldset className="tx-cart__card tx-cart__part" aria-describedby={errors.payment ? 'cart-pay-error' : undefined}>
              <legend className="tx-cart__legend">{t('checkout.pay')}</legend>
              <div className="tx-cart__methods">
                {methods.map((m) => (
                  <label key={m} className={`tx-check tx-cart__method${payment === m ? ' is-checked' : ''}${errors.payment ? ' tx-check--error' : ''}`}>
                    <input type="radio" name="cart-pay" value={m} checked={payment === m} aria-invalid={errors.payment ? true : undefined}
                      onChange={() => setPayment(m)} />
                    <span>
                      <strong>{t(`checkout.methods.${m}.label`)}</strong>
                      <span className="tx-cart__muted">{t(`checkout.methods.${m}.help`)}</span>
                    </span>
                  </label>
                ))}
              </div>
              {errors.payment && <p className="tx-error" id="cart-pay-error">{errors.payment}</p>}
            </fieldset>
          </div>

          <aside className="tx-cart__card tx-cart__aside" aria-labelledby="cart-summary-title">
            <h2 className="tx-cart__legend" id="cart-summary-title">{t('checkout.summary')}</h2>
            <ul className="tx-cart__summary-lines">
              {lines.map((l) => (
                <li key={l.id}>
                  <span>{l.qty} × {l.name}<span className="tx-cart__code tx-cart__nowrap">{l.code}</span></span>
                  <span className="tx-cart__money">{money(unitPrice(l) * l.qty, l.currency)}</span>
                </li>
              ))}
            </ul>
            <dl className="tx-cart__totals" aria-live="polite">
              <div><dt>{t('checkout.subtotal')}</dt><dd>{money(subtotal, currency)}</dd></div>
              <div><dt>{t('checkout.deliveryFee')}</dt><dd>{feeText}</dd></div>
              <div className="tx-cart__total">
                <dt>{knownFee === null && fee.kind !== 'choose' && fee.kind !== 'loading' ? t('checkout.totalToConfirm') : t('checkout.total')}</dt>
                <dd>{money(subtotal + (knownFee ?? 0), currency)}</dd>
              </div>
            </dl>
            <Checkbox
              checked={terms}
              error={!!errors.terms}
              aria-describedby={errors.terms ? 'cart-terms-error' : undefined}
              onChange={(e) => setTerms(e.target.checked)}
              label={withNodes(termsText,
                <Link page="legal" param="terms" target="_blank">{t('checkout.termsLink')}</Link>,
                <Link page="legal" param="returns" target="_blank">{t('checkout.returnsLink')}</Link>)}
            />
            {errors.terms && <p className="tx-error" id="cart-terms-error">{errors.terms}</p>}
            {formError && <p className="tx-error tx-cart__form-error" role="alert">{formError}</p>}
            <Button type="submit" size="lg" block disabled={sending}>{sending ? t('checkout.placing') : t('checkout.place')}</Button>
            <Button type="button" variant="ghost" block onClick={() => goTo('cart')}>{t('checkout.backToCart')}</Button>
          </aside>
        </form>
      </>
    );
  }

  return (
    <div className="tx-shop tx-cart">
      {hero}
      <section className="tx-shop__section" aria-labelledby="cart-title">
        <div className="tx-shop__wrap">{body}</div>
      </section>
    </div>
  );
};
