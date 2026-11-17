// Shop tables (docs/SHOP_SPEC.md §4) and the one-time grant of the shop permissions to the
// existing roles (§3). Takes the connection as a parameter so tests can use their own database;
// server/db.ts calls initShopSchema(db) from initDatabase(), after the IAM schema. No products,
// categories, orders or settings are ever created here (CLAUDE.md rule 9). Money is stored as
// whole currency units with its currency (normally XAF); times as epoch ms.
import type { DatabaseSync } from 'node:sqlite';
import { PERMISSIONS, SEEDED_ROLES, SUPER_ADMIN_ROLE_ID } from '../../src/shared/permissions.js';

/** Keys of the Shop permission group (shop.* and orders.*, SHOP_SPEC §3). */
const SHOP_GROUP_KEYS: ReadonlySet<string> = new Set(PERMISSIONS.filter((p) => p.group === 'shop').map((p) => p.key));

export function createShopTables(conn: DatabaseSync): void {
  conn.exec(`
    -- One level of nesting: parent_id NULL = top level.
    CREATE TABLE IF NOT EXISTS shop_categories (
      id TEXT PRIMARY KEY,
      parent_id TEXT,
      slug_en TEXT NOT NULL UNIQUE,
      slug_fr TEXT NOT NULL UNIQUE,
      name_en TEXT NOT NULL,
      name_fr TEXT NOT NULL,
      description_en TEXT,
      description_fr TEXT,
      image_media_id TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_visible INTEGER NOT NULL DEFAULT 1,
      created_at_ts INTEGER NOT NULL,
      updated_at_ts INTEGER NOT NULL,
      updated_by TEXT
    );

    -- product_code: TX-PRD-######, assigned by the server, never changed or reused.
    -- status: DRAFT | IN_REVIEW | PUBLISHED | HIDDEN | ARCHIVED (src/shared/shopProduct.ts).
    -- pending_changes_json: a writer's proposed edits to a published product, applied on approval.
    CREATE TABLE IF NOT EXISTS shop_products (
      id TEXT PRIMARY KEY,
      product_code TEXT NOT NULL UNIQUE,
      slug_en TEXT NOT NULL UNIQUE,
      slug_fr TEXT NOT NULL UNIQUE,
      name_en TEXT NOT NULL,
      name_fr TEXT,
      short_en TEXT,
      short_fr TEXT,
      description_en_json TEXT,
      description_fr_json TEXT,
      description_en_html TEXT,
      description_fr_html TEXT,
      price INTEGER NOT NULL,
      sale_price INTEGER,
      currency TEXT NOT NULL DEFAULT 'XAF',
      stock_qty INTEGER NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
      low_stock_at INTEGER,
      max_per_order INTEGER,
      size_class TEXT NOT NULL DEFAULT 'SMALL',
      weight_kg REAL,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      is_featured INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      seo_title_en TEXT,
      seo_title_fr TEXT,
      seo_description_en TEXT,
      seo_description_fr TEXT,
      pending_changes_json TEXT,
      pending_by TEXT,
      pending_at_ts INTEGER,
      review_note TEXT,
      created_by TEXT NOT NULL,
      published_by TEXT,
      published_at_ts INTEGER,
      created_at_ts INTEGER NOT NULL,
      updated_at_ts INTEGER NOT NULL,
      updated_by TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_shop_products_status ON shop_products (status, is_featured, sort_order);

    CREATE TABLE IF NOT EXISTS shop_product_categories (
      product_id TEXT,
      category_id TEXT,
      PRIMARY KEY (product_id, category_id)
    );
    CREATE INDEX IF NOT EXISTS idx_shop_product_categories_category ON shop_product_categories (category_id);

    -- One square picture in all its sizes (SHOP_SPEC §6): WebP (JPEG when the browser can't
    -- encode WebP) at 1200/600/300 px and JPEG at 1200/600 px, under UPLOADS_DIR/shop/.
    CREATE TABLE IF NOT EXISTS shop_media (
      id TEXT PRIMARY KEY,
      file_1200 TEXT NOT NULL,
      file_600 TEXT NOT NULL,
      file_300 TEXT NOT NULL,
      jpg_1200 TEXT NOT NULL,
      jpg_600 TEXT NOT NULL,
      bytes_total INTEGER NOT NULL,
      uploaded_by TEXT NOT NULL,
      created_at_ts INTEGER NOT NULL
    );

    -- position 0 = main picture; at most 8 per product (checked in code).
    CREATE TABLE IF NOT EXISTS shop_product_images (
      product_id TEXT NOT NULL,
      media_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      alt_en TEXT,
      alt_fr TEXT,
      PRIMARY KEY (product_id, media_id)
    );
    CREATE INDEX IF NOT EXISTS idx_shop_product_images_order ON shop_product_images (product_id, position);

    -- Every change to stock_qty. reason: INITIAL | ORDER | CANCEL | RETURN | ADJUST.
    CREATE TABLE IF NOT EXISTS shop_stock_moves (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL,
      order_id TEXT,
      note TEXT,
      user_id TEXT,
      stock_after INTEGER NOT NULL,
      at_ts INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_shop_stock_moves_product ON shop_stock_moves (product_id, at_ts);

    -- order_number: TX-ORD-######. status / payment_status / payment_method / delivery_method /
    -- delivery_fee_status: src/shared/shopOrderStatus.ts. delivery_fee NULL while TO_CONFIRM.
    -- anonymised_at_ts: contact and delivery details removed 2 years after the order closed (§17).
    CREATE TABLE IF NOT EXISTS shop_orders (
      id TEXT PRIMARY KEY,
      order_number TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'UNPAID',
      payment_method TEXT NOT NULL,
      payment_reference TEXT,
      paid_at_ts INTEGER,
      paid_by TEXT,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_whatsapp TEXT,
      customer_email TEXT,
      locale TEXT NOT NULL,
      delivery_method TEXT NOT NULL,
      city_id TEXT,
      zone_id TEXT,
      pickup_office TEXT,
      address_text TEXT,
      landmark TEXT,
      customer_note TEXT,
      subtotal INTEGER NOT NULL,
      delivery_fee INTEGER,
      delivery_fee_status TEXT NOT NULL,
      total INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'XAF',
      job_id TEXT,
      tracking_id TEXT,
      cancel_reason TEXT,
      anonymised_at_ts INTEGER,
      idempotency_key TEXT UNIQUE,
      created_at_ts INTEGER NOT NULL,
      updated_at_ts INTEGER NOT NULL,
      updated_by TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_shop_orders_status ON shop_orders (status, created_at_ts);
    CREATE INDEX IF NOT EXISTS idx_shop_orders_job ON shop_orders (job_id);

    -- A snapshot: later product edits never change an old order.
    CREATE TABLE IF NOT EXISTS shop_order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_code TEXT NOT NULL,
      name_en TEXT NOT NULL,
      name_fr TEXT,
      unit_price INTEGER NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      line_total INTEGER NOT NULL,
      media_id TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_shop_order_items_order ON shop_order_items (order_id);
    CREATE INDEX IF NOT EXISTS idx_shop_order_items_product ON shop_order_items (product_id);

    -- The order's timeline in the console. kind: STATUS | PAYMENT | FEE | NOTE | EMAIL.
    CREATE TABLE IF NOT EXISTS shop_order_events (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      from_value TEXT,
      to_value TEXT,
      note TEXT,
      user_id TEXT,
      at_ts INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_shop_order_events_order ON shop_order_events (order_id, at_ts);
  `);
}

