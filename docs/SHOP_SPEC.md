# Shop (Marketplace) Specification

> Part of the TanEx plan (`docs/TANEX_PLAN.md`). Tracker phase **M**. Needs IAM (B), path routing + i18n (D), the new
> design (E), the blog's review and media patterns (F) and dispatch (G). Written 2026-11-17 from the owner's answers.

## 1. Goal

TanEx sells **its own products** on tanexsarl.com. Staff add and manage 50–100 products in the console; customers
browse `/shop` (EN) or `/fr/boutique` (FR), fill a cart and **place an order without paying online**. Each order
reaches the console (**Shop → Orders**) and **info@tanexsarl.com** with every product's ID. TanEx calls the customer
to confirm, takes payment (cash, MTN MoMo or Orange Money, outside the website) and delivers with its own couriers
through the existing dispatch system, so the customer gets a normal TX tracking ID.

Simple to use, like a small WooCommerce shop, built to the platform's standards: bilingual, honest, permission-checked
on the server, light, and with **every product picture the same size and shape**.

## 2. Owner decisions (2026-11-17)

| # | Decision |
|---|---|
| 1 | The shop lives **on this site**. It is what the hidden **Marketplace** header button (#140) opens. |
| 2 | **TanEx only** sells. No other sellers. |
| 3 | About **50–100 products**, added by TanEx staff (Marketing), not by the developer. No sample products (CLAUDE.md rule 9). |
| 4 | **Square (1:1)** pictures everywhere: main picture and gallery. |
| 5 | Delivery fee = the **existing local delivery rates** (and intercity rates for other cities), see §9. |
| 6 | Payment methods: **cash on delivery, MTN MoMo, Orange Money, pay at the office on pickup**. No online payment. |
| 7 | Orders are emailed to **info@tanexsarl.com** (owner changed this from sales@ the same day: no separate sales mailbox); the customer also gets an email when they give an address. Keep emails few and simple. |
| 8 | **Marketing, Finance and Operations** can see orders (who can change what: §3). |
| 9 | **Exact stock quantities** are tracked. |
| 10 | A professional **Returns & Refunds policy** (CONTENT §13.2), **approved by the owner**, linked in the footer without breaking the 5-row columns (§18). |
| 11 | Orders **ship from the Buea head office** (Check Point). Customers can **pick up at the Buea or the Douala office** (§9). |
| 12 | The Marketplace button is called **« Boutique »** in French. |
| 13 | Prices entered by staff are **final prices** (any tax included); receipts show no separate tax line. |
| 14 | Order data is kept as professional shops do: accounting records 10 years, contact details removed after 2 years (§17). |

## 3. Roles and permissions

New keys in `src/shared/permissions.ts` (group **Shop**), checked on the server for every console route:

| Permission | Can |
|---|---|
| `shop.view` | See the console Shop area: products, categories (read-only). |
| `shop.write` | Create products, edit drafts, submit for review, propose changes to a published product (§7.3). |
| `shop.publish` | Publish, hide, archive; approve or send back products and proposed changes. **The admin's approval step.** |
| `shop.stock` | Change stock quantities (with a reason) on any product, including published ones; applies at once. |
| `shop.categories` | Create, edit, order and hide categories. |
| `orders.view` | See orders and customer details. |
| `orders.manage` | Confirm, set the delivery fee, prepare, send to dispatch, mark collected, cancel, record a return. |
| `orders.payment` | Record and confirm payments and refunds on orders. |
| `shop.settings` | Shop on/off, order email, ship-from point, payment methods, stock defaults. |

**Default grants** (Super Admin has everything):

| Role | Shop permissions |
|---|---|
| Marketing | `shop.view`, `shop.write`, `shop.stock`, `shop.categories`, `orders.view` |
| Operations Manager | `shop.view`, `shop.stock`, `orders.view`, `orders.manage` |
| Finance | `shop.view`, `orders.view`, `orders.payment` |
| Super Admin | all, including `shop.publish` and `shop.settings` |

The Super Admin can give `shop.publish` to anyone later in Roles. Roles are seeded only into an empty
`roles` table (IAM_RBAC_SPEC §4), so a **one-time migration** adds these keys to the existing Marketing, Operations
Manager and Finance roles (by role id, only if the role still exists, recorded so it never runs twice).

## 4. Data model (additions only, created in `initDatabase()`)

Bilingual fields sit on one row (unlike blog posts): a product has one price and one stock count in both languages.
**English and French name, short description and slug are required to publish** (server check); drafts may be
incomplete.

```sql
shop_categories (
  id TEXT PRIMARY KEY,
  parent_id TEXT,                           -- NULL = top level; one level of nesting only
  slug_en TEXT NOT NULL UNIQUE, slug_fr TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL, name_fr TEXT NOT NULL,
  description_en TEXT, description_fr TEXT,
  image_media_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_visible INTEGER NOT NULL DEFAULT 1,
  created_at_ts INTEGER NOT NULL, updated_at_ts INTEGER NOT NULL, updated_by TEXT
)

shop_products (
  id TEXT PRIMARY KEY,
  product_code TEXT NOT NULL UNIQUE,        -- TX-PRD-123456, server-assigned, never changes or gets reused
  slug_en TEXT NOT NULL UNIQUE, slug_fr TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL, name_fr TEXT,
  short_en TEXT, short_fr TEXT,             -- one or two sentences for cards and meta
  description_en_json TEXT, description_fr_json TEXT,   -- TipTap documents (editing source)
  description_en_html TEXT, description_fr_html TEXT,   -- sanitised HTML (rendering source)
  price INTEGER NOT NULL,                   -- in currency units; XAF has no decimals
  sale_price INTEGER,                       -- NULL = no sale; must be lower than price
  currency TEXT NOT NULL DEFAULT 'XAF',
  stock_qty INTEGER NOT NULL DEFAULT 0,     -- never below 0
  low_stock_at INTEGER,                     -- NULL = shop default (§7.5)
  max_per_order INTEGER,                    -- NULL = shop default
  size_class TEXT NOT NULL DEFAULT 'SMALL', -- SMALL | MEDIUM | LARGE (DISPATCH_SPEC §5), for the delivery fee
  weight_kg REAL,                           -- for intercity weight bands
  status TEXT NOT NULL DEFAULT 'DRAFT',     -- DRAFT | IN_REVIEW | PUBLISHED | HIDDEN | ARCHIVED
  is_featured INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  seo_title_en TEXT, seo_title_fr TEXT, seo_description_en TEXT, seo_description_fr TEXT,
  pending_changes_json TEXT,                -- proposed edits to a PUBLISHED product (§7.3); NULL = none
  pending_by TEXT, pending_at_ts INTEGER,
  review_note TEXT,                         -- reason given when sent back
  created_by TEXT NOT NULL, published_by TEXT, published_at_ts INTEGER,
  created_at_ts INTEGER NOT NULL, updated_at_ts INTEGER NOT NULL, updated_by TEXT
)
shop_product_categories (product_id TEXT, category_id TEXT, PRIMARY KEY (product_id, category_id))

shop_media (                                -- one square picture in all its sizes (§6)
  id TEXT PRIMARY KEY,
  file_1200 TEXT NOT NULL, file_600 TEXT NOT NULL, file_300 TEXT NOT NULL,   -- WebP (JPEG if the browser can't encode WebP)
  jpg_1200 TEXT NOT NULL, jpg_600 TEXT NOT NULL,                             -- JPEG fallback, email and share images
  bytes_total INTEGER NOT NULL,
  uploaded_by TEXT NOT NULL, created_at_ts INTEGER NOT NULL
)
shop_product_images (
  product_id TEXT NOT NULL, media_id TEXT NOT NULL,
  position INTEGER NOT NULL,                -- 0 = main picture; at most 8 pictures per product
  alt_en TEXT, alt_fr TEXT,                 -- defaults to the product name when empty
  PRIMARY KEY (product_id, media_id)
)

shop_stock_moves (                          -- every change to stock_qty, so the count can always be explained
  id TEXT PRIMARY KEY, product_id TEXT NOT NULL,
  delta INTEGER NOT NULL,                   -- −2 for an order of 2, +2 when it is cancelled
  reason TEXT NOT NULL,                     -- INITIAL | ORDER | CANCEL | RETURN | ADJUST
  order_id TEXT, note TEXT, user_id TEXT,   -- user NULL for a website order
  stock_after INTEGER NOT NULL, at_ts INTEGER NOT NULL
)

shop_orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,        -- TX-ORD-123456
  status TEXT NOT NULL,                     -- §10.1
  payment_status TEXT NOT NULL DEFAULT 'UNPAID',  -- UNPAID | PAID | REFUNDED
  payment_method TEXT NOT NULL,             -- CASH_ON_DELIVERY | MTN_MOMO | ORANGE_MONEY | PAY_AT_OFFICE
  payment_reference TEXT, paid_at_ts INTEGER, paid_by TEXT,
  customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL, customer_whatsapp TEXT, customer_email TEXT,
  locale TEXT NOT NULL,                     -- en | fr: language of the customer's emails
  delivery_method TEXT NOT NULL,            -- DELIVERY | PICKUP
  city_id TEXT, zone_id TEXT,               -- DELIVERY: the customer's city and area (dispatch tables)
  pickup_office TEXT,                       -- PICKUP: office key from shop settings
  address_text TEXT, landmark TEXT, customer_note TEXT,
  subtotal INTEGER NOT NULL,
  delivery_fee INTEGER,                     -- NULL while the fee is to be confirmed
  delivery_fee_status TEXT NOT NULL,        -- QUOTED | TO_CONFIRM | NONE (pickup)
  total INTEGER NOT NULL,                   -- subtotal + delivery_fee (or subtotal while TO_CONFIRM)
  currency TEXT NOT NULL DEFAULT 'XAF',
  job_id TEXT, tracking_id TEXT,            -- set when sent to dispatch (§13)
  cancel_reason TEXT,
  anonymised_at_ts INTEGER,                 -- set when contact details are removed (§17)
  idempotency_key TEXT UNIQUE,              -- from the checkout form, so a double submit makes one order
  created_at_ts INTEGER NOT NULL, updated_at_ts INTEGER NOT NULL, updated_by TEXT
)
shop_order_items (                          -- a snapshot: later product edits never change an old order
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL, product_id TEXT NOT NULL,
  product_code TEXT NOT NULL, name_en TEXT NOT NULL, name_fr TEXT,
  unit_price INTEGER NOT NULL, quantity INTEGER NOT NULL, line_total INTEGER NOT NULL,
  media_id TEXT
)
shop_order_events (                         -- the order's timeline in the console (audit_log also gets every write)
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL,
  kind TEXT NOT NULL,                       -- STATUS | PAYMENT | FEE | NOTE | EMAIL
  from_value TEXT, to_value TEXT, note TEXT, user_id TEXT, at_ts INTEGER NOT NULL
)
```

**Shop settings** are stored with the existing settings (keys `shop.*`), never in code: `enabled` (default off),
`orderEmail` (default `info@tanexsarl.com`, the brand `EMAIL`), `shipFromCityId` + `shipFromZoneId` +
`shipFromLandmark` (Buea head office), `pickupOffices` (which offices accept pickups: Buea and Douala), `paymentMethods` (which of the four are offered), `lowStockAt`
(default 3), `maxPerOrder` (default 10).

Products that have orders are never deleted: **Archive** hides them. A draft with no orders can be deleted.

## 5. Product IDs and order numbers

Added to `src/shared/references.ts` (the shared reference module, BRAND_GUIDE §7):

| Kind | Prefix | Example | Rule |
|---|---|---|---|
| Product | `TX-PRD-` | `TX-PRD-482915` | Assigned by the server when the product is first saved; read-only; unique; never reused. |
| Order | `TX-ORD-` | `TX-ORD-037614` | Assigned by the server when the order is placed; unique. |

`REFERENCE_PATTERN` gains `PRD|ORD`. The server retries on the rare collision (unique index). The **product ID** is
shown on the product page, in the cart, on every order line in the console, in both emails and on the dispatch job's
item description, so the customer, sales and the warehouse all speak about the same item.

## 6. Pictures: always square, always the same sizes

The project rule (docs/update.md, BLOG_SPEC §4) stands: **no image library on the server** (`sharp` is unreliable on
shared hosting). The **browser** makes the files; the **server** refuses anything that is not exactly right. Staff
cannot upload a picture of the wrong size, because the console only uploads what its crop step produced.

**In the console (crop step, lazy console chunk, no new dependency):**
1. Accepts JPG, PNG, WebP (and AVIF/HEIC where the browser can decode it), up to 20 MB before processing.
   EXIF orientation is applied (`createImageBitmap(…, { imageOrientation: 'from-image' })`).
2. Opens a **square frame**: drag to move, slider or pinch to zoom, rotate 90°. Starting point chosen automatically:
   - picture already near square (ratio 0.9–1.1): fills the frame, centred;
   - otherwise **Fit whole picture**: the whole picture inside the square on a plain background, so nothing is cut.
   A toggle switches between **Fill** and **Fit**; the background for Fit is **White** (default) or **Cream 50**.
3. A square crop smaller than 400 px on the source is refused ("This photo is too small. Use a larger photo.");
   400–1199 px is accepted with a warning that it may look soft.
4. Draws the result on a canvas and exports **1200, 600, 300 px WebP** (quality 0.85) and **1200, 600 px JPEG**
   (quality 0.85, flattened on the background colour). Each step down halves the size for sharp results. Redrawing
   strips EXIF, including GPS. If the browser cannot encode WebP (the blob comes back as PNG), JPEG is used for
   those slots instead.
5. Shows the result before upload. Many files can be queued; each gets its own crop step (Skip = automatic start).

**On the server (`POST /api/admin/shop/media`, `shop.write` or `shop.categories`):**
- Checks every file by its bytes (`server/uploads.ts`), reads its pixel size (`server/imageSize.ts`) and refuses the
  upload unless each file is **exactly** 1200×1200, 600×600 or 300×300 as its slot says, the right type, and under
  its byte cap (WebP 1200: 700 KB, 600: 250 KB, 300: 90 KB; JPEG 1200: 800 KB, 600: 280 KB; `src/shared/shopImages.ts`). Random file names under `UPLOADS_DIR/shop/`, served from
  `/media/shop/…` with long immutable cache headers.
- Product: at most **8** pictures; position 0 is the main picture. Category: one picture.

**On the website (safety net):** every product picture sits in a box with `aspect-ratio: 1 / 1`,
`object-fit: cover` and a neutral background, with `width="1200" height="1200"`, `srcset` 300w/600w/1200w (WebP in
`<picture>`, JPEG fallback) and a `sizes` attribute. Lazy below the fold; the product page's main picture and the
first row of the grid load first (`fetchpriority="high"` on the product page only). Cards, gallery, thumbnails,
cart lines, console lists and emails all use the same square files, so the grid always lines up.

## 7. Console (lazy chunk, `src/admin/shop/`)

Sidebar group **Shop**: Products · Categories · Orders (badge: number of NEW orders) · Shop settings. Each item shows
only with its permission. Dashboard tiles: new orders, low-stock products.

### 7.1 Products list
Table: main picture (square), name, product ID, price (sale price shown), stock (amber when at or below the low-stock
level, red at 0), status, categories, last updated. Filters: status (incl. **Needs review**: in review or with
proposed changes), category, stock (all / low / out). Search by name or product ID. Buttons: New product.

### 7.2 Product editor
One page with a sticky status bar. Sections:
- **Details**: EN | FR tabs for name, slug (made from the name, editable), short description, description (TipTap
  with a reduced toolbar: headings, bold, italic, lists, links; reused from the Blog studio, sanitised on the server).
- **Pictures**: upload area, crop step (§6), drag to reorder, "Make main picture", alt text EN/FR, remove.
- **Price and stock**: price (FCFA), sale price, stock quantity (new products: the starting stock; later changes go
  through **Adjust stock**, §7.4), low-stock level, max per order.
- **Delivery**: size class (Small / Medium / Large with the dispatch pictograms) and weight in kg.
- **Categories** (multi-select) and **Featured**.
- **SEO**: title and description EN/FR (fall back to name and short description), with a search-result preview.
- Status bar: `Save draft` · `Submit for review` (writers) · `Publish` / `Send back with a note` (publishers) ·
  `Preview` (signed short-lived link, as the blog) · `Hide` / `Archive` (publishers). Unsaved-changes warning.

### 7.3 Review ("if accepted by the admin")
- A writer creates a product → **DRAFT** → `Submit for review` → **IN_REVIEW** (writers can still edit it).
  A publisher **Publishes** it (→ PUBLISHED) or **Sends it back** with a note (→ DRAFT, note shown at the top).
- A writer editing a **published** product does not change the live page. Their edits are saved as **proposed
  changes** (`pending_changes_json`); the live product keeps its current text, price and pictures. The publisher sees
  a before/after comparison and **Approves** (applied at once) or **Rejects** with a note.
- **Stock is the exception**: anyone with `shop.stock` changes it at once (§7.4), because stock must match the shelf.
- Publishers' own edits apply directly. Every step writes `audit_log`.

### 7.4 Stock
`Adjust stock` dialog: new quantity or +/−, reason (Received, Counted, Damaged, Other + note). Writes a
`shop_stock_moves` row. A product's **Stock history** lists every move (orders, cancellations, returns, adjustments)
with who and when.

### 7.5 Categories
Tree (one level): name EN/FR, slug EN/FR, description EN/FR, square picture, visible, drag to order. A category with
products cannot be deleted until they are moved (message says how many). Hidden categories disappear from the shop
but their products stay visible in other categories.

### 7.6 Orders
- **List** with tabs: New · Confirmed · Ready · Out for delivery · Completed · Cancelled/Returned. Columns: order
  number, date, customer, city or Pickup, items, total, payment (method + status), status. Search by order number,
  phone or product ID.
- **Order page**: customer (call and WhatsApp buttons via `src/shared/whatsapp.ts`), delivery details, item lines
  with square picture, **product ID**, name, unit price, quantity, line total; subtotal, delivery fee, total; status
  buttons allowed by §10.1; **Set delivery fee** while it is to be confirmed; **Payment** panel (§11); **Send to
  dispatch** (§13) and the tracking ID once sent; timeline (`shop_order_events`); internal note; **Print** (packing
  slip on the print stylesheet: order number, product IDs, quantities, customer, delivery details).
- New orders also raise a console notification (existing notifications module, NOTIFICATIONS_SPEC).

### 7.7 Shop settings (`shop.settings`)
Shop on/off (public pages and the Marketplace button appear only when on) · order email · ship-from city, area and
landmark · pickup offices · payment methods offered · low-stock level · max per order · `Send a test order email`.

## 8. Public pages (EN + FR, lazy page chunk)

Routes in `src/router/routes.ts` (category route listed before the shop route, as for the blog):

| Page | EN | FR |
|---|---|---|
| Shop (all products) | `/shop` | `/fr/boutique` |
| Category | `/shop/category/<slug>` | `/fr/boutique/categorie/<slug>` |
| Product | `/shop/<slug>` | `/fr/boutique/<slug>` |
| Cart and checkout | `/cart` | `/fr/panier` |

Slugs `category` and `categorie` are reserved. While the shop is off these pages answer 404 and are not in the
sitemap. Each product and category has its own slug per language, so the language switch lands on the same product.

- **Header:** the **Marketplace** button (FR « Boutique », owner 2026-11-17) next to the menu, and a **cart icon**
  with the item count once the cart is not empty. Must still fit at 1100 px in French; the mobile drawer lists both.
- **Shop page:** eyebrow, H1 and intro from CONTENT §17; category chips; search; sort (Featured, Newest, Price low to
  high, Price high to low); "In stock only" toggle; grid of square cards (2 columns at 375, 3 at 768, 4 at 1440) with
  picture, name, price (sale: new price + crossed-out old price), stock badge (`Only 2 left` at or below the
  low-stock level, `Out of stock` at 0), `Add to cart` (disabled when out of stock). 24 per page, real pagination
  links. Empty state while no product is published (no fake products).
- **Category page:** same grid filtered, category name and description.
- **Product page:** breadcrumbs; **gallery** (main square + thumbnails; swipe on phones; arrow keys; tap opens a
  full-screen viewer with zoom; focus trapped and Escape closes); name; price; stock line; quantity (1 to the lower
  of stock and max per order); `Add to cart`; `Ask on WhatsApp` (pre-filled with the product name and **product
  ID**); `Product ID: TX-PRD-482915`; delivery line (CONTENT §17); description; links to Returns & Refunds and
  Shipping Terms; **related products** (same category, in stock first, max 4).
- **Cart and checkout (one page, two steps):**
  1. **Cart**: lines (picture, name, product ID, price, quantity stepper, remove), subtotal. Prices and stock are
     re-read from the server every time the cart opens (`POST /api/shop/cart/check`); a changed price or stock is
     shown clearly before checkout ("The price of … changed", "Only 1 left: quantity reduced").
  2. **Your details**: full name · phone (Cameroon number, validated) · WhatsApp (`Same as phone` ticked by default)
     · email (optional: "for your order confirmation") · **Delivery** or **Pick up at our office** · for delivery:
     city (delivery cities and intercity destinations from the dispatch tables) → area (zones of that city) →
     address or landmark · note · **payment method** (those enabled in settings, with short explanations) ·
     ☐ "I accept the Terms of Service and the Returns & Refunds policy" (links) · summary with subtotal, delivery
     fee (`We'll confirm the delivery fee` when no rate matches) and total · **Place order**.
  - **After placing:** confirmation on the same page: order number, items with product IDs, total, what happens next
    ("We'll call you to confirm your order"), the MoMo / Orange Money numbers for those methods with "Use your order
    number as the payment reference, after we confirm your order", and a WhatsApp button. The cart is emptied.
- **Cart storage:** `tx_cart` in localStorage (product ids and quantities only, never prices). Added to the Cookie
  Policy's storage list.

## 9. Delivery fee

Computed by the **same shared functions as the local delivery form** (`src/shared/localPricing.ts`), on the client
for display and again on the server, which stores its own result:
- **Pickup at the office:** fee 0, `delivery_fee_status = NONE`. Offices: **Buea head office** and **Douala
  (Kotto, La Canadienne)**. Stock is kept in Buea, so TanEx moves a Douala pickup order to Douala itself at no cost to
  the customer; the order is READY only when the goods are at the chosen office, and staff call the customer then.
  The checkout says so ("Douala pickups can take a little longer; we'll call you when your order is ready").
- **Customer in the ship-from city:** local rate from the ship-from area to the customer's area, size class = the
  **largest size class** in the cart, standard (not express).
- **Customer in another city:** intercity rate for the city pair and the **total weight** of the cart (missing
  weights count as 0 and the fee becomes TO_CONFIRM if any item has none).
- **No matching rate:** the order is still placed with `delivery_fee_status = TO_CONFIRM`; the customer sees
  `We'll confirm the delivery fee`; staff set it from the order page before confirming (audit + timeline).
No price ever lives in code. Ship-from point: the **Buea head office** (owner 2026-11-17), set in shop settings as a
Buea area from Tariffs plus the landmark "Check Point, opposite Molyko Omnisport Stadium", so a customer in Buea pays
the local rate and a customer in Limbe or Douala pays the intercity rate.

## 10. Orders: flow, stock and rules

### 10.1 Status (server-enforced, `src/shared/shopOrderStatus.ts`, DOM-free)

```
NEW ─► CONFIRMED ─► READY ─► OUT_FOR_DELIVERY ─► DELIVERED
                       │
                       └─► (pickup) ─────────────► COLLECTED
NEW / CONFIRMED / READY ─► CANCELLED          (stock goes back)
DELIVERED / COLLECTED ─► RETURNED             (stock back only if staff tick "Put back in stock")
```
- **CONFIRMED** needs a delivery fee (or pickup): staff called the customer and agreed the order.
- **OUT_FOR_DELIVERY** is set by **Send to dispatch**; **DELIVERED** follows the dispatch job (§13).
- **CANCELLED** needs a reason; the customer gets the cancellation email (if they gave an email).

### 10.2 Placing an order (`POST /api/shop/orders`, public)
In **one SQLite transaction**: validate the form → re-read every product (must be PUBLISHED and in stock) → take
prices from the database (**prices sent by the browser are ignored**) → check quantities against stock and max per
order → compute the delivery fee (§9) → allocate the order number → insert the order, snapshot items and events →
**reserve stock** with `UPDATE shop_products SET stock_qty = stock_qty - ? WHERE id = ? AND stock_qty >= ?` for each
line (any line failing rolls the whole order back and returns 409 with the item and the quantity still available) →
write `shop_stock_moves` → queue the emails in the outbox. Two customers can never buy the last item twice.

Protection: rate limit (5 orders per 10 min per IP), a hidden honeypot field, at most 20 lines, server-side length
limits on every field, `idempotency_key` from the form so a double tap or a retry returns the same order.

## 11. Payment (no online payment)

- Methods: **Cash on delivery** · **MTN MoMo** (+237 651 05 93 45) · **Orange Money** (+237 691 19 46 63) · **Pay at
  the office on pickup**. Numbers and account names come from the existing payment-method settings
  (`src/shared/paymentMethods.ts`), never typed into shop code.
- The customer is asked to pay mobile money **only after TanEx confirms the order** (stock and fee settled), with the
  order number as the reference.
- `orders.payment` users record the payment on the order page: method, amount, transaction reference →
  **PAID** (audit + timeline). **Refund** records the refund method and reference → REFUNDED.
- **Cash on delivery** with dispatch: the job carries the order total as COD (§13). When Finance **confirms** that
  job's cash or mobile money row in the cash ledger (G.8), the order becomes **PAID** automatically; a rejected row
  leaves it UNPAID with a timeline note. One writer does this, in the same transaction as the ledger change.

## 12. Emails (outbox, EN/FR templates in `server/mail/templates/`)

| Template | To | When | Content |
|---|---|---|---|
| `shop.order_staff_alert` | order email (info@tanexsarl.com) | order placed | Subject `New order TX-ORD-037614 · 3 items · 45,000 FCFA`. Customer, phone, WhatsApp link, delivery or pickup details, **every line with product ID**, quantity and price, totals, payment method, link to the order in the console. Reply-To = the customer's email when given. |
| `shop.order_received` | customer (if email) | order placed | Order number, items with product IDs and pictures, totals, "We'll call you to confirm", payment instructions, Returns & Refunds link. |
| `shop.order_dispatched` | customer (if email) | sent to dispatch | Tracking ID and track link. |
| `shop.order_cancelled` | customer (if email) | cancelled | Order number, reason, contact. |

That is all ("keep it simple"). Customer emails use the order's language; the staff alert is in English. Every
email sent is a timeline event.

*Built with M.6:* `server/shop/orderEmails.ts` queues the two order-placed emails as the last step of the order
transaction and records each one queued as an `EMAIL` event (`to_value` = template key); M.7 calls
`queueOrderDispatchedEmail` / `queueOrderCancelledEmail`. Reply-To is stored per message (`email_outbox.reply_to`).
The staff alert is not under the hourly staff-alert cap (the order endpoint has its own limit); the customer
confirmation is under the per-address cap. The console link is `/private-user/#order=<number>`, opened by M.7.

## 13. Link to dispatch (DISPATCH_SPEC)

`Send to dispatch` (order READY, delivery method DELIVERY, `orders.manage` and `dispatch.manage` or a
dispatcher completes it) creates a normal job through the existing job code (`createJobShipment`, `writeTransition`):
- **LOCAL** when the customer's city is the ship-from city, otherwise **INTERCITY**;
- pickup = ship-from area and landmark; drop-off = the customer's area, address, landmark; recipient = the customer;
- item description = `Shop order TX-ORD-037614: 2 × TX-PRD-482915, 1 × TX-PRD-110238`; size class and weight as §9;
- price = the order's delivery fee; **COD = the order total** when the payment method is cash on delivery and the
  order is unpaid, otherwise 0;
- status starts at CONFIRMED (already priced and agreed with the customer), so it goes straight to the board.

The job's tracking ID is stored on the order and shown to the customer (email). Job **DELIVERED** → order DELIVERED.
Job **FAILED_ATTEMPT / RETURNED / CANCELLED** → the order stays OUT_FOR_DELIVERY with a red **Delivery problem**
flag and a timeline note, for staff to decide (retry, cancel, return). One writer applies these, in the job's
transaction.

*Built with M.7:* `server/shop/orderAdmin.ts` (console order actions, Send to dispatch, settings) and
`server/shop/orderSync.ts` (job → order inside `writeTransition`; confirmed cash → PAID inside the cash review).
When the job ends without a delivery (returned or cancelled), staff may put the order back to READY (job unlinked,
sent again later) or cancel it. The job price is the agreed delivery fee; payer TanEx; COD as above.

## 14. API (summary)

Public (rate-limited, only PUBLISHED products in visible categories, only while the shop is on):
`GET /api/shop/products?category=&q=&sort=&page=&inStock=&locale=` · `GET /api/shop/products/:slug?locale=` ·
`GET /api/shop/categories?locale=` · `POST /api/shop/cart/check` · `POST /api/shop/delivery-fee` · `POST /api/shop/orders`.
Public responses never include stock numbers above the low-stock level (only "in stock" / "only n left" / "out of
stock"), drafts, pending changes or staff names.

Console (each with its permission, §3): products CRUD, submit/publish/send-back/approve/reject/hide/archive,
stock adjust + history, media upload, categories CRUD + order, orders list/detail/status/fee/payment/refund/note/
dispatch, settings, test email. Every write → `audit_log`. Errors use the shared API error codes (`apiErrors.ts`).

## 15. SEO

Server-rendered title, description, canonical and hreflang EN/FR for shop, category and product pages
(`server/seo.ts`, `publicPages.ts`, as for the blog). JSON-LD: `Product` with `sku` = product ID, `image` (1200 JPEG),
`offers` (price, `priceCurrency` XAF, `availability` InStock/OutOfStock, `seller` = Tanex SARL) and
`BreadcrumbList`. No ratings or reviews markup (we have none). Sitemap: published products and visible categories in
both languages. Share image = the product's 1200 JPEG.

## 16. Performance and accessibility

- Public shop code is its own lazy chunk (target ≤ 40 KB gzip), no new public libraries; the gallery viewer loads on
  first tap. Console shop code, crop step and TipTap live in the console chunk. MOTION_3D_SPEC §2 budgets apply.
- Grid and gallery have no layout shift (fixed square boxes). Images as §6.
- Keyboard: gallery, quantity stepper, cart and checkout fully usable; focus visible; errors announced and linked to
  their fields; price text never orange on light backgrounds; reduced motion disables gallery slide animations.

## 17. Security and privacy

- Every console route uses `requirePermission(...)`; publishing is checked on the server, never only hidden in the UI.
- Descriptions sanitised with the blog's sanitiser; slugs validated; numbers validated as integers ≥ 0; sale price
  below price; file uploads per §6.
- Orders hold personal data: visible only with `orders.view`; never in public APIs or logs; customer emails sent
  through the outbox only. The **Privacy Policy** gains a "Shop orders" paragraph (what we collect, why, how long we
  keep it) before launch (lawyer review, #11).
- **Retention (owner 2026-11-17: "as professional sites do"; the periods are for the lawyer to confirm with #11):**
  - **Order and money records** (order number, date, items with product IDs, prices, totals, payment method,
    payment and refund references, customer name, city): kept **10 years**, the period OHADA accounting rules set for
    accounting records.
  - **Contact and delivery details** not needed for the accounts (phone, WhatsApp, email, address, landmark, customer
    note): removed **2 years** after the order is completed, cancelled or returned. That covers returns, warranty
    questions and disputes. A daily server job blanks those fields, sets `anonymised_at_ts` and writes one audit
    entry per run. The dispatch job's copy follows the dispatch data rules.
  - The cart (`tx_cart`) stays only in the customer's browser and holds no personal data.
- No payment card or wallet data is ever collected.

## 18. Returns & Refunds policy and footer

- Text: **CONTENT §13.2 (EN) and CONTENT_FR §13.2 (FR), approved by the owner 2026-11-17** (lawyer review with #11).
  Published as a sixth tab of the Legal page: `/legal/returns` · `/fr/mentions-legales/returns` (tab id `returns`,
  like the other tab ids), from `src/data/legalDocs.ts`, in both languages, when the shop is switched on.
- **Footer (5-row columns kept):** the Legal column becomes Privacy Policy · Terms of Service · Shipping Terms ·
  **Returns & Refunds** · Cookie Policy. **Accessibility** moves to the bottom line through the existing overflow
  rule (`FOOTER_ROWS = 5`, Footer.tsx), where Rail transport already sits. No other column changes. CONTENT §1.3 is
  updated in the same commit.

## 19. Tests (`scripts/shop*.test.ts`, node:test)

Reference patterns and uniqueness (PRD/ORD) · slug rules and reserved slugs · publish needs EN + FR fields ·
permission matrix for every shop route (Marketing cannot publish, approve, change settings or record payments;
Finance cannot change stock) · proposed changes leave the live product unchanged until approved · media upload
refuses wrong sizes, wrong types, fake bytes and oversize files · server ignores browser prices · stock: two orders
for the last item → one 201, one 409; cancel restores stock; every change has a stock move · idempotent order submit ·
status machine refuses illegal moves · delivery fee equals the local delivery form's price for the same input, and
TO_CONFIRM when no rate · send to dispatch creates the right job (scope, COD) and job DELIVERED moves the order ·
confirmed cash row marks the order PAID · emails queued with every product ID · sitemap and public API show only
published products, nothing while the shop is off · no demo data in a fresh database.

## 20. Build order (tracker phase M)

M.0 this spec + copy (CONTENT §13.2, §17) · M.1 schema, references, status machine, permissions + role migration ·
M.2 media pipeline (crop step + upload checks) · M.3 console products, categories, review, stock · M.4 public shop
pages · M.5 cart, checkout, order API, delivery fee · M.6 emails · M.7 console orders, payments, dispatch link,
notifications, dashboard tiles · M.8 SEO, sitemap, Returns & Refunds tab, footer, Privacy/Cookie updates ·
M.9 QA (375/768/1440, EN + FR, permissions, budgets), then the owner switches the shop on and the Marketplace button
appears. Until M.9 the shop setting stays **off**, so nothing changes for customers.

## 21. Not in version 1

Online payment (MoMo API, cards), customer accounts and order history, coupons, product variants (size/colour),
reviews and ratings, wishlists, other sellers, delivery outside Cameroon, abandoned-cart emails, tax lines on
receipts (prices entered are the final prices customers pay, owner 2026-11-17). Each can be added later without changing the
tables above.
