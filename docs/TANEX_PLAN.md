# TanEx Platform Plan (master document)

> **Read this first** when you start work on TanEx. It records what the owner decided, how the system is shaped,
> and the order we build in. Feature details live in the specs listed in §6. Progress is tracked in
> `docs/PROJECT_TRACKER.md`; the step-by-step build prompts are in `PROMPTS.md`.

**Context.** This repository is a working logistics platform (public site, tracking engine, Express/SQLite API,
admin console, documents, quotes, package photos, payments). It was previously branded for another client. We are
**adapting it for TanEx**: new brand, a complete visual redesign, and four new capabilities: **staff accounts with
roles (IAM/RBAC)**, a **blog**, **in-town and intercity dispatch with courier accounts**, and a **GSAP + Three.js
scroll journey on the homepage**. We extend the existing code; we don't rewrite it (CLAUDE.md §0).

---

## 1. Owner decisions (2026-11-06)

| Topic | Decision |
|---|---|
| Brand name | **TanEx** (as written on the logo and uniform). Legal name **Tanex SARL**. |
| Tagline | **From Your Door to the World** (FR: *De votre porte au monde entier*). |
| Domain / email | **tanexsarl.com** (`www.` redirects to the apex) · **info@tanexsarl.com** |
| Offices | **Buea (head office):** Check Point, directly opposite Molyko Omnisport Stadium · **Douala:** Kotto, La Canadienne (owner flyer `images/tanex files/info.png`) |
| Phone | +237 651 05 93 45 · +237 691 19 46 63 |
| Opening hours | 9:00 AM – 4:00 PM (days to confirm) |
| Marketing facts (flyer) | Slogan "Saving Situations"; "Delivery all over Buea from 500 CFA"; "Send goods abroad: from Cameroon to the world"; social handle Tanex_2025 |
| Still to supply | Which number is on WhatsApp, opening days, social profile URLs, wall-sign line, and **which domain is right** (brief: tanexsarl.com; flyer: tanexx.com) |
| Coverage | **Worldwide** shipping, plus **in-town delivery** inside **Buea, Limbe and Douala** (e.g. one Buea address to another Buea address) and **intercity truck delivery** between cities. |
| Languages | **English and French**, public site, courier app and (later) admin console. |
| Primary CTA | Stays **Get a Quote** (the "Market Place" note is dropped). |
| Homepage | Owner's outline: Hero · Services · **Bike delivery** · **Truck delivery** · Global network · Smart labels · Get in touch · FAQ · Blog · Footer (CONTENT §2). |
| Services | Air · Maritime · Rail · Road · Warehousing · Local delivery (copy written from best available knowledge, marked `[confirm]`). |
| Roles | Use the recommended set (§4.1). The Super Admin creates more. |
| Local pricing | **Set by the admin** (zones and rates per city; per-job override). Nothing is pre-priced in code. |
| Cash | Couriers **collect cash on delivery**; customers can also pay to the **company MoMo accounts** (MTN MoMo, Orange Money). |
| WhatsApp | Customers get WhatsApp messages and it must be **free** → click-to-chat links (§3.6). |
| Email | We set up SMTP sending (Hostinger mailbox). |
| Currency / payment methods | Keep **all** existing methods; add MTN MoMo, Orange Money, cash. Default display currency **XAF (FCFA)**; others stay available. |
| Tracking ID | **`TX` + 6 characters = 8**, e.g. **`TX7K2M9P`**; references `TX-TKT-`, `TX-INV-`, `TX-SL-`, `TX-CSH-` + 6 digits; quotes keep `QR-YYYY-#####`. |
| Visual design / imagery / 3D | "Use best recommended": see BRAND_GUIDE and MOTION_3D_SPEC. A design direction is shown to the owner **before** pages are built (tracker C.1). |

Assumptions to confirm with the owner are listed in the tracker under **Blocked / Needs owner**.

---

## 2. What changes and what stays

**Stays (proven, keep working after every change):** Express 5 + `node:sqlite` server, tracking engine and public
track page, shipment creation, tracking events, Document Center PDFs, quotes and the public quote link, package
photos, payment requests and proof of payment, contact messages, Leaflet maps, soft-delete/restore, the
server-assigned tracking IDs, `DB_PATH`/`UPLOADS_DIR`, compression and cache headers, the `/private-user/` admin path.

