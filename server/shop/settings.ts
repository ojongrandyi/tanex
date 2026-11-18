// Shop settings as stored (settings table, key 'shop'; SHOP_SPEC §4, §7.7). Anything missing or
// invalid reads as the default, so a fresh database has the shop switched off.
import type { DatabaseSync } from 'node:sqlite';
import { SHOP_SETTINGS_KEY, readShopSettings, type ShopSettings } from '../../src/shared/shopSettings.js';

export function loadShopSettings(conn: DatabaseSync): ShopSettings {
  const row = conn.prepare('SELECT value_json FROM settings WHERE key = ?').get(SHOP_SETTINGS_KEY) as { value_json: string } | undefined;
  try {
    return readShopSettings(row ? JSON.parse(row.value_json) : undefined);
  } catch {
    return readShopSettings(undefined);
  }
}