/** Settings row that records the one-time grant below, so it never runs twice. */
export const SHOP_GRANT_MIGRATION_KEY = 'migration.shop_permissions_v1';

/**
 * Roles are seeded only into an empty `roles` table (IAM_RBAC_SPEC §4), so a database created
 * before the shop has Marketing, Operations Manager and Finance without the shop keys. This gives
 * each of those roles (found by its stable id, only if it still exists) the shop keys it has in
 * SEEDED_ROLES, once. Later changes to roles belong to the Super Admin and are never overwritten:
 * the migration is recorded and skipped from then on. Returns the number of grants added.
 */
export function grantShopPermissionsOnce(conn: DatabaseSync, now: number = Date.now()): number {
  const done = conn.prepare('SELECT 1 AS x FROM settings WHERE key = ?').get(SHOP_GRANT_MIGRATION_KEY);
  if (done) return 0;

  conn.exec('BEGIN');
  try {
    const roleExists = conn.prepare('SELECT 1 AS x FROM roles WHERE id = ?');
    const grant = conn.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_key) VALUES (?, ?)');
    let added = 0;
    for (const role of SEEDED_ROLES) {
      if (role.id === SUPER_ADMIN_ROLE_ID) continue;
      const shopKeys = role.permissions.filter((k) => SHOP_GROUP_KEYS.has(k));
      if (shopKeys.length === 0 || !roleExists.get(role.id)) continue;
      for (const key of shopKeys) added += Number(grant.run(role.id, key).changes);
    }
    conn.prepare('INSERT INTO settings (key, value_json) VALUES (?, ?)')
      .run(SHOP_GRANT_MIGRATION_KEY, JSON.stringify({ doneAt: now, added }));
    conn.exec('COMMIT');
    return added;
  } catch (err) {
    conn.exec('ROLLBACK');
    throw err;
  }
}

/** Tables, then the one-time role grant. Safe to run on every start. */
export function initShopSchema(conn: DatabaseSync): void {
  createShopTables(conn);
  grantShopPermissionsOnce(conn);
}