**Changes:**
1. Brand: name, logo, colours, fonts usage, copy, IDs (`TX`), DB file (`tanex.db`), package name (`tanex`).
2. Identity: one shared password → **named user accounts, roles and permissions**, a persistent session store and an
   audit log.
3. Routing: hash routes (`#/services`) → **real paths** (`/services`, `/fr/services`, `/blog/<slug>`) so pages and
   posts can be indexed; the server injects per-page meta.
4. Languages: an **i18n layer** (English + French).
5. New modules: **Blog**, **Dispatch** (couriers, jobs, courier app, live location, cash ledger), **Notifications**
   (email outbox + WhatsApp links).
6. Design: a new design system (chocolate, cream, a little orange) applied to every public page, then the admin.
7. Motion: **the Journey**: the whole homepage is one scroll-scrubbed story in which a 3D TanEx bike rides down the page through every section (GSAP ScrollTrigger + one Three.js Stage), Apple/Nike style, lazy-loaded within budget with static posters as fallbacks.

---

## 3. Architecture

### 3.1 Shape (unchanged principle: one Node process, one domain)

```
tanexsarl.com  (one Hostinger Node.js app)
├── /, /services, /about, /contact, /help, /legal, /locations, /quote, /ship   public (EN)
├── /fr/...                                                                  public (FR)
├── /track, /track/:id, /quote/:id                                           tracking + quote result
├── /blog, /blog/:slug, /blog/category/:slug, /blog/rss.xml                  blog (EN), /fr/blog/... (FR)
├── /private-user/        one login for all staff; the UI shown depends on permissions:
│     ├── Operations console (shipments, tracking, documents, quotes, messages, payments)
│     ├── Dispatch board     (jobs, assignment, live courier map, cash)
│     ├── Blog studio        (posts, categories, media)
│     ├── Users & Roles, Audit log, Settings (Super Admin)
│     └── Courier app        (mobile-first, installable: my jobs, status, proof of delivery, cash)
├── /api/*                Express API; every non-public route checks a permission
└── /media/*              public uploaded images (package photos, blog images)
```

### 3.2 Data (SQLite, additions only; no table or column is renamed, CLAUDE.md rule 10)

| Area | New tables | Spec |
|---|---|---|
| Identity | `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `sessions`, `password_resets`, `audit_log` | IAM_RBAC_SPEC §3 |
| Blog | `blog_posts`, `blog_categories`, `blog_post_categories`, `blog_media` | BLOG_SPEC §3 |
| Dispatch | `couriers`, `delivery_cities`, `delivery_zones`, `zone_rates`, `intercity_rates`, `dispatch_jobs`, `courier_locations`, `cash_ledger` | DISPATCH_SPEC §3 |
| Notifications | `email_outbox`, `notification_log` | NOTIFICATIONS_SPEC §3 |

Existing tables gain columns only where needed (e.g. `shipments.service_scope`). Every write that a person makes
records **who** (user id + display name) in `audit_log`, and tracking events keep using `recorded_by`.

### 3.3 Server modules (new files, existing style)

```
server/
  auth/            passwords.ts, sessionStore.ts (SQLite express-session store), permissions.ts, bootstrap.ts
  middleware/      auth.ts (requireAuth, requirePermission), rateLimit.ts
  routes/          auth.ts (rewritten), users.ts, roles.ts, audit.ts,
                   blog.ts (admin), publicBlog.ts, dispatch.ts, courier.ts, tariffs.ts, cash.ts, notifications.ts
  mail/            mailer.ts (nodemailer), outbox.ts (queue + retry), templates/ (EN/FR)
  render/          pageMeta.ts (title/description/OG/hreflang/JSON-LD injected into index.html per path)
