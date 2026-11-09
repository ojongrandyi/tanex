import { useMemo } from 'react';
import { useAdminData } from '../context/AdminDataContext';
import { useLocale } from '../i18n/I18nProvider';
import { formatMoney, fromDisplayAmount, resolveCurrency, toDisplayAmount, currencySymbol, type ResolvedCurrency } from '../shared/currency';

// The display currency chosen in admin Settings, with helpers to show USD amounts in it.
export function useCurrency() {
  const { settings } = useAdminData();
  // Numbers follow the page language ("1,500 FCFA" / "1 500 FCFA").
  const locale = useLocale() === 'fr' ? 'fr-CM' : 'en-US';
  const resolved: ResolvedCurrency = useMemo(
    () => resolveCurrency(settings as any),
    [(settings as any)?.displayCurrency, JSON.stringify((settings as any)?.exchangeRates || {})]
  );
  return useMemo(() => ({
    ...resolved,
    symbol: currencySymbol(resolved.currency),
    /** USD amount -> "₦525,000.00" */
    format: (usd: unknown, decimals?: number) => formatMoney(usd, resolved, { decimals, locale }),
    toDisplay: (usd: number) => toDisplayAmount(usd, resolved),
    fromDisplay: (value: number) => fromDisplayAmount(value, resolved),
  }), [resolved, locale]);
}
