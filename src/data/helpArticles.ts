// Help Centre knowledge base structure (docs/CONTENT.md §8.2, §8.5). The questions and answers
// live in the i18n area "help" (src/i18n/{en,fr}/help.ts) under `articles.<key>`; this file only
// orders them and groups them. Used by the Help page and by "Quick answers" on the Contact page.

export type HelpCategory = 'tracking' | 'booking' | 'customs' | 'documents' | 'local' | 'payments';

export const HELP_CATEGORIES: readonly HelpCategory[] = ['tracking', 'booking', 'customs', 'documents', 'local', 'payments'];

/** Dictionary key of each article (src/i18n/en/help.ts → articles). */
export type HelpArticleKey =
  | 'findId' | 'notUpdated' | 'multiPiece'
  | 'cutOff' | 'packing' | 'changeAddress'
  | 'duties' | 'customsDocuments' | 'prohibited'
  | 'pod' | 'damaged'
  | 'localAreas' | 'localPrice' | 'localCod' | 'localUnavailable' | 'localMap'
  | 'payMethods' | 'payMomoProof';

export interface HelpArticle {
  /** Stable anchor id (kept from before the TanEx copy, so old links still open the answer). */
  id: string;
  key: HelpArticleKey;
  category: HelpCategory;
}

export const HELP_ARTICLES: readonly HelpArticle[] = [
  { id: 'find-id', key: 'findId', category: 'tracking' },
  { id: 'not-updated', key: 'notUpdated', category: 'tracking' },
  { id: 'multi-piece', key: 'multiPiece', category: 'tracking' },
  { id: 'cut-off', key: 'cutOff', category: 'booking' },
  { id: 'packing', key: 'packing', category: 'booking' },
  { id: 'change-address', key: 'changeAddress', category: 'booking' },
  { id: 'duties', key: 'duties', category: 'customs' },
  { id: 'customs-documents', key: 'customsDocuments', category: 'customs' },
  { id: 'prohibited', key: 'prohibited', category: 'customs' },
  { id: 'pod', key: 'pod', category: 'documents' },
  { id: 'damaged', key: 'damaged', category: 'documents' },
  // CONTENT §8.5 (added for TanEx)
  { id: 'local-areas', key: 'localAreas', category: 'local' },
  { id: 'local-price', key: 'localPrice', category: 'local' },
  { id: 'local-cod', key: 'localCod', category: 'local' },
  { id: 'local-unavailable', key: 'localUnavailable', category: 'local' },
  { id: 'local-map', key: 'localMap', category: 'local' },
  { id: 'pay-methods', key: 'payMethods', category: 'payments' },
  { id: 'pay-momo-proof', key: 'payMomoProof', category: 'payments' },
];

/** CONTENT §8.4: the quick answers shown on the Contact page. */
export const CONTACT_QUICK_ANSWER_IDS = ['find-id', 'change-address', 'duties', 'damaged'];