src/
  i18n/            index.ts (provider, useT), en.ts (master), fr.ts (typed against en), format.ts (Intl)
  router/          routes.ts (path table), navigate.ts (History API), Link.tsx
  auth/            AuthContext.tsx, Can.tsx, usePermission.ts
  admin/pages/     UsersView, RolesView, AuditLogView, BlogListView, BlogEditorView, DispatchBoardView,
                   CouriersView, TariffsView, CashLedgerView
  courier/         CourierApp.tsx and screens (lazy chunk, mobile-first)
  motion/          gsap setup, hooks, scenes/ (HeroGlobe, BikeScene, TruckScene, LabelScene)
  pages/           BlogPage, BlogPostPage, LocalDeliveryPage (+ existing pages restyled)
  shared/          permissions.ts (catalogue shared by client and server), dispatchStatus.ts, whatsapp.ts
```

### 3.4 Security model
- Passwords: bcrypt (cost 12). Login by **email or phone** (couriers may not have email). Account lockout after 5
  failures for 15 minutes, plus the existing per-IP limiter. `session.regenerate()` on login.
- Sessions in SQLite (survive restarts; deactivating a user deletes their sessions immediately).
- **Permissions are checked on the server for every request**; the UI only hides what the user can't use.
- Couriers can read and change **only jobs assigned to them** (row-level check on the server).
- Uploaded HTML (blog) is sanitised on the server. Uploaded images are type- and size-checked.
- Audit log for logins, permission changes, shipment/tracking/payment/cash/blog writes.
- Details: IAM_RBAC_SPEC.

### 3.5 Real-time
Polling, not WebSockets (Hostinger's proxy layer makes long-lived connections fragile):
- courier app sends its position every **20 s** while a job is active and the app is open;
- the dispatch board refreshes every **15 s**; a public local-delivery track page every **20 s** while active.
An SSE upgrade can come later behind the same API.

### 3.6 Notifications (free by design)
- **WhatsApp:** the system builds **click-to-chat links** (`https://wa.me/<E.164>?text=<message>`) with bilingual
  templates. A staff member or courier taps **Send on WhatsApp**; WhatsApp opens with the message ready; they press
  send. Cost: zero. Fully automatic WhatsApp sending needs Meta's paid Cloud API (business-initiated template messages
  are charged per message) and unofficial automation libraries break WhatsApp's terms and get numbers banned, so
  neither is used. Upgrade path recorded in NOTIFICATIONS_SPEC §5.
- **Email:** automatic, via the company's own SMTP mailbox (Hostinger), queued in `email_outbox` with retries.
  Used for password resets, quote/booking confirmations, delivery confirmations and staff alerts.

### 3.7 Languages
English at `/`, French at `/fr/`. Typed dictionaries (`fr.ts` must have every key in `en.ts`, enforced by
TypeScript). Dates, numbers and money via `Intl` (`en-CM`, `fr-CM`; XAF has no minor units). Blog posts are written per
language and linked as translations. Details: I18N_SPEC.

### 3.8 Performance and motion
The existing budgets hold (MOTION_3D_SPEC §2): Lighthouse mobile ≥ 85 on Home, LCP ≤ 2.5 s, CLS ≤ 0.05, main public
JS ≤ 250 KB gzip. GSAP loads in a small motion chunk after first paint; the Three.js Stage (globe, bike, truck, plane, parcel) loads on idle, only on capable
devices, behind a static poster; everything respects `prefers-reduced-motion` and Save-Data.

---

## 4. Key models in one page

### 4.1 Roles (seeded; all but Super Admin are editable; the Super Admin can add more)

| Role | Purpose | Main permissions |
|---|---|---|
| **Super Admin** | Owner / IT. Everything, including users, roles and settings. Cannot be edited or deleted; at least one active Super Admin must always exist. | `*` |
| **Operations Manager** | Runs shipments end to end. | shipments, tracking, documents, quotes, messages, payments (view), dispatch, couriers, cash (view), dashboard |
| **Dispatch Manager** | Office dispatcher: prices and assigns local/intercity jobs, watches couriers. | dispatch (view, manage), couriers (view), shipments (view), tracking (update), cash (view), messages (view) |
| **Courier** | Bike rider or truck/van driver (vehicle on their profile). Uses the courier app only. | `courier.app` (own jobs only) |
| **Marketing** | Blog and public content. | blog (write, publish, categories), messages (view), dashboard |
| **Finance** | Money in. | payments (view, manage), cash (view, confirm), documents (view), quotes (view), shipments (view) |
| **Customer Support** | Answers customers. | shipments (view), tracking (update), messages (view, manage), quotes (view), dispatch (view) |

