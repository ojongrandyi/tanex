# TanEx: Project Tracker

> **Context:** the platform is **already built and working** (public site, tracking engine, Express/SQLite API, admin
> console, documents, quotes, package photos, payments). Claude acts as a **senior full-stack developer** adapting it
> for **TanEx** (Tanex SARL, Buea, Cameroon): rebrand, complete redesign, IAM/RBAC, blog, dispatch with courier
> accounts, EN/FR, GSAP + Three.js landing. Every task modifies the working system in place and leaves it working.
> Plan: `docs/TANEX_PLAN.md` · Prompts: `PROMPTS.md` · Rules: `CLAUDE.md`.

**Working method:** read the affected files → smallest change that does the task → `npm run build` (0 TS errors) +
`npm test` → test the flow you touched at 375 / 768 / 1440 px → commit (`brand:`, `feat(iam):`, `feat(blog):`,
`feat(dispatch):`, `feat(i18n):`, `feat(motion):`, `design:`, `content:`, `fix:`, `docs:`) → tick here + Change log.

**Owner:** Tanex SARL · **Domain:** tanexsarl.com · **Repo:** https://github.com/ojrandy/tanexSarl (fresh history from 2026-11-06) · **Host:** Hostinger Node.js
**Status legend:** `[ ]` to do · `[~]` in progress · `[x]` done · `[!]` blocked (see Needs owner)

---

## Phase P: Planning (2026-11-06)
- [x] P.1 Read the TanEx brief (logo, colours, homepage outline, MD photo) and the codebase; plan agreed with the owner.
- [x] P.2 Docs rewritten for TanEx: TANEX_PLAN, IAM_RBAC_SPEC, DISPATCH_SPEC, BLOG_SPEC, I18N_SPEC, NOTIFICATIONS_SPEC, BRAND_GUIDE, MOTION_3D_SPEC, CONTENT (EN), CONTENT_FR, DEPLOYMENT, this tracker, CLAUDE.md, PROMPTS.md.

## Phase A: Separation & rebrand foundation (PROMPTS A1–A4)
- [x] A.1 Safety net: branch `tanex`; remove every git remote; baseline `npm run build` + `npm test`; old-brand inventory (chat only).
- [ ] A.2 Brand config: `src/config/brand.ts` (TanEx, Tanex SARL, taglines EN/FR, email, domain, HQ, `TX`, references incl. `TX-CSH`, `SMARTSUPP_KEY = ''`); `references.ts`; tests; default DB `tanex.db`; package `tanex`; `.env.example`; health name; settings defaults (XAF); `index.html` meta/OG/JSON-LD; `site.webmanifest`.
- [ ] A.3 Logo and icons from `images/tanex files/logo.png` (white keyed out): full lockup, wordmark (no tagline), light-on-dark versions, paper-plane mark, favicons, app icons, OG image.
- [ ] A.4 Brand sweep = zero previous-brand hits (source, docs, Public, dist); remove the previous brand's logo/source files; `images/tanex files/` committed.

## Phase B: Identity & access (IAM/RBAC) (PROMPTS B1–B6, IAM_RBAC_SPEC)
- [ ] B.1 Schema (users, roles, permissions, role_permissions, user_roles, sessions, password_resets, audit_log); `src/shared/permissions.ts`; seeded roles; Super Admin bootstrap; `npm run create-super-admin`.
- [ ] B.2 SQLite session store, cookie `tx.sid`; auth routes (email/phone login, lockout, logout, session, change-password); `requireAuth` / `requirePermission`; `audit()` helper.
- [ ] B.3 Every gated route moved to permissions (spec §7); anonymous `GET /api/settings` returns public fields only; tests.
- [ ] B.4 Console auth: AuthContext, new login, forced password change, permission-gated sidebar/views/buttons, My account.
- [ ] B.5 Users and Roles screens; Audit log screen; audit calls on existing write routes.
- [ ] B.6 Email foundation (nodemailer, outbox, templates, Settings → Email test) + forgot/reset password; IAM test suite + security review.
- [ ] B.7 (optional, after launch) TOTP 2FA for users with `users.manage`.

