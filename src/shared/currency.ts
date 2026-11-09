// Money display (tracker 2.7). Shared by the browser and the server.
//
// Amounts are stored in USD — every existing record is. The admin picks a display currency in
// Settings (USD, XAF, NGN, GBP or EUR) and enters its exchange rate; prices are converted for
// display and admin price inputs are converted back to USD. A non-USD currency without a valid
// rate keeps showing USD, so a $350 quote can never appear as ₦350.

export const DISPLAY_CURRENCIES = ['USD', 'XAF', 'NGN', 'GBP', 'EUR'] as const;
export type DisplayCurrency = typeof DISPLAY_CURRENCIES[number];

export const CURRENCY_NAMES: Record<DisplayCurrency, string> = {
  USD: 'US dollar',
  XAF: 'Central African CFA franc',
  NGN: 'Nigerian naira',
  GBP: 'British pound',
  EUR: 'Euro',
};

export interface CurrencySettings {
  displayCurrency?: string;
  /** Units of each currency per 1 USD, e.g. { NGN: 1500 }. Entered by the admin. */
  exchangeRates?: Partial<Record<string, number>>;
}

export interface ResolvedCurrency {
  currency: DisplayCurrency;
  /** Display units per 1 USD (1 for USD). */
  rate: number;
  /** True when a non-USD currency was chosen but has no usable rate, so USD is shown instead. */
  missingRate: boolean;
}

export function resolveCurrency(settings: CurrencySettings | null | undefined): ResolvedCurrency {
  const chosen = (DISPLAY_CURRENCIES as readonly string[]).includes(settings?.displayCurrency || '')
    ? (settings!.displayCurrency as DisplayCurrency)
    : 'USD';
  if (chosen === 'USD') return { currency: 'USD', rate: 1, missingRate: false };
  const rate = Number(settings?.exchangeRates?.[chosen]);
  if (!Number.isFinite(rate) || rate <= 0) return { currency: 'USD', rate: 1, missingRate: true };
  return { currency: chosen, rate, missingRate: false };
}

/**
 * An amount in a currency for display. XAF is written the TanEx way, with no decimals and "FCFA"
 * after the number ("1,500 FCFA" / "1 500 FCFA", as the owner's flyer and src/i18n/format.ts);
 * other currencies use their symbol. `locale` is a BCP 47 tag; default en-US.
 */
export function formatCurrencyAmount(amount: number, currency: string, locale = 'en-US', decimals?: number): string {
  const code = (currency || '').toUpperCase();
  if (code === 'XAF' || code === 'XOF') {
    const n = new Intl.NumberFormat(locale, { minimumFractionDigits: decimals ?? 0, maximumFractionDigits: decimals ?? 0 }).format(amount);
    return `${n}\u00A0${code === 'XAF' ? 'FCFA' : 'F CFA'}`;
  }
  const d = decimals ?? 2;
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol', minimumFractionDigits: d, maximumFractionDigits: d }).format(amount);
  } catch {
    return `${amount.toFixed(d)} ${code}`;
  }
}

/** Formats a USD amount in the display currency, e.g. "₦525,000.00", "$350.00" or "1,500 FCFA". */
export function formatMoney(usdAmount: unknown, resolved: ResolvedCurrency, options: { decimals?: number; locale?: string } = {}): string {
  const n = typeof usdAmount === 'string' ? parseFloat(usdAmount) : typeof usdAmount === 'number' ? usdAmount : NaN;
  const amount = Number.isFinite(n) ? n * resolved.rate : 0;
  if (resolved.currency === 'XAF') return formatCurrencyAmount(amount, 'XAF', options.locale, options.decimals);
  // XAF has no minor units, so it is shown without decimals unless a caller asks otherwise.
  const decimals = options.decimals ?? 2;
  return new Intl.NumberFormat(options.locale || 'en-US', {
    style: 'currency',
    currency: resolved.currency,
    // "₦525,000.00" rather than "NGN 525,000.00"
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

export const toDisplayAmount = (usd: number, resolved: ResolvedCurrency) => usd * resolved.rate;
export const fromDisplayAmount = (value: number, resolved: ResolvedCurrency) => Math.round((value / resolved.rate) * 10000) / 10000;

/** The currency's symbol on its own (e.g. "₦"), for input adornments and labels. */
export function currencySymbol(currency: DisplayCurrency): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
    .formatToParts(0)
    .find((p) => p.type === 'currency')?.value || currency;
}