Full permission catalogue: IAM_RBAC_SPEC §4.

### 4.2 Dispatch job lifecycle

```
REQUESTED ─► CONFIRMED ─► ASSIGNED ─► ACCEPTED ─► PICKED_UP ─► ON_THE_WAY ─► DELIVERED
 (public)    (priced)     (courier)   (courier)               │
                                                              ├─► FAILED_ATTEMPT ─► (reassign / reschedule) ─► ASSIGNED
                                                              └─► RETURNED
any state before PICKED_UP ─► CANCELLED
```
Every job has a normal **TX tracking ID**; each transition writes a tracking event (`recorded_by` = the user) and an
audit entry. Local and intercity jobs never use the automatic time-based progress in `server/progress.ts`.

---

## 5. Build order (phases; tracker IDs in brackets)

| Phase | Outcome | Depends on |
|---|---|---|
| **A. Separation & rebrand foundation** | TanEx name, IDs, DB name, logo, meta; nothing of the previous client remains | n/a |
| **B. Identity & access (IAM/RBAC)** | Named accounts, roles, permissions, sessions, audit, email + password reset | A |
| **C. Design system** | Approved design direction; tokens, type and core components | A (can run beside B) |
| **D. Routing & languages** | Path URLs, server meta, sitemap, EN/FR framework | C |
| **E. Public site rebuild** | Every public page on the new design, EN + FR, localised payments | C, D |
| **F. Blog** | Studio, public blog, home section, SEO, RSS | B, D, E |
| **G. Dispatch & local delivery** | Zones/tariffs, couriers, jobs, courier app, dispatch board, live tracking, cash, WhatsApp/email | B, D, E |
| **H. The Journey** | Whole-homepage 3D scroll story with the TanEx bike, route rail, posters, within budget | E (journey layout), models from the 3D artist (#117) |
| **I. Admin console** | Admin reskin on the new tokens, admin EN/FR | B, C |
| **J. QA, security & launch** | Tests, audits, secrets, deploy to tanexsarl.com, backups | all |

Each task: read the affected files first → smallest change that does the job → `npm run build` (0 TS errors) and
`npm test` → check 375 / 768 / 1440 px → commit → tick the tracker. Never break: tracking lookup, staff login,
shipment creation, documents/PDFs, quote flow, payments, data persistence.

---

## 6. Document map

| Doc | What it holds |
|---|---|
| `CLAUDE.md` | Rules for every session (short). |
| `PROMPTS.md` | The build prompts, in order, from now to launch. |
| `docs/PROJECT_TRACKER.md` | Task list, Blocked / Needs owner, Decisions log, Change log, system notes. |
| `docs/BRAND_GUIDE.md` | Name, voice, colour tokens, type, logo, IDs, imagery, UI rules (the design system). |
| `docs/CONTENT.md` / `docs/CONTENT_FR.md` | All site copy, English master and French. |
| `docs/IAM_RBAC_SPEC.md` | Accounts, roles, permissions, sessions, audit, migration. |
| `docs/DISPATCH_SPEC.md` | Couriers, zones and rates, jobs, courier app, dispatch board, live tracking, cash. |
| `docs/BLOG_SPEC.md` | Blog data, studio, public pages, SEO. |
| `docs/I18N_SPEC.md` | Languages, routing, URL scheme, meta injection, formatting. |
| `docs/NOTIFICATIONS_SPEC.md` | Email outbox, WhatsApp click-to-chat, templates. |
| `docs/MOTION_3D_SPEC.md` | The Journey: Stage, chapters, route rail, models, budgets, fallbacks. |
| `docs/DEPLOYMENT.md` | GitHub → Hostinger, env vars, domain, email DNS, launch checklist, backups. |
| `docs/update.md` | Earlier feature spec (package photos, payment methods, proof of payment); still describes live code. |