## Phase C: Design system (PROMPTS C1–C3, BRAND_GUIDE)
- [ ] C.1 **Design direction for owner approval:** palette + type specimen + one high-fidelity homepage mock (static HTML in `design/`), EN. STOP until approved.
- [ ] C.2 Tokens: `--tx-*` in `tokens.css`; existing `--ngf-*` re-pointed as aliases so the whole site re-skins; contrast checks.
- [ ] C.3 Core components: buttons, inputs, cards, chips, section header, Header (new nav, language switch slot), Footer, page hero.

## Phase D: Routing & languages (PROMPTS D1–D3, I18N_SPEC)
- [ ] D.1 Path routing (route table, `navigate`, `<Link>`), App.tsx migrated, legacy hash links converted; console path untouched.
- [ ] D.2 Server: known paths → `index.html` with injected meta, hreflang, canonical, JSON-LD; sitemap with alternates; 404s. (Closes #44.)
- [ ] D.3 i18n foundation: provider, typed `en.ts`/`fr.ts`, `format.ts` (XAF), language switch, French suggestion banner; shared status/event labels bilingual (`title_key`); API error codes.

## Phase E: Public site rebuild (PROMPTS E1–E7/8), EN + FR
- [ ] E.1 Home: CONTENT §2.1–2.9 on the new design (static, light reveals only; motion comes in H).
- [ ] E.2 Services page (§3).
- [ ] E.3 About (MD portrait, leadership) + Locations/Network (§5, §9; `src/data/gateways.ts` replaced).
- [ ] E.4 Contact, Help (incl. §8.5), Legal (Cameroon; cookie policy synced with real cookies/keys).
- [ ] E.5 Track, Track Result (incl. payments), Quote, Quote Result, Ship: restyled, bilingual, no behaviour change.
- [ ] E.6 Payments localisation: MTN MoMo + Orange Money method types (+ icons/licences), XAF default display currency, admin Settings field "RCCM / NIU" replaces the US carrier number (#39).
- [ ] E.7 Images: MD portrait pipeline, stock replacements, alt text EN/FR (§12).
- [ ] E.8 Public QA EN+FR: 375/768/1440, axe (0 violations), Lighthouse baseline recorded.

## Phase F: Blog (PROMPTS F1–F3, BLOG_SPEC)
- [ ] F.1 Schema, admin API, media upload, sanitiser, scheduled publishing, slug redirects, tests.
- [ ] F.2 Blog studio: list, TipTap editor (lazy), side panel, preview, schedule, translations, media.
- [ ] F.3 Public blog (index, article, category), homepage section, meta/JSON-LD, sitemap, RSS.

## Phase G: Dispatch & local delivery (PROMPTS G1–G8, DISPATCH_SPEC, NOTIFICATIONS_SPEC)
- [ ] G.1 Schema (couriers, cities, zones, rates, intercity, jobs, locations, cash), `shipments.service_scope`, `progress.ts` exclusion, `dispatchStatus.ts`, `localPricing.ts`, tests.
- [ ] G.2 Tariffs admin (cities, zones + suggested import without prices, rates, intercity) and Couriers admin (user + profile in one step).
- [ ] G.3 Job API + state machine (dispatch + courier endpoints, idempotency keys, POD upload, tracking events, audit).
- [ ] G.4 Courier app: installable, offline queue, job flow, POD, location sharing, wake lock, cash, EN/FR.
- [ ] G.5 Dispatch board: columns, live map, assign suggestions, create job, price override, sidebar badge.
- [ ] G.6 Public local-delivery booking (`/local-delivery`, `/fr/livraison-locale`) + public price API.
- [ ] G.7 Public live tracking for local/intercity jobs (stepper, courier card, live map, ETA, privacy).
- [ ] G.8 Cash ledger + Finance confirmation + daily report/CSV; WhatsApp click-to-chat buttons and email notifications wired (NOTIFICATIONS_SPEC §4).
- [ ] G.9 Field test in Buea with 2 phones (courier + customer) on mobile data; fix findings.
- [ ] G.10 (later, owner decision) native courier app for background location; WhatsApp Cloud API; MoMo payment API.

## Phase H: The Journey: whole-homepage scroll story with a 3D bike (PROMPTS H0–H7, MOTION_3D_SPEC)
- [ ] H.0 3D brief for the artist (bike + rider, truck); commission in parallel with phase E (#117).
- [ ] H.1 Motion foundation: `gsap`, `three`, `lenis`; capabilities, loaders, `useGsapContext`, reveals, smooth scroll, JourneyController (chapter ScrollTriggers), route rail with the travelling bike icon, Pause motion.
- [ ] H.2 The Stage (one fixed WebGL canvas for the whole homepage) + primitives-built bike, camera rails, chapter asset loading, posters, fallbacks.
- [ ] H.3 Chapters 0–1: hero globe → dive to Buea → bike at the door; bike rides the services road.
- [ ] H.4 Chapters 2–3: bike product moment (pinned orbit, box opens, Picked up / On the way / Delivered); bike→truck hand-off and city-to-city drive.
- [ ] H.5 Chapters 4–8: plane to the world, label close-up, bike parks at contact, still frame for FAQ/blog, arrival at a door in the footer.
- [ ] H.6 Final glTF models swapped in, compressed (≤ 450 KB), posters re-rendered.
- [ ] H.7 Inner-page motion (reveals, parallax, progress bike, route transitions, courier marker interpolation).
- [ ] H.8 Journey QA: MOTION §11 checklist, budgets §2.

## Phase I: Admin console (PROMPTS I1–I2)
- [ ] I.1 Console reskin on `--tx-*` (layout, sidebar, tables, forms, modals), no logic change.
- [ ] I.2 Console EN/FR.
- [ ] I.3 Clean-up: delete `--ngf-*` aliases; rename remaining `ngf-` classes and `ngf_` storage keys (one-time key migration).

## Phase J: QA, security & launch (PROMPTS J1–J4)
- [ ] J.1 Full regression: tracking, booking, quotes, documents, payments, messages, blog, dispatch, IAM; `npm test` green.
- [ ] J.2 Security review: permission matrix test, uploads, sanitiser, rate limits, headers, Content-Security-Policy.
- [ ] J.3 Accessibility (public, console, courier app) and cross-device (#43).
- [ ] J.4 Owner sign-off: copy (EN/FR, [confirm] items), legal review, photos.
- [ ] J.5 Secrets + first Super Admin (owner).
- [ ] J.6 ~~New GitHub repo (fresh history)~~ (done at A.1) + Hostinger app + env vars + domain + SSL + email DNS.
- [ ] J.7 Live smoke test (DEPLOYMENT §7) + backups + monitoring.

---

## Blocked / Needs owner
Numbers stay stable (docs refer to them). #100+ are TanEx items; lower numbers are open technical items carried over.

| # | Item | Needed for |
|---|---|---|
| 100 | ~~Phone numbers~~ received 2026-11-06 (+237 651 05 93 45, +237 691 19 46 63). Still open: **which number is on WhatsApp** (powers the "Chat with us" links). | A.2, E.4, G.8 |
| 101 | **Vector logo** (SVG/AI/PDF) or a transparent PNG at ≥ 2000 px. | A.3 |
| 102 | The full company line on the office wall sign. The flyer's logo lockup reads "Saving Situations", so the wall line is probably **"Saving situations across continents"**: confirm. Also: keep "Saving Situations" in English on the French site? | E.3 |
| 103 | **Real photos** (team in uniform, riders and bikes, trucks, office) with consent; **Managing Director's name and title** (photo supplied). | E.3, E.7 |
| 104 | Confirm the **[confirm]** copy: rail freight routes, cross-border road, warehousing facilities, "same-day" bike delivery, add-ons, parcel size limits. | E.1, E.2 |
| 105 | Confirm the **network list** (CONTENT §9): which lanes TanEx actually serves. | E.3, H.2 |
| 106 | **Local delivery setup** (entered by the admin in the console): zones per city, rates, express surcharge, average speeds; terms for paying COD money to senders. | G.2, G.9 |
| 107 | **Company MTN MoMo and Orange Money accounts** (name, number, merchant code), entered in the console. | E.6, G.8 |
| 108 | A **native French reviewer** for CONTENT_FR and the French UI. | D.3, J.4 |
| 109 | **Live chat:** TanEx's own Smartsupp key (the previous one is not TanEx's) or keep chat off. | A.2 |
| 110 | Keep the console at `/private-user/`? (Assumed yes.) | B.4 |
| 111 | **Social media profile URLs.** The flyer shows the handle `Tanex_2025` on Facebook, Instagram and LinkedIn; send the exact profile links (no icons until then). | E.1 |
| 112 | **Lawyer review under Cameroonian law** (privacy under Law No. 2024/017, terms, shipping terms, liability, claims window, COD terms). Replaces #11/#37 wording. | E.4, J.4 |
| 113 | **Launch inputs:** Hostinger plan/app, ~~new GitHub repo URL~~ (received 2026-11-06), DNS access for tanexsarl.com, the info@tanexsarl.com mailbox. | J.6 |
| 114 | Confirm the display name casing **"TanEx"** (logo) with legal name **"Tanex SARL"**. | A.2 |
| 115 | **Courier onboarding:** number of riders/drivers, their phones (Android version), mobile data; vehicle and plate details. | G.4, G.9 |
| 117 | **3D artist for the bike + rider and truck models** (brief from H.0; budget and rights owned by TanEx). Until then the Journey uses a primitives-built bike. | H.0, H.6 |
| 118 | **Domain conflict:** the brief says **tanexsarl.com**, the flyer shows **www.Tanexx.com**. Which domain does the site launch on (and does the other redirect to it)? Email stays info@tanexsarl.com unless told otherwise. | A.2, J.6 |
| 119 | **Opening days** (the flyer gives 9:00 AM – 4:00 PM but not the days), and whether the Douala office keeps the same hours. Needed for the contact page and the Organization/LocalBusiness data. | E.4 |
| 120 | **Exact map pins** for both offices (Buea: Check Point opposite Molyko Omnisport Stadium; Douala: Kotto, La Canadienne), e.g. a Google Maps link for each. | E.3, E.4 |
| 121 | The flyer images (TanEx-painted aircraft, ship and boxes) look computer-generated. They are **not used on the site as real photos**, because they would suggest TanEx owns aircraft and ships. The rider image is used only as a style reference for the 3D model (H.0). Confirm, or send real photos. | E.7, H.0 |
| 116 | Business registration details to print on documents and the footer (RCCM, NIU), if TanEx wants them shown. | E.6 |
| 12 | After a control action these stay browser-only: `statusMessage`, the old in-browser audit list and the hold "frozen" flag. The new `audit_log` (B.5) replaces the audit part; decide on the other two. | B.5 |
| 15 | Sea legs are great-circle arcs that can cross land; consider real sea lanes. | later |
| 17 | Exchange rates are entered by hand in Settings → Tariff (XAF ↔ USD/EUR). Decide who updates them. | E.6 |
| 18 | The automatic estimates (quote tariff corridor, base rates) are placeholder USD formulas; replace with TanEx pricing or hide. | E.5 |
| 19 | Imperial leftovers (NMFC classes, inch pallet names, kennel sizes, divisor 139). | E.5 |
| 27 | Admin pre-filled customer messages per status (TrackingEventsView) are not in CONTENT. | I.2 |
| 28 | Track Result has no Documents panel; decide which documents customers may download. | E.5 |
| 32 | Quote Result: no stored transit time; single total line; "Download PDF" opens print; no rate email (now possible via B.6). | E.5 |
| 33 | Ship booking: fixed first-event wording, fixed ETA "2-3 Business Days", "{city} Regional Gateway"; confirm collection windows and drop-off at the Buea office. | E.5 |
| 38 | Documents: no Proof of Delivery / Security Seal Record type; 12×12×12 in default dimensions; PDF is an image. POD document type now useful for local jobs. | G.3 |
| 41 | Admin CSS still in the public bundle (~29 kB gzip); move shared rules. | I.1 |
| 42 | Quote conversion first event: `350.00` tariff fallback and "Linear Code 128" wording. | E.5 |
| 45 | Accessibility not yet covered: console, later form steps, modal focus trapping. | J.3 |
| 46 | Dead "Get Delivery Alerts" form on Track Result (saves nothing): delete or wire to email (B.6). | E.5 |
| 47 | QA findings: (a) dangerous-goods Emergency Response Contact not saved; (b) admin quick form U.S.-shaped; (c) pet presets pre-fill a fictional phone; (e) `POST /api/quotes` accepts a client-chosen `id`; `POST /api/documents/generate` returns 500 on a bad body and accepts unknown `docType`. | J.2 |
| 52 | At 375 px the quote result page scrolls sideways ~40 px. | E.5 |
| 57 | Document Center preview doesn't close on Escape; ETA engine gives some long lanes next-day delivery. | I.1 |
| 59 | Clean-up: unused `ADMIN_PROXY_TARGET` mode; remove `/api/diag/storage` after the persistence check; `QR-2026-00124` "SAMPLE" row style. | J.2 |
| 61 | Network map markers fail Lighthouse target size at world zoom. | E.3 |

## Decisions log
| Date | Decision |
|---|---|
| 2026-11-06 | **TanEx adaptation (owner):** name TanEx / legal Tanex SARL; tagline "From Your Door to the World"; tanexsarl.com; info@tanexsarl.com; HQ Check Point, Buea; worldwide shipping + in-town delivery in Buea, Limbe, Douala + intercity trucks; English and French; CTA stays "Get a Quote"; tracking `TX` + 6 = 8 (`TX7K2M9P`); references `TX-TKT/INV/SL/CSH`; default currency XAF, all payment methods kept + MTN MoMo, Orange Money, cash on delivery; local pricing set by the admin; WhatsApp must be free. |
| 2026-11-06 | **IAM/RBAC:** named accounts (email or phone), roles = permission sets created by the Super Admin, permissions checked server-side per request, SQLite session store, audit log. `server/middleware/auth.ts` and `server/routes/auth.ts` are changed on purpose (CLAUDE.md rule 8 exception for phase B). |
| 2026-11-06 | **Routing:** public pages move from hash to path URLs with server-injected meta; no React Router (custom router extended). EN at `/`, FR at `/fr/`. |
| 2026-11-06 | **Dispatch:** couriers are users with the Courier role + a courier profile (bike/van/truck); jobs in `dispatch_jobs` linked to TX shipments; courier app inside the console path; polling, not WebSockets; local/intercity shipments never auto-advance. |
| 2026-11-06 | **WhatsApp via click-to-chat links** (free). Cloud API (paid per template message) and unofficial automation (against WhatsApp terms) rejected for v1. Email via the company SMTP mailbox with an outbox. |
| 2026-11-06 | **Motion:** GSAP (free licence, incl. plugins) + vanilla Three.js replace the earlier "no GSAP" rule; budgets in MOTION_3D_SPEC §2; reduced-motion/Save-Data/low-end paths mandatory. |
| 2026-11-06 | **The Journey (owner):** 3D is not limited to the hero. The whole homepage is one scroll-scrubbed story (Apple/Nike style): one fixed WebGL Stage behind the content, a TanEx bike that rides down the page through every section (door → services → in town → truck → world → label → contact → arrival at a door), a route rail with a travelling bike icon, posters as fallbacks. Layout reserves a bike lane (C.1/E.1). Bike/truck models commissioned (#117), primitives meanwhile. |
| 2026-11-06 | **Design tokens:** new `--tx-*` tokens; `--ngf-*` kept temporarily as aliases so existing pages re-skin at once; aliases removed in I.3. Orange text never on light backgrounds; buttons on orange use chocolate text. |
| 2026-11-06 | **Blog:** TipTap editor (admin-only chunk), sanitised HTML stored, posts per language linked as translations; no sample posts. |
| 2026-11-06 | **Money in dispatch tables** is stored with their own currency (XAF); they don't go through the USD canonical fields of older modules. |
| 2026-10-11 | Production responses compressed; `/assets/*` cached a year (immutable); `index.html` no-cache. `@types/qrcode` is a runtime dependency (Hostinger installs with `NODE_ENV=production`). |
| 2026-10-11 | Package images, payment requests and proof of payment: design and decisions D-1…D-9 in `docs/update.md`. |
| 2026-09-30 | No demo data ships (mock shipments, seed, fake timeline removed). |
| 2026-09-29 | Code-split before motion: console `React.lazy`; Leaflet loads near the viewport; jspdf/html2canvas on demand. Admin CSS stays in the main bundle for now (#41). |
| 2026-09-29 | Shipment status names live in `src/shared/shipmentStatus.ts`, shared by public pages, console and server; stored codes are never renamed. |
| 2026-09-28 | Returns are real shipments with their own server-assigned ID, linked both ways. |
| 2026-09-28 | Transport mode stored per shipment when known; event times store the instant + IANA zone. |
| 2026-09-28 | One canonical unit per quantity in older tables (pounds, inches, USD); forms convert at the edges (kg/cm default). |
| 2026-09-27 | The server assigns every tracking ID; public `/api/track` only accepts the current format. |
| 2026-09-26 | Piece labels: base ID + `-NN`; a piece search resolves to its parent. |
| 2026-09-26 | Public contact values resolve as: console Settings (DB) → `brand.ts` → empty; empty values hide their element. |
| 2026-09-26 | `DB_PATH`, `UPLOADS_DIR` keep production data outside the deploy folder. |

## Change log
| Date | Task | Note |
|---|---|---|
| 2026-11-06 | P.1–P.2 | TanEx plan agreed; all docs and PROMPTS.md rewritten for TanEx. No code changed yet. The earlier change history belongs to the previous deployment and stays in that project's git history (this repo gets fresh history at J.6). |
| 2026-11-06 | Owner facts from `images/tanex files/info.png` | Phones +237 651 05 93 45 / +237 691 19 46 63; offices Buea (Check Point, opposite Molyko Omnisport Stadium, head office) and Douala (Kotto, La Canadienne); hours 9:00–16:00; slogan "Saving Situations"; Buea delivery "from 500 FCFA"; handle Tanex_2025. Applied to CLAUDE.md, PROMPTS, TANEX_PLAN, CONTENT, CONTENT_FR. New questions #118–#121. |
| 2026-11-06 | Journey revision | Owner asked for 3D/GSAP across the whole homepage with a bike carrying the visitor down the page: MOTION_3D_SPEC rewritten (Stage, chapters 0–8, route rail, budgets), CONTENT/CONTENT_FR §2.10, PROMPTS C1/E1 and phase H (H0–H7), TANEX_PLAN, BRAND_GUIDE updated. |
| 2026-11-06 | A.1 | Docs committed on branch `tanex`; old remote removed; old local databases moved out of the project. Baseline: `npm run build` 0 TS errors (main JS 108.2 KB gzip, console chunk 90.7 KB gzip), `npm test` 60/60 pass. Old-brand inventory taken (chat only; feeds A.2/A.4, including the old tagline in index.html). New repo https://github.com/ojrandy/tanexSarl started with one fresh-history commit (no earlier history pushed). |

---

## System notes (codebase walkthrough, still accurate before phase A)

**Shape.** One Node process. `server/index.ts` (Express 5) serves `/api/*` and the built SPA from `dist/`. Dev: Vite on :3000 proxies `/api` to Express on :5000. Build: `tsc` (src) → `vite build` → `tsc -p tsconfig.server.json` → `dist-server/`.

**Routing (until D.1).** No router library. `src/App.tsx` keeps `currentPage` in state synced with `location.hash` (`#/services`, `#/track/:id`, `#/quote/:id`); `getInitialPage()` resolves the first paint; `KNOWN_PAGES` is the allow-list. Admin: `isAdminPath()` (exact `/private-user/`) → `admin`; on localhost `#/admin` also opens it. Any other path → `not-found` (server answers 404). Console code is a lazy chunk; public pages are lazy chunks with their CSS kept in the main bundle (`src/pages/pageStyles.ts`).

**Frontend ↔ API.** `src/services/api.ts` holds relative `fetch('/api/...')` calls. `AdminDataProvider` wraps the whole app but loads console lists only with a session. Public tracking: quote IDs (`QR…`) first, then `GET /api/track/:id` (PII-masked). Public contact info from `GET /api/settings`. `simulationEngine` broadcasts across tabs through localStorage `ngf_live_shipment_stream`.

**Server progress.** `server/progress.ts` advances progress and map position on every read, importing `src/services/{routingEngine,planningEngine,geocodingService}.ts` (shared with Node, must stay DOM-free). Must skip LOCAL/INTERCITY shipments from G.1.

**Tracking IDs.** Allocated only by `server/trackingIds.ts` via `src/shared/trackingId.ts` (`crypto.randomInt`), prefix from `TRACKING_PREFIX`. Piece labels `<ID>-NN`; `/api/track` normalises input and resolves piece labels.

**Auth (until B.2).** One shared password vs `ADMIN_PASSWORD_HASH` (20 per 15 min per IP), sets `req.session.isAdmin`; in-memory session store (cookie `ngf.sid`, httpOnly, sameSite=lax, secure in production, 12 h, trust proxy 1): **every restart logs everyone out**. `requireAdminAuth` is a plain flag check.

**DB.** `node:sqlite` at `DB_PATH` or `<cwd>/data/<DB_FILE>`. WAL, foreign keys on. Schema in `initDatabase()` with try/catch `ALTER` migrations. Soft delete (`deleted_at_ts`); `/permanent` hard-deletes from trash. Uploads in `UPLOADS_DIR` (`images/`, `proofs/`).

**Fragile / worth knowing**
- `/api/diag/storage` returns server paths; remove after the persistence check (#59).
- `GET /api/settings` is public and returns the whole settings object (signature stamp URL, signatory, surcharge rate…). Fixed in B.3.
- `SESSION_COOKIE`, the logout `clearCookie` and the `ngf_live_shipment_stream` key must change together.
- `'New York'` / `'August 24, 2026'` fallback defaults remain in the server insert path (`server/routes/shipments.ts`).
- Schema columns `*_state`, `*_zip`, `*_lbs` are U.S.-shaped; they stay (rule 10).
- `CreateShipmentView.tsx` (≈4,100 lines), `DocumentCenterView.tsx` (≈2,000), `TrackResultPage.tsx` (≈1,400), `AdminDataContext.tsx` (≈1,100): edit surgically.
- Payment method catalogue: `src/shared/paymentMethods.ts` (US/EU-centric today; MoMo/OM added in E.6).
