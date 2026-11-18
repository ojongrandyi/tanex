// One-time move of the browser storage keys from the old `ngf_` names to `tx_` (tracker I.3).
// Runs before the first render. A value already stored under the new name wins; the old key is
// removed either way, so this does nothing once a browser has been migrated.

/** Old key → new key. */
export const LEGACY_STORAGE_KEYS: ReadonlyArray<readonly [string, string]> = [
  ['ngf_recent_tracking', 'tx_recent_tracking'],
  ['ngf_units', 'tx_units'],
  ['ngf_live_shipment_stream', 'tx_live_shipment_stream'],
  ['ngf_seen_proofs', 'tx_seen_proofs'],
  ['ngf_admin_shipment_draft', 'tx_admin_shipment_draft'],
];

type KeyStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Returns how many values were moved. Never throws (private mode, blocked storage). */
export function migrateLegacyStorageKeys(store: KeyStore | null | undefined): number {
  if (!store) return 0;
  let moved = 0;
  for (const [from, to] of LEGACY_STORAGE_KEYS) {
    try {
      const old = store.getItem(from);
      if (old === null) continue;
      if (store.getItem(to) === null) {
        store.setItem(to, old);
        moved++;
      }
      store.removeItem(from);
    } catch {
      // Storage unavailable or full: leave this key alone.
    }
  }
  return moved;
}

/** localStorage, or null when the browser refuses access to it. */
export function browserLocalStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}
