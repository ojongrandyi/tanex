# Dispatch & Local Delivery Specification

> Part of the TanEx plan (`docs/TANEX_PLAN.md`). Tracker phase **G**. Needs IAM (phase B) and path routing/i18n
> (phase D).

## 1. Goal

TanEx delivers **inside a city** (Buea, Limbe, Douala: e.g. one Buea address to another) by **bike**, and **between
cities** by **truck/van**. Each courier (rider or driver) has **their own account** and updates the jobs assigned to
them from a phone. Customers follow the delivery live with the normal TX tracking ID. Admins oversee every job,
every courier and every franc of cash collected.

## 2. Concepts

| Term | Meaning |
|---|---|
| **Courier** | A user with the Courier role plus a courier profile. Vehicle: `BIKE`, `VAN` or `TRUCK`. UI calls bike couriers "riders" and truck/van couriers "drivers". |
| **Dispatch Manager** | Office staff who price, assign and monitor jobs (`dispatch.manage`). |
| **Delivery city** | A city where TanEx runs in-town delivery: seeded by the admin (Buea, Limbe, Douala to start). |
| **Zone** | A named area of a city (a neighbourhood or group of neighbourhoods) created by the admin. |
| **Job** | One pickup→drop-off movement done by one courier (`dispatch_jobs`). Linked to a shipment (TX ID). |
| **Scope** | `LOCAL` (same city), `INTERCITY` (city to city by road), or a first/last-mile leg of an `INTERNATIONAL` shipment (collection from the customer's door to the TanEx office, or office to the recipient). |

## 3. Data model (additions only)

```sql
couriers (
  user_id TEXT PRIMARY KEY,               -- users.id
  vehicle_type TEXT NOT NULL,             -- BIKE | VAN | TRUCK
  plate_number TEXT, home_city_id TEXT,
  public_first_name TEXT NOT NULL,        -- what customers see
  show_photo_publicly INTEGER NOT NULL DEFAULT 0,   -- courier's consent
  photo_file TEXT, notes TEXT,
  is_on_duty INTEGER NOT NULL DEFAULT 0,  -- courier toggles at shift start/end
  created_at_ts INTEGER NOT NULL, updated_at_ts INTEGER NOT NULL
)
delivery_cities (id TEXT PRIMARY KEY, name TEXT NOT NULL, country_iso TEXT NOT NULL DEFAULT 'CM',
                 lat REAL, lng REAL, time_zone TEXT NOT NULL DEFAULT 'Africa/Douala', is_active INTEGER NOT NULL DEFAULT 1)
delivery_zones (id TEXT PRIMARY KEY, city_id TEXT NOT NULL, name TEXT NOT NULL, aliases TEXT,  -- comma list for search
                lat REAL, lng REAL, is_active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0)
zone_rates (id TEXT PRIMARY KEY, city_id TEXT NOT NULL, from_zone_id TEXT, to_zone_id TEXT,   -- NULL = any zone
            size_class TEXT NOT NULL,       -- SMALL | MEDIUM | LARGE
            price REAL NOT NULL, currency TEXT NOT NULL DEFAULT 'XAF', express_surcharge REAL)
intercity_rates (id TEXT PRIMARY KEY, from_city_id TEXT NOT NULL, to_city_id TEXT NOT NULL,
                 max_weight_kg REAL NOT NULL, price REAL NOT NULL, currency TEXT NOT NULL DEFAULT 'XAF')
dispatch_jobs (
  id TEXT PRIMARY KEY,                     -- 'job_' + random
  tracking_number TEXT NOT NULL,           -- shipments.tracking_number (TX ID)
  scope TEXT NOT NULL,                     -- LOCAL | INTERCITY | FIRST_MILE | LAST_MILE
  status TEXT NOT NULL,                    -- see §4
  vehicle_required TEXT NOT NULL,          -- BIKE | VAN | TRUCK
  courier_user_id TEXT,                    -- assigned courier
  pickup_json TEXT NOT NULL,               -- { cityId, zoneId, landmark, directions, lat?, lng?, contactName, contactPhone }
  dropoff_json TEXT NOT NULL,              -- same shape
  size_class TEXT, weight_kg REAL, item_description TEXT,
  is_express INTEGER NOT NULL DEFAULT 0, scheduled_for_ts INTEGER,
  price REAL, currency TEXT NOT NULL DEFAULT 'XAF', price_overridden INTEGER NOT NULL DEFAULT 0,
  payer TEXT NOT NULL DEFAULT 'SENDER',    -- SENDER | RECIPIENT
  cod_amount REAL,                         -- cash to collect for the goods (if any), separate from the delivery price
  collect_delivery_fee INTEGER NOT NULL DEFAULT 0,  -- courier collects the delivery price on the spot
  delivery_code_hash TEXT,                 -- optional 4-digit handover code (stored hashed)
  pod_recipient_name TEXT, pod_photo_file TEXT, pod_signature_file TEXT, pod_note TEXT,
  failure_reason TEXT, attempts INTEGER NOT NULL DEFAULT 0,
  notify_locale TEXT NOT NULL DEFAULT 'en',
  requested_at_ts INTEGER, confirmed_at_ts INTEGER, assigned_at_ts INTEGER, accepted_at_ts INTEGER,
  picked_up_at_ts INTEGER, on_the_way_at_ts INTEGER, delivered_at_ts INTEGER, cancelled_at_ts INTEGER,
  eta_ts INTEGER, created_by TEXT, created_at_ts INTEGER NOT NULL, updated_at_ts INTEGER NOT NULL
)
courier_locations (id INTEGER PRIMARY KEY AUTOINCREMENT, courier_user_id TEXT NOT NULL, job_id TEXT,
                   lat REAL NOT NULL, lng REAL NOT NULL, accuracy_m REAL, speed_mps REAL, heading REAL,
                   recorded_at_ts INTEGER NOT NULL)          -- purged after 30 days
cash_ledger (id TEXT PRIMARY KEY, ref TEXT UNIQUE NOT NULL,   -- TX-CSH-######
             courier_user_id TEXT NOT NULL, job_id TEXT,
             entry_type TEXT NOT NULL,     -- COLLECTED | HANDOVER | ADJUSTMENT
             method TEXT NOT NULL,         -- CASH | MTN_MOMO | ORANGE_MONEY
             amount REAL NOT NULL, currency TEXT NOT NULL DEFAULT 'XAF',
             momo_reference TEXT,          -- transaction ID when the customer paid the company MoMo/OM account
             status TEXT NOT NULL,         -- PENDING | CONFIRMED | REJECTED
             recorded_by TEXT NOT NULL, confirmed_by TEXT, note TEXT,
             created_at_ts INTEGER NOT NULL, confirmed_at_ts INTEGER)
-- shipments: ADD COLUMN service_scope TEXT  (INTERNATIONAL | LOCAL | INTERCITY; NULL = INTERNATIONAL for older rows)
```

Money in dispatch tables is stored **with its currency** (normally XAF). It doesn't go through the USD canonical
conversion that the older quote/shipment fields use (Decisions log 2026-09-28).

**No seeded prices or demo data** (CLAUDE.md rule 9). Cities/zones are created by the admin. A suggested starting
list of neighbourhood names is offered as a one-click import in the Tariffs screen, **without prices**, owner to
review: Buea (Molyko, Check Point, Bonduma, Great Soppo, Small Soppo, Bokwango, Buea Town, Mile 16, Mile 17, Muea,
Bomaka, Clerks Quarters, GRA), Limbe (Down Beach, Church Street, Mile 4, Bota, Mile 2, Ngeme, Batoke road,
Middle Farms), Douala (Akwa, Bonanjo, Bonapriso, Bali, Deido, Bonaberi, Makepe, Bonamoussadi, Logbaba, Ndokotti,
Bepanda, Kotto, PK zones). `[confirm]`

## 4. Job lifecycle (server-enforced state machine, `src/shared/dispatchStatus.ts`)

| From | To | Who | Writes tracking event (public title) | Shipment status |
|---|---|---|---|---|
| (new, public form) | `REQUESTED` | customer | "Delivery requested" | `BOOKED` |
| (new, staff) / `REQUESTED` | `CONFIRMED` | dispatch | "Delivery confirmed" | `BOOKED` |
| `CONFIRMED` / `FAILED_ATTEMPT` | `ASSIGNED` | dispatch | "Courier assigned" | `BOOKED` |
| `ASSIGNED` | `ACCEPTED` | courier | (none; internal) | n/a |
| `ASSIGNED` | `CONFIRMED` (declined) | courier | (none) | n/a |
| `ACCEPTED` | `PICKED_UP` | courier | "Picked up by {rider first name}" | `RECEIVED` (Collected) |
| `PICKED_UP` | `ON_THE_WAY` | courier | "On the way to the recipient" | `OUT_FOR_DELIVERY` |
| `ON_THE_WAY` | `DELIVERED` | courier (POD required) | "Delivered, received by {masked name}" | `DELIVERED` |
| `ON_THE_WAY` | `FAILED_ATTEMPT` | courier (reason required) | "Delivery attempt unsuccessful: {reason}" | `DELAYED` |
| `FAILED_ATTEMPT` | `RETURNED` | dispatch | "Returned to sender" | `RETURNED` |
| any before `PICKED_UP` | `CANCELLED` | dispatch | "Delivery cancelled" | (shipment trashed or kept, dispatch's choice) |

- Each transition sets its `*_at_ts`, writes `tracking_events` (`recorded_by` = user display name; event time in
  `Africa/Douala`), an `audit_log` entry, and recomputes `progress_percent` (0/20/40/60/100).
- `server/progress.ts` must **not** auto-advance shipments whose `service_scope` is `LOCAL` or `INTERCITY`
  (they move only on real courier updates).
- **Delivered requires POD:** recipient name + photo; if a delivery code was set, the code must match (5 tries,
  then dispatch override with reason). Signature capture is optional (canvas, saved as PNG).
- Failure reasons (fixed list, bilingual): recipient unreachable, recipient absent, wrong address, refused, unsafe
  to deliver, vehicle problem, other (note required).

## 5. Pricing (admin-defined)

`tariffs.manage` users configure per city: zones, and a rate table by **from-zone → to-zone × size class**
(`NULL` zone = "any other zone" fallback), an optional **express surcharge**, and **intercity** rates by city pair
and weight band. The quote shown to customers is computed by the same shared function used by the server
(`src/shared/localPricing.ts`); if no rate matches, the form says "We'll confirm your price" and the job stays
`REQUESTED` until dispatch prices it. Dispatch can **override** any job's price (reason recorded in audit).

Size classes (shown with simple pictograms): **Small**, fits in a backpack (documents, phone, small parcel) ·
**Medium**, fits on the bike's carrier box (≈ shoebox to small carton) · **Large**, needs a van/truck. `[confirm the
limits]`

## 6. Courier app (`src/courier/`, lazy chunk, mobile-first, EN/FR)

Opened at `/private-user/` for users with `courier.app` (installable: a courier web-app manifest scoped to the admin
path; app-shell cached by a small service worker).

Screens:
1. **Today:** on-duty toggle; job cards in order (pickup / drop-off zone + landmark, size, COD amount, express
   badge); unseen-assignment highlight with sound/vibration when allowed.
2. **Job detail:** pickup and drop-off cards with **Call** (`tel:`), **WhatsApp** (click-to-chat), **Open in Maps**
   (`geo:`/Google Maps link); a small Leaflet map; the next-action button (big, bottom):
   Accept / Decline → Picked up → On my way → Delivered / Couldn't deliver.
3. **Proof of delivery:** recipient name, photo (camera input, compressed in the browser with the existing
   `src/services/imageCompress.ts`), optional signature, delivery code (if set), cash collected (prefilled with
   COD + fee when applicable; method Cash / MTN MoMo / Orange Money + reference).
4. **Cash:** my balance (collected − handed over, by currency), pending handovers, "Record handover" (amount,
   note) → Finance confirms.
5. **History** (last 30 days) and **Profile** (language, password, photo consent).

Field realities (Cameroon networks): every courier action is **queued locally** (IndexedDB) and retried until the
server confirms; the UI shows "Saved on phone, will sync" vs "Synced". Actions carry the device time and a
client-generated id so a retried action is never applied twice (idempotency key).

**Location sharing:** while a job is `PICKED_UP` or `ON_THE_WAY` and the app is open, `watchPosition` sends a point
every 20 s (or 50 m moved), and the Screen Wake Lock API keeps the screen on when supported. A web app cannot track
in the background; the UI tells the courier to keep the app open during deliveries. A native app is a later option
(tracker G.10). Location is never collected outside active jobs.

## 7. Dispatch board (`dispatch.view` / `dispatch.manage`)

- **Columns:** Requested · To assign · Assigned · In progress · Problems (failed, late, stale location) ·
  Done today. Filter by city, vehicle, courier.
- **Map:** couriers on duty with their last position (marker greys out after 2 min without a ping), active job routes
  (pickup → drop-off).
- **Assign:** suggests couriers on duty in the same city with the right vehicle, sorted by distance from the pickup
  and current load. Reassign keeps history.
- **Create job** (phone/walk-in orders): same form as the public one plus price override, COD, payer, delivery code.
- **Courier list:** status, today's jobs, cash balance, last ping.
- Refresh every 15 s; counts in the sidebar badge.

## 8. Customer side

- **Booking** (`/local-delivery`, linked from the Bike section, Services and the header "Ship" menu): city,
  pickup zone + landmark/directions + contact, drop-off zone + landmark + recipient name/phone (required), size,
  express?, who pays, optional COD, preferred time, optional map pin. Shows the admin price or "We'll confirm your
  price". On submit: TX tracking ID, a **WhatsApp link** to share tracking with the recipient, and an email
  confirmation if an email was given.
- **Track page for local/intercity jobs:** stepper (Requested → Courier assigned → Picked up → On the way →
  Delivered), courier first name (+ photo only with consent), vehicle type, live marker on a city map (only while
  `PICKED_UP`/`ON_THE_WAY`; position shown only if fresher than 2 min), approximate ETA ("about 15 min"), POD
  summary after delivery (masked recipient name, time). Polls every 20 s while active.
- **ETA:** distance from the last position to the drop-off × 1.4 (road factor) ÷ average speed per vehicle
  (admin setting; defaults bike 18 km/h, van/truck 30 km/h in town). Always labelled approximate. No dependency on
  the public OSRM server for live ETAs (its usage policy is not for production traffic).
- **Privacy:** recipient phone and names are masked on the public page; precise courier position is visible only
  during active delivery and only on that job's page.

## 9. Cash and payments

- **COD & fees:** when the courier records `COLLECTED`, a `cash_ledger` row (PENDING) is created. The courier's
  balance = confirmed+pending collected − confirmed handovers. Finance (`cash.confirm`) confirms handovers and can
  add adjustments (reason required). Daily per-courier report (screen + CSV export).
- **Company MoMo:** customers can pay the delivery fee or COD to the company's MTN MoMo / Orange Money accounts.
  The courier (or customer, via the existing proof-of-payment flow) records the transaction reference; Finance
  confirms it against the company wallet statement. No automatic MoMo API in v1 (aggregators such as MTN MoMo API,
  Campay or NotchPay charge fees and need a business contract; option recorded in the tracker).
- New payment method types for the existing payment-request module: **MTN Mobile Money** (account name, MoMo
  number, optional merchant code / USSD instructions) and **Orange Money** (same fields). Icons: local SVGs with
  proper licence notes (update.md §4 rules).

## 10. Notifications (NOTIFICATIONS_SPEC)

WhatsApp click-to-chat templates (EN/FR, per `notify_locale`): booking confirmation with tracking link · courier
assigned (with courier first name) · on the way (with live link) · delivered · failed attempt. Buttons appear in the
dispatch board and courier app at the right moment; each tap is logged in `notification_log`. Email versions are
sent automatically when an email address is known.

## 11. API (summary)

| Method & path | Permission |
|---|---|
| `POST /api/local-delivery/quote` · `POST /api/local-delivery` | public (rate-limited) |
| `GET /api/track/:id` | public; adds `localDelivery` block (stepper, courier first name, last position if fresh, ETA) |
| `GET/POST/PATCH /api/dispatch/jobs`, `POST /api/dispatch/jobs/:id/assign`, `/cancel`, `/return` | `dispatch.view` / `dispatch.manage` |
| `GET /api/dispatch/board` (jobs + courier positions, one call) | `dispatch.view` |
| `GET/POST/PATCH /api/couriers` | `couriers.view` / `couriers.manage` (creates user + courier profile in one step) |
| `GET/PUT /api/tariffs/*` (cities, zones, rates, intercity) | `tariffs.manage` (GET of active cities/zones is public) |
| `GET /api/courier/jobs`, `POST /api/courier/jobs/:id/action` (idempotency key), `POST /api/courier/location`, `POST /api/courier/pod/:id` (multipart) | `courier.app` + own job |
| `GET/POST /api/cash/*` | `cash.view` / `cash.confirm`; couriers see and record their own |

## 12. Tests

State machine (every allowed and forbidden transition); courier can't act on another courier's job; idempotent
action replay; POD required for DELIVERED; local shipments don't auto-advance; pricing lookup fallbacks; cash
balance arithmetic; location purge; public track never exposes phone numbers or stale positions.
