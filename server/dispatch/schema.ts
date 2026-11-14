// Dispatch and local-delivery tables (docs/DISPATCH_SPEC.md §3). Takes the connection as a parameter
// so tests can use their own database; server/db.ts calls createDispatchTables(db) from
// initDatabase(). The shipments.service_scope column is added with the other shipment migrations
// in server/db.ts. No cities, zones, rates, couriers or jobs are ever created here (CLAUDE.md rule 9):
// the admin enters them in the console. Money is stored with its currency (normally XAF).
import type { DatabaseSync } from 'node:sqlite';

export function createDispatchTables(conn: DatabaseSync): void {
  conn.exec(`
    -- Courier profile for a user with the Courier role. vehicle_type: BIKE | VAN | TRUCK.
    CREATE TABLE IF NOT EXISTS couriers (
      user_id TEXT PRIMARY KEY,
      vehicle_type TEXT NOT NULL,
      plate_number TEXT,
      home_city_id TEXT,
      public_first_name TEXT NOT NULL,
      show_photo_publicly INTEGER NOT NULL DEFAULT 0,
      photo_file TEXT,
      notes TEXT,
      is_on_duty INTEGER NOT NULL DEFAULT 0,
      created_at_ts INTEGER NOT NULL,
      updated_at_ts INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS delivery_cities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      country_iso TEXT NOT NULL DEFAULT 'CM',
      lat REAL,
      lng REAL,
      time_zone TEXT NOT NULL DEFAULT 'Africa/Douala',
      is_active INTEGER NOT NULL DEFAULT 1
    );

    -- aliases: comma-separated other names, for search.
    CREATE TABLE IF NOT EXISTS delivery_zones (
      id TEXT PRIMARY KEY,
      city_id TEXT NOT NULL,
      name TEXT NOT NULL,
      aliases TEXT,
      lat REAL,
      lng REAL,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_delivery_zones_city ON delivery_zones (city_id, sort_order);

    -- from_zone_id / to_zone_id NULL = any other zone (src/shared/localPricing.ts).
    -- size_class: SMALL | MEDIUM | LARGE.
    CREATE TABLE IF NOT EXISTS zone_rates (
      id TEXT PRIMARY KEY,
      city_id TEXT NOT NULL,
      from_zone_id TEXT,
      to_zone_id TEXT,
      size_class TEXT NOT NULL,
      price REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'XAF',
      express_surcharge REAL
    );
    CREATE INDEX IF NOT EXISTS idx_zone_rates_city ON zone_rates (city_id, size_class);

    -- Weight bands: the band with the smallest max_weight_kg that fits the parcel applies.
    CREATE TABLE IF NOT EXISTS intercity_rates (
      id TEXT PRIMARY KEY,
      from_city_id TEXT NOT NULL,
      to_city_id TEXT NOT NULL,
      max_weight_kg REAL NOT NULL,
      price REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'XAF'
    );
    CREATE INDEX IF NOT EXISTS idx_intercity_rates_pair ON intercity_rates (from_city_id, to_city_id, max_weight_kg);

    -- One pickup -> drop-off movement by one courier, linked to a shipment by its TX ID.
    -- scope: LOCAL | INTERCITY | FIRST_MILE | LAST_MILE; status: src/shared/dispatchStatus.ts.
    -- pickup_json / dropoff_json: { cityId, zoneId, landmark, directions, lat?, lng?, contactName, contactPhone }.
    CREATE TABLE IF NOT EXISTS dispatch_jobs (
      id TEXT PRIMARY KEY,
      tracking_number TEXT NOT NULL,
      scope TEXT NOT NULL,
      status TEXT NOT NULL,
      vehicle_required TEXT NOT NULL,
      courier_user_id TEXT,
      pickup_json TEXT NOT NULL,
      dropoff_json TEXT NOT NULL,
      size_class TEXT,
      weight_kg REAL,
      item_description TEXT,
      is_express INTEGER NOT NULL DEFAULT 0,
      scheduled_for_ts INTEGER,
      price REAL,
      currency TEXT NOT NULL DEFAULT 'XAF',
      price_overridden INTEGER NOT NULL DEFAULT 0,
      payer TEXT NOT NULL DEFAULT 'SENDER',
      cod_amount REAL,
      collect_delivery_fee INTEGER NOT NULL DEFAULT 0,
      delivery_code_hash TEXT,
      pod_recipient_name TEXT,
      pod_photo_file TEXT,
      pod_signature_file TEXT,
      pod_note TEXT,
      failure_reason TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      notify_locale TEXT NOT NULL DEFAULT 'en',
      requested_at_ts INTEGER,
      confirmed_at_ts INTEGER,
      assigned_at_ts INTEGER,
      accepted_at_ts INTEGER,
      picked_up_at_ts INTEGER,
      on_the_way_at_ts INTEGER,
      delivered_at_ts INTEGER,
      cancelled_at_ts INTEGER,
      eta_ts INTEGER,
      created_by TEXT,
      created_at_ts INTEGER NOT NULL,
      updated_at_ts INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_dispatch_jobs_tracking ON dispatch_jobs (tracking_number);
    CREATE INDEX IF NOT EXISTS idx_dispatch_jobs_status ON dispatch_jobs (status, updated_at_ts);
    CREATE INDEX IF NOT EXISTS idx_dispatch_jobs_courier ON dispatch_jobs (courier_user_id, status);

    -- Only recorded during active jobs; purged after 30 days.
    CREATE TABLE IF NOT EXISTS courier_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      courier_user_id TEXT NOT NULL,
      job_id TEXT,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      accuracy_m REAL,
      speed_mps REAL,
      heading REAL,
      recorded_at_ts INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_courier_locations_courier ON courier_locations (courier_user_id, recorded_at_ts);
    CREATE INDEX IF NOT EXISTS idx_courier_locations_job ON courier_locations (job_id, recorded_at_ts);
    CREATE INDEX IF NOT EXISTS idx_courier_locations_time ON courier_locations (recorded_at_ts);

    -- ref: TX-CSH-###### (src/shared/references.ts). entry_type: COLLECTED | HANDOVER | ADJUSTMENT;
    -- method: CASH | MTN_MOMO | ORANGE_MONEY; status: PENDING | CONFIRMED | REJECTED.
    CREATE TABLE IF NOT EXISTS cash_ledger (
      id TEXT PRIMARY KEY,
      ref TEXT UNIQUE NOT NULL,
      courier_user_id TEXT NOT NULL,
      job_id TEXT,
      entry_type TEXT NOT NULL,
      method TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'XAF',
      momo_reference TEXT,
      status TEXT NOT NULL,
      recorded_by TEXT NOT NULL,
      confirmed_by TEXT,
      note TEXT,
      created_at_ts INTEGER NOT NULL,
      confirmed_at_ts INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_cash_ledger_courier ON cash_ledger (courier_user_id, created_at_ts);
    CREATE INDEX IF NOT EXISTS idx_cash_ledger_status ON cash_ledger (status, created_at_ts);
    CREATE INDEX IF NOT EXISTS idx_cash_ledger_job ON cash_ledger (job_id);
  `);
}
