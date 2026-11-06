# TanEx: Build Prompt Pack (Claude Code in VS Code)

**The job:** turn this working logistics platform into **TanEx** (Tanex SARL, Buea, Cameroon) on **tanexsarl.com**:
rebrand, complete professional redesign, **staff accounts with roles (IAM/RBAC)**, **blog**, **bike/truck dispatch with
courier accounts and live tracking**, **English + French**, and a **GSAP + Three.js scroll journey** on the homepage (a 3D TanEx bike rides down the page through every section), then deploy.
Plan: `docs/TANEX_PLAN.md`. Tasks: `docs/PROJECT_TRACKER.md`.

**How to use**
- Send the prompts **in order, one per chat turn**. Each ends with **STOP**: check the result
  (`npm run dev` → http://localhost:3000 and http://localhost:3000/private-user/) before sending the next.
- Start a **new chat for each phase** (A, B, C…) and send **Prompt R** first. Long chats lose detail.
- If something breaks: **Prompt F**. New owner facts: **Prompt O**. Copy changes: **Prompt N**.
- Prompts marked 🧑 need you (approval, accounts, devices).
- Never skip the build/test step, and never push to any repo other than TanEx's.

> ⛔ **Fresh site, fresh identity.** TanEx gets a new GitHub repo with fresh history, a new Hostinger app, a new empty
> database, new secrets and new accounts. The previous client's name, domain, email, logo, chat key and repo must not
> appear anywhere in the finished site, docs, commit messages or git history.

---

## Project values (source of truth, owner decisions 2026-11-06)

| Key | Value |
|---|---|
| Display / legal name | **TanEx** / **Tanex SARL** |
| Tagline | **From Your Door to the World** · FR **De votre porte au monde entier** |
| Domain · email | **tanexsarl.com** (`www.` → apex) · **info@tanexsarl.com** |
| Offices | **Buea (head office):** Check Point, directly opposite Molyko Omnisport Stadium · **Douala:** Kotto, La Canadienne |
| Phone | **+237 651 05 93 45** · **+237 691 19 46 63** (stored E.164: +237651059345, +237691194663) |
| Opening hours | **9:00 AM – 4:00 PM** (days TBD) |
| Secondary slogan · price fact | **Saving Situations** · Buea bike delivery **from 500 FCFA** |
| Coverage | Worldwide (air, maritime, rail, road, warehousing) · bike delivery **in Buea, Limbe, Douala** · trucks **between cities** |
| Languages | **English** (`/`) and **French** (`/fr/`) |
| Console | **https://tanexsarl.com/private-user/** (staff + couriers) |
| Tracking ID | **`TX` + 6 = 8 characters**, e.g. **`TX7K2M9P`**; pieces `TX7K2M9P-01` |
| References | `TX-TKT-`, `TX-INV-`, `TX-SL-`, `TX-CSH-` + 6 digits; quotes `QR-YYYY-#####` |
| Currency / payments | Default **XAF**; all existing methods kept + **MTN MoMo**, **Orange Money**, **cash on delivery** |
| WhatsApp / email | **Free** click-to-chat links / company SMTP mailbox |
| Colours | Dark chocolate, cream, a **small** amount of orange (logo orange `#F48800`) (BRAND_GUIDE §4) |
| Logo source | `images/tanex files/logo.png` (1080×1080 RGB, white background, not transparent) |
| MD portrait | `images/tanex files/Managing Director.png` (name TBD) |
| DB file · package | `tanex.db` · `tanex` |
| Not supplied yet | Which number is on WhatsApp, opening days, wall-sign line (probably "Saving situations across continents", to confirm), MD name, social profile URLs (handle **Tanex_2025** on Facebook, Instagram, LinkedIn), vector logo, domain conflict (flyer shows **tanexx.com**): **leave empty/hidden, never invent** |

---

## Phase A: Separation & rebrand foundation

### A1: Safety net (no code changes)
```
We're adapting this working platform for TanEx. Read CLAUDE.md, docs/TANEX_PLAN.md, docs/PROJECT_TRACKER.md, PROMPTS.md (values table), src/config/brand.ts, src/shared/trackingId.ts, src/shared/references.ts, server/db.ts, server/index.ts, scripts/optimize-images.mjs and docs/DEPLOYMENT.md.

1. `git status`. If the only uncommitted changes are docs (CLAUDE.md, PROMPTS.md, docs/*) and images/ (old logo deleted, images/tanex files/ added), create branch `tanex` and commit them as "docs: TanEx plan, specs and source files". Anything else uncommitted: STOP and ask me.
2. `git remote -v`, then remove every remote from this local clone (nothing may be pushed to the previous client's repo). Don't write the URLs anywhere.
3. Run `npm run build` and `npm test`; record the baseline.
4. Read the current brand values (name, short name, legal name, domain, email, tracking/reference prefix, DB file name, package name, Smartsupp key) — the "old brand terms". Count them case-insensitively in src, server, scripts, index.html, Public, docs, CLAUDE.md, package.json, package-lock.json, .env.example. Skip the internal ngf code names. Keep the list in chat only.

STOP and report: baseline, old-term counts per area, questions.
```

### A2: Brand config, IDs and metadata
```
Task A.2. Apply the PROMPTS.md values. Read first: src/config/brand.ts and every importer, src/shared/trackingId.ts, src/shared/references.ts, server/trackingIds.ts, scripts/*.test.ts, server/db.ts (DB_FILE, default settings), server/index.ts (health/log names), server/seo.ts, index.html, Public/site.webmanifest, package.json, .env.example, src/services/liveChat.ts.

1. brand.ts: COMPANY = COMPANY_SHORT = 'TanEx'; LEGAL_NAME = 'Tanex SARL'; TAGLINE = 'From Your Door to the World'; add TAGLINE_FR = 'De votre porte au monde entier'; EMAIL, DOMAIN, SITE_URL for tanexsarl.com; HQ_ADDRESS = 'Check Point, opposite Molyko Omnisport Stadium, Buea, Cameroon'; add OFFICES = [{ city: 'Buea', label: 'Head office', address: 'Check Point, opposite Molyko Omnisport Stadium, Buea, Cameroon' }, { city: 'Douala', label: 'Douala office', address: 'Kotto, La Canadienne, Douala, Cameroon' }]; PHONE = '+237651059345', PHONE_2 = '+237691194663' (displayed through one formatter as +237 651 05 93 45); OPENING_HOURS = { opens: '09:00', closes: '16:00', days: [] } (days TBD, show the hours only); WHATSAPP and SOCIAL stay '' until confirmed; TRACKING_PREFIX = REFERENCE_PREFIX = 'TX'; TRACKING_ID_EXAMPLE 'TX7K2M9P'; SMARTSUPP_KEY = '' (the old key isn't TanEx's; chat stays off, tracker #109); ADMIN_CONSOLE_NAME 'TanEx Operations Console'; keep ADMIN_PATH '/private-user/'.
2. references.ts: TX-TKT / TX-INV / TX-SL and a new TX-CSH generator (cash ledger, used in phase G). Update tests; `TX7K2M9P` must validate and the alphabet rules stay.
3. DB_FILE 'tanex.db'; package name 'tanex' (regenerate lockfile name only); .env.example (tanex-data paths; add the SUPER_ADMIN_* and SMTP_* variables from DEPLOYMENT §4 as commented placeholders).
4. Default settings for a NEW database: companyName 'Tanex SARL', dispatchEmail info@tanexsarl.com, displayCurrency 'XAF', headquartersAddress = HQ_ADDRESS. Don't alter existing databases' values.
5. index.html meta/OG/Twitter/JSON-LD (Organization: name TanEx, legalName Tanex SARL, url, email, address Buea CM) from CONTENT §1.1; site.webmanifest name/short_name/theme colour (#1C120E) / background (#FBF6EC).
6. App.tsx PAGE_META and any hard-coded user-facing brand text → CONTENT §1.1 wording (still English-only; i18n comes in D.3).
7. Server health name and start log use COMPANY.

`npm run build` + `npm test` must pass. Create a shipment in the console and track it publicly: the ID must look like TX7K2M9P. Commit "brand: TanEx name, domain, IDs and metadata". Update the tracker. STOP and report.
```

### A3: Logo and icons
```
Task A.3. Source: `images/tanex files/logo.png` (1080×1080 RGB, white background, NOT transparent; "Tan" black, "Ex" orange #F48800, orange paper plane with speed lines, tagline "From Your Door to the World" underneath). Read scripts/optimize-images.mjs, BRAND_GUIDE §6, and every place logos are used (Header, Footer, drawer, admin layout/login, documents/PDFs, favicon links, manifest, og image).

1. Update the --brand pipeline: key out the white background with a soft alpha ramp (no white halo; edge-connected flood fill so enclosed counters in letters are handled correctly), trim, never upscale. Produce in Public/brand/:
   - logo.png (full lockup with tagline, transparent) for light surfaces and PDFs;
   - logo-wordmark.png + logo-wordmark-web.webp (wordmark + plane, WITHOUT the tagline) for the header;
   - logo-white.png + logo-wordmark-white-web.webp: black parts → cream #FBF6EC, orange untouched;
   - mark.png: the paper plane + speed lines; favicon.png (512), favicon-32, favicon-16, icon-192, icon-maskable-512 (plane on #1C120E with safe padding), apple-touch-icon (180);
   - og-image.jpg 1200×630: cream logo on #1C120E.
2. brand.ts logo constants + sizes; bump the ?v= cache-bust in index.html and the manifest.
3. Composite each output on white, cream #FBF6EC and #1C120E at 2× and show me. Check 16/32 px favicons are recognisable.
4. Check the header, drawer, footer, console sidebar/login, one PDF and the browser tab at 375 and 1440 px; adjust only logo size rules.

Build passes. Commit "brand: TanEx logo and icons". STOP and show me the composites.
```

### A4: Brand sweep
```
Task A.4. Re-run the old-brand-term search from A1 over source, docs, Public, images, index.html, package files, .env.example, and after `npm run build` over dist/ and dist-server/. Target: zero hits (internal ngf names excepted). Delete the previous brand's logo source and Public assets no longer used. Confirm docs/update.md and docs/PROMPT-UPDATE.md stay brand-neutral (they still describe live code). Don't touch the database files or .env.
Build + test pass. Commit "brand: remove previous brand traces". Update the tracker. STOP with the sweep result.
```

---

## Phase B: Identity & access (IAM/RBAC). Spec: docs/IAM_RBAC_SPEC.md

### B1: Schema, permission catalogue, bootstrap
```
Task B.1. Read docs/IAM_RBAC_SPEC.md fully, server/db.ts, server/index.ts, server/routes/auth.ts, server/middleware/auth.ts. This phase is explicitly allowed to change auth (Decisions log 2026-11-06).

1. src/shared/permissions.ts: the catalogue (spec §4) with groups and EN/FR descriptions, plus SEEDED_ROLES (TANEX_PLAN §4.1).
2. initDatabase(): create users, roles, permissions, role_permissions, user_roles, sessions, password_resets, audit_log (+ indexes) exactly as spec §3. Sync the permissions table from the catalogue at boot. Seed roles only when roles is empty.
3. server/auth/bootstrap.ts: spec §8 (SUPER_ADMIN_EMAIL + ADMIN_PASSWORD_HASH → first Super Admin with must_change_password; otherwise a clear log line).
4. scripts/create-super-admin.ts + `npm run create-super-admin` (interactive; creates or resets; never prints the password).
5. Tests: catalogue integrity, seeding idempotent, bootstrap creates exactly one Super Admin.
Don't change login behaviour yet. Build + test pass. Commit "feat(iam): users, roles, permissions schema and bootstrap". STOP.
```

### B2: Sessions, login, permission middleware
```
Task B.2 (IAM_RBAC_SPEC §5–§6).
1. server/auth/sessionStore.ts: express-session Store on the sessions table (get/set/destroy/touch/clear, hourly purge). Cookie name tx.sid; keep httpOnly/sameSite=lax/secure-in-production/proxy settings; maxAge 12 h staff, 7 days for users whose only permission is courier.app.
2. server/auth/passwords.ts (bcrypt 12, policy), server/auth/permissions.ts (effective permissions per request, '*' handling).
3. Rewrite server/routes/auth.ts: login with { identifier (email or phone, normalised with libphonenumber-js default CM), password }, lockout 5/15 min, session.regenerate, audit; logout; GET /session with user + permissions; change-password. Keep the per-IP limiter.
4. server/middleware/auth.ts: requireAuth, requirePermission(...keys) (any-of), keep requireAdminAuth temporarily as requirePermission('dashboard.view') so nothing breaks before B.3. JSON/multipart content-type check for state-changing /api requests.
5. server/audit.ts: audit(req, action, entityType, entityId, summary, before?, after?) without secrets.
6. Tests: lockout, regenerate, session survives a server restart (file DB in a temp folder), 401/403 behaviour.
The console login screen will break until B.4 — so in this task also make the existing AdminLogin send { identifier, password } with an "Email or phone" field (minimal change). Verify: bootstrap Super Admin can log in and use the console as before.
Build + test pass. Commit "feat(iam): SQLite sessions, account login, permission middleware". STOP.
```

### B3: Route permissions
```
Task B.3. Apply IAM_RBAC_SPEC §7 to every route in server/routes/* and server/index.ts. Replace every requireAdminAuth with the mapped requirePermission; then delete requireAdminAuth. Public routes stay public. Anonymous GET /api/settings returns only the public fields (list them in code with a comment); authenticated users with settings.view get everything. When a shipment/quote/payment/document/message write happens, record the actor via audit() and pass the user's display name as recordedBy/operator instead of the static role label (displayOperator keeps old rows readable).
Add scripts/permissions.test.ts: a matrix that logs in as a user per seeded role and asserts allowed/denied for one route per permission.
Build + test pass; manual check: Super Admin can do everything as before. Commit "feat(iam): permission checks on every console route". STOP with the matrix result.
```

### B4: Console auth experience
```
Task B.4 (spec §9). Read src/App.tsx, src/admin/AdminApp.tsx, AdminLayout.tsx, AdminLogin.tsx, src/context/AdminDataContext.tsx.
1. src/auth/AuthContext.tsx (loads /api/auth/session; exposes user, can(key), refresh, logout), <Can>, usePermission.
2. Login screen per CONTENT §10.1 (EN for now): identifier + password, lockout message, "Forgot password?" only when the server says email is configured.
3. Forced password change screen when mustChangePassword.
4. Sidebar items, views, action buttons gated by permissions; AdminDataContext only loads the lists the user may view (no 403 noise). Users with only courier.app see a placeholder "Courier app coming soon" screen (built in G.4).
5. "My account" panel: name, language preference, change password, sign out.
Test with users of 3 different roles (create them directly in the DB via a temporary script that you delete afterwards — no demo data left behind). Build passes. Commit "feat(iam): permission-aware console, login and account". STOP with screenshots per role.
```

### B5: Users, Roles, Audit log screens
```
Task B.5 (spec §6, §9; CONTENT §10.1). Server: /api/users, /api/roles, /api/permissions, /api/audit with all rules in spec §5 (last Super Admin protection, no privilege escalation, disable kills sessions, temp password returned once). Console: Users view, Roles view (permission checklist grouped by area), Audit log view (filters, pagination, before/after detail). Temp-password dialog has Copy and "Send on WhatsApp" (wa.me link with CONTENT §14 auth.temp_password text; use src/shared/whatsapp.ts — create it now per NOTIFICATIONS_SPEC §2).
Add audit() calls to every existing write route not yet covered. Tests for the server rules. Build + test pass. Commit "feat(iam): users, roles and audit log screens". STOP.
```

### B6: Email foundation, password reset, IAM review
```
Task B.6 (NOTIFICATIONS_SPEC §3, IAM spec §6). Add nodemailer; server/mail/mailer.ts (off when SMTP_HOST unset), outbox table + worker with backoff, templates for auth.reset / quote.received / contact.received (EN+FR from CONTENT §14 / CONTENT_FR §14), Settings → Email panel (status, send test, failed list). Forgot/reset password flow (hashed single-use 30-min tokens; generic answers). Hook quote.received and contact.received emails to the customer.
Then do a security review of phase B: list every /api route with its guard, try privilege escalation paths, check no secrets in logs/audit. Fix findings.
Build + test pass. Commit "feat(iam): email outbox and password reset". Update tracker (B done). STOP with the review summary.
```

---

## Phase C: Design system. Spec: docs/BRAND_GUIDE.md

### C1 🧑: Design direction for approval
```
Task C.1. Read BRAND_GUIDE fully, CONTENT §1–§2 (incl. §2.10), MOTION_3D_SPEC fully (the homepage is one scroll journey with a 3D TanEx bike, §5–§8) and the owner files in `images/tanex files/` (logo, MD portrait, homepage outline photo). Use the frontend-design skill.
Create `design/direction.html` (standalone, no build, self-hosted fonts from src/assets/fonts): 1) palette with token names and the contrast table; 2) type specimen (Plus Jakarta Sans 800 + italic emphasis, Inter, JetBrains Mono, EN + FR samples); 3) buttons, inputs, chips, cards in light and dark; 4) a high-fidelity desktop + mobile mock of the full homepage in the owner's order (CONTENT §2.1–2.9 English copy) showing the **bike lane** (where the 3D bike rides beside the content, alternating sides) and the route rail; 5) a **Journey storyboard**: one illustrated key frame per chapter (MOTION §6, chapters 0–8) with its scroll length, what moves, and the text beside it — Apple/Nike calm, bold type, generous space. Also show the intended look of the bike + rider (brown TanEx vest, orange top box with the plane mark) as a reference sheet (front / side / three-quarter) for the 3D artist. Professional, premium logistics, not a template look. No invented facts.
STOP: tell me how to open it. I'll approve or request changes before anything else is built.
```

### C2: Tokens
```
Task C.2. Implement the approved direction in src/styles/tokens.css as --tx-* tokens (BRAND_GUIDE §4.3), role aliases, type scale, spacing, radii, shadows, motion tokens. Re-point every --ngf-* token to its --tx-* equivalent (semantic status colours stay semantic) so the whole site re-skins. Fix any text that now fails contrast (measure, don't guess). global.css base styles (body cream, chocolate text, focus ring, selection colour, French typography helpers).
Check every public page and the console at 375/1440 — no broken contrast, no layout change. Build passes. Commit "design: TanEx tokens with legacy aliases". STOP with before/after screenshots.
```

### C3: Core components
```
Task C.3. Build/restyle shared components on --tx-* tokens: Button (primary orange + chocolate text, secondary, ghost, on-dark), Input/Select/Textarea/Checkbox/Radio (labels, errors), Card, Chip/StatusChip, SectionHeader (eyebrow/H2/intro), PageHero, Header (new nav per CONTENT §1.2 with dropdowns, sticky with backdrop, mobile drawer, language switch slot that is visible but disabled until D.3), Footer (CONTENT §1.3). Keyboard and screen-reader complete. Replace usages page by page only where it's a drop-in; full page redesigns are phase E.
Build passes, 375/768/1440 checked. Commit "design: core components, header and footer". STOP.
```

---

## Phase D: Routing & languages. Spec: docs/I18N_SPEC.md

### D1: Path routing
```
Task D.1 (I18N_SPEC §2). Read src/App.tsx fully, Header/Footer/links, every `#/` usage (grep), api calls that build links (emails, documents, quote links, "view shipment" links in the console), server/seo.ts, server/index.ts static/404 handling.
Create src/router/ (routes.ts with id/en/fr paths, navigate(), <Link>, useRoute()). Migrate App.tsx from hash to History API paths (English paths now; FR paths registered but rendering English until D.3). Convert legacy `/#/…` URLs on load. Update every internal link, generated link and document footer. Server: known public paths (incl. dynamic /track/:id, /quote/:id, /blog/*) → index.html 200; unknown → 404 page; /private-user/ unchanged; #/admin on localhost only still works.
Test: deep-link reload on every route, back/forward, track and quote links from the console, 404s. Build + test pass. Commit "feat(i18n): path-based routing". STOP.
```

### D2: Server meta and sitemap
```
Task D.2 (I18N_SPEC §4). server/render/pageMeta.ts injects title, description, canonical, hreflang (en, fr, x-default), OG/Twitter and JSON-LD into index.html per path (cache the template in memory; escape everything). Sitemap with both languages and xhtml:link alternates; robots.txt points to it and never lists the console. Unit tests for a sample of paths. Build + test pass. Commit "feat(i18n): server-side page meta and bilingual sitemap". STOP with sample `curl` outputs.
```

### D3: i18n foundation
```
Task D.3 (I18N_SPEC §3, §5). src/i18n/: provider, useT with typed keys, en.ts master + fr.ts typed against it (split per area, lazy per page), format.ts (Intl dates/numbers/money; XAF 0 decimals; French spacing rules). Language switch in the header (maps the current route), tx_locale preference, French suggestion banner, <html lang>.
Move Header, Footer, 404, cookie/consent texts and common UI strings to dictionaries from CONTENT §1 / CONTENT_FR §1. Shared statuses (src/shared/shipmentStatus.ts, payment statuses) get { en, fr }; tracking_events gains title_key + title_vars_json (ALTER, nullable) and server-written events set them; public track renders French when a key exists. API errors gain stable `code`s; the client maps them.
Add a test that fr.ts has no value identical to en.ts except an allow-list (brand terms, IDs). Build + test pass. Commit "feat(i18n): EN/FR foundation". STOP.
```

---

## Phase E: Public site rebuild (EN + FR)

For every E prompt: copy from CONTENT.md / CONTENT_FR.md (translate any missing FR section into CONTENT_FR.md first, marked "native review pending"), components from C.3, light reveals only (motion is phase H), meta via D.2, 375/768/1440 in both languages, build + test pass, one commit per prompt, tracker updated, STOP with screenshots.

### E1: Home
```
Task E.1. Rebuild src/pages/HomePage.tsx + CSS to CONTENT §2.1–2.9 in the owner's order, laid out for the Journey (MOTION_3D_SPEC §5–§6) exactly as approved in C.1: every section is a chapter element with a stable id/ref (`data-chapter="0..8"`), the desktop **bike lane** column alternates sides, text blocks have their own backdrop so they never depend on a 3D frame, and each chapter has a fixed-size poster slot (static image now; the Stage replaces it in phase H). Sections: Hero (track field, CTAs, hero poster preloaded as the LCP candidate), Services (6), Bike delivery, Truck delivery, Global network (existing Leaflet map restyled), Smart labels, Get in touch (reuses the existing callback/contact API; TX-TKT reference), FAQ (6), Blog (hidden until phase F provides posts — build it against a typed empty array). Add the static route rail (CONTENT §2.10) as working chapter links. Remove the old sections and their unused CSS/images. No layout shift. Commit "design: TanEx homepage (journey layout)".
```

### E2: Services
```
Task E.2. Services page to CONTENT §3 (6 services with anchors #air #maritime #rail #road #warehousing #local, compare table, how it works, add-ons, CTA). Header Services menu links to the anchors. Commit "design: services page".
```

### E3: About and Network
```
Task E.3. About to CONTENT §4: leadership block with the MD portrait (process `images/tanex files/Managing Director.png` through scripts/optimize-images.mjs into a 4:5 slot with WebP/JPG sizes; name hidden until supplied, #103), approach, team, story hidden until supplied. Network page to CONTENT §5 and §9: replace src/data/gateways.ts with the TanEx list (TanEx locations + gateways + lanes), "Where our riders deliver" fed by the delivery cities API when it exists (until G.1: static list from CONTENT §9 TanEx locations). Fix map marker target size (#61). Commit "design: about and network pages".
```

### E4: Contact, Help, Legal
```
Task E.4. Contact (CONTENT §8.3; channels hide when empty; HQ address shown; both offices with map pins (Buea: Check Point opposite Molyko Omnisport Stadium; Douala: Kotto, La Canadienne; confirm the exact pins with me before publishing) and the opening hours), Help (§8.1–8.2 + §8.5), Legal (§13 adapted to Cameroon; src/data/legalDocs.ts; cookie policy lists the real cookie tx.sid and the real storage keys/services after A–D; "Last updated" = today). Mark the lawyer-review banner in the tracker (#112), not on the site. Commit "design: contact, help and legal pages".
```

### E5: Track, Quote, Ship
```
Task E.5. Restyle Track, Track Result (including the payment section and package images), Quote, Public Quote Result and Ship pages on the new design and dictionaries, without changing behaviour. While there: fix #52 (375 px overflow), delete the dead alerts form (#46), replace the fixed "Regional Gateway"/ETA wording per #33 with neutral wording from CONTENT (ask me if copy is missing). Regression: book → track → quote → accept → payment proof flows all work in EN and FR. Commit "design: tracking, quote and booking pages".
```

### E6: Payments localisation
```
Task E.6. Read docs/update.md §4 and src/shared/paymentMethods.ts, PaymentMethodCard, PaymentRequestEditor. Add method types MTN Mobile Money and Orange Money (CONTENT §6.10) with local SVG icons (document source and licence as in update.md; if no clean licensed mark exists, use a neutral lucide icon + the name), keep all existing methods. Cash on delivery label for local jobs (used in G). Display currency default XAF with correct formatting; exchange-rate settings still manual (#17). Settings: replace the U.S. carrier-number field with "Business registration (RCCM / NIU)" (#39, value optional). Tests updated (paymentIcons test). Commit "feat: MTN MoMo, Orange Money and XAF".
```

### E7 + E8: Images and public QA
```
Tasks E.7–E.8. Images: alt text EN/FR (CONTENT §12), stock replacements chosen to fit TanEx (African/Cameroonian context, licence recorded in images/*/SOURCES.md, no visible third-party branding), remove unused images. QA: every public page EN+FR at 375/768/1440, axe-core 0 violations, keyboard pass, Lighthouse mobile baseline for Home/Services/Track recorded in the tracker. Fix what you find. Commit "content: images, alt text and public QA fixes". STOP with the numbers.
```

---

## Phase F: Blog. Spec: docs/BLOG_SPEC.md

### F1: Blog backend
```
Task F.1 (BLOG_SPEC §3, §5). Tables + slug redirects; admin routes with blog.* permissions and ownership rules; media upload to UPLOADS_DIR/blog (type/size/dimension checks) served at /media/blog/*; TipTap JSON → HTML render + sanitize-html allow-list on the server; reading time; scheduled publishing; public API. Tests (sanitiser attack strings, permissions, scheduling, redirects, 404 for unpublished). No sample posts. Commit "feat(blog): data model and API". STOP.
```

### F2: Blog studio
```
Task F.2 (BLOG_SPEC §4; CONTENT §15 labels into the dictionaries). Console views: list + editor (TipTap, lazy chunk, only inside the console), side panel (slug, excerpt, cover + alt, categories, tags, author, SEO preview, language + "Create French version"), autosave, preview token, submit/publish/schedule/unpublish/archive by permission, categories manager. Images compressed in the browser with src/services/imageCompress.ts. Verify the public bundle size didn't grow. Commit "feat(blog): blog studio". STOP with screenshots.
```

### F3: Public blog
```
Task F.3 (BLOG_SPEC §6–§7). /blog, /blog/:slug, /blog/category/:slug and /fr equivalents; homepage §2.9 section wired; server meta + JSON-LD BlogPosting + hreflang via D.2; sitemap entries; RSS feeds; share links (no third-party scripts). Test with one EN post + FR translation that you create in the console and DELETE afterwards (no posts left in the database). Commit "feat(blog): public blog and SEO". STOP.
```

---

## Phase G: Dispatch & local delivery. Specs: docs/DISPATCH_SPEC.md, docs/NOTIFICATIONS_SPEC.md

### G1: Dispatch data and rules
```
Task G.1 (DISPATCH_SPEC §3–§5). Read server/progress.ts, server/routes/shipments.ts, server/routes/track.ts, src/shared/shipmentStatus.ts first. Create the tables and shipments.service_scope; make syncTimeBasedProgress skip LOCAL/INTERCITY; src/shared/dispatchStatus.ts (state machine, labels EN/FR, failure reasons, mapping to shipment status/progress/event title_key); src/shared/localPricing.ts (rate lookup with fallbacks, express, intercity); TX-CSH references. Tests for the state machine, pricing and progress exclusion. No seeded prices. Commit "feat(dispatch): data model, state machine and pricing rules". STOP.
```

### G2: Tariffs and couriers admin
```
Task G.2. Console: Tariffs (cities, zones with aliases and optional pin, suggested-zone import WITHOUT prices from DISPATCH_SPEC §3, zone-rate matrix per size, express surcharge, intercity rates, average speeds setting) under tariffs.manage; Couriers (create user + courier profile in one step: name, phone, optional email, vehicle, plate, home city, public first name, photo + consent; temp password dialog with WhatsApp link) under couriers.manage. Audit everything. Commit "feat(dispatch): tariffs and couriers admin". STOP.
```

### G3: Jobs API
```
Task G.3 (DISPATCH_SPEC §4, §11). Dispatch endpoints (create/price/assign/reassign/cancel/return, board feed) and courier endpoints (my jobs, actions with idempotency keys, location ping, POD multipart upload to UPLOADS_DIR/pod — private, served only to dispatch/finance/the courier). Every transition: state-machine check, timestamps, tracking event (title_key, recorded_by), shipment status/progress, audit, cash_ledger row when cash is collected. Location purge job (30 days). Delivery code hashed, 5 tries. Proof of Delivery document type now generated for delivered local jobs (#38). Tests incl. a courier trying another courier's job. Commit "feat(dispatch): job lifecycle API". STOP.
```

### G4: Courier app
```
Task G.4 (DISPATCH_SPEC §6; CONTENT §10.3 / CONTENT_FR §10.3). src/courier/ as a lazy chunk opened for courier.app users at /private-user/: Today, Job detail (call, WhatsApp, open in Maps, small map), action flow, POD (camera photo compressed in browser, optional signature canvas, code, cash collected + method + reference), Cash, History, Profile. Offline queue in IndexedDB with idempotency keys and a visible sync state. Location sharing while PICKED_UP/ON_THE_WAY (watchPosition, 20 s/50 m, wake lock, clear permission prompts). Courier web-app manifest + small service worker scoped to the console path (app shell only; never cache API responses). Big touch targets, EN/FR. Test on a real Android phone over mobile data (you can expose dev with `npm run dev` on the LAN; geolocation needs HTTPS — use a tunnel or test location via devtools sensors and tell me which). Commit "feat(dispatch): courier app". STOP with phone screenshots.
```

### G5: Dispatch board
```
Task G.5 (DISPATCH_SPEC §7; CONTENT §10.2). Console Dispatch board: columns, filters, job drawer (timeline, POD, cash, notifications sent), assign with suggestions (on-duty, same city, vehicle, distance, load), create job form, price override with reason, live Leaflet map of couriers (stale markers greyed), 15 s refresh, sidebar badge. Commit "feat(dispatch): dispatch board". STOP.
```

### G6: Public booking and live tracking
```
Tasks G.6–G.7 (DISPATCH_SPEC §8; CONTENT §7.5, §6.9). /local-delivery and /fr/livraison-locale booking flow with live price (or "we'll confirm"), rate-limited public API, success screen with tracking ID and "send tracking on WhatsApp". Track Result for LOCAL/INTERCITY: stepper, courier card (photo only with consent), live map while active with smoothly interpolated marker, ETA (approximate), POD summary, polling every 20 s only while active, nothing exposed after delivery except the route. Privacy check: no phone numbers or stale positions in the public payload. Commit "feat(dispatch): public booking and live tracking". STOP.
```

### G7: Cash and notifications
```
Task G.8 (DISPATCH_SPEC §9–§10; NOTIFICATIONS_SPEC). Cash & Mobile Money view: per-courier balances, pending items, confirm/reject handovers and MoMo references (cash.confirm), adjustments with reason, daily report + CSV. WhatsApp click-to-chat buttons at the right moments (dispatch board, courier app, booking success) with CONTENT §14 templates in the job's notify_locale, logged in notification_log; automatic emails for booking.confirmed / local.delivered / payment.confirmed / quote.ready when an email exists. Commit "feat(dispatch): cash ledger and notifications". STOP.
```

### G8 🧑: Field test
```
Task G.9. Give me a field-test script for Buea: 1 dispatcher on a laptop, 1 courier phone, 1 customer phone, on mobile data, covering booking → assign → accept → pickup → live map → failed attempt → reassign → deliver with POD and cash → finance confirms → WhatsApp messages. Then I run it and send you findings; fix them in small commits. STOP after the script.
```

---

## Phase H: The Journey (GSAP + Three.js). Spec: docs/MOTION_3D_SPEC.md

The whole homepage is one scroll-driven story: a 3D TanEx bike carries the visitor down the page (Apple/Nike
style). Build it in this order so something shippable exists after every prompt.

### H0 🧑: 3D models (start in parallel with phase E)
```
Task H.0 (MOTION §4). Write `design/3d-brief.md` for a 3D artist from the C.1 reference sheet and the rider on the owner flyer (images/tanex files/info.png: tan/brown jacket, helmet, TanEx top box): bike + rider (brown TanEx vest, helmet, orange top box with the plane mark), truck; low-poly matte style; ≤ 8k triangles for the bike; one material atlas; named pivots (front_wheel, rear_wheel, handlebar, rider_torso, box_lid); real-world scale in metres; glTF 2.0 delivery + the .blend source; we own the rights. Include the palette hex values and the camera angles from the storyboard. Until the asset arrives, H.2 uses a primitives-built bike, so nothing waits on the artist. STOP with the brief.
```

### H1: Motion foundation and route rail
```
Task H.1 (MOTION §3, §5, §7). Add gsap, three, lenis. src/motion/: capabilities.ts (canAnimate, canUseStage), gsap.ts lazy loader (register only used plugins incl. CustomEase "journey"), useGsapContext, useReveal (ScrollTrigger.batch + CSS fallback), SmoothScroll (desktop + motion allowed; data-lenis-prevent on maps/modals), motion.css with reduced-motion overrides, route-change cleanup + ScrollTrigger.refresh. JourneyController.tsx: reads the homepage chapter refs (data-chapter), creates one ScrollTrigger per chapter with the pin lengths from MOTION §6, and exposes { chapter, progress } — no 3D yet; drive the DOM headline reveals (SplitText) and make the route rail's bike icon travel with scroll; Pause motion control (tx_motion_paused). Measure: main public JS still ≤ 250 KB gzip, motion chunk ≤ 70 KB gzip (record in the tracker). Scroll down/up must be perfectly reversible. Commit "feat(motion): journey scroll foundation and route rail". STOP.
```

### H2: The Stage and the bike
```
Task H.2 (MOTION §4–§5). src/motion/stage/: Stage.ts (one fixed full-viewport canvas behind the homepage content, pointer-events none, aria-hidden; on-demand rendering; DPR cap 1.5 desktop / 1.25 mobile; pause when hidden; WebGL context-loss → posters; full dispose when leaving Home), camera.ts (CatmullRom camera rails per chapter), assets.ts (chapter-prioritised loading, meshopt/Draco decoder only if needed). Build the TanEx bike + rider from primitives in the brand palette (temporary until the H.0 asset, same pivot names so the swap is one line), soft blurred shadow plane, hemisphere + directional light. Load the 3D chunk on idle after LCP only when canAnimate() && canUseStage(); posters stay until the first frame is ready (cross-fade, no CLS). Hook to JourneyController: the bike follows a placeholder path through all chapters so we can feel the pacing. Measure 3D chunk ≤ 220 KB gzip and frame time. Commit "feat(motion): 3D stage and bike". STOP with numbers and a short description of the scroll feel.
```

### H3: Chapters 0–1 (hero dive and services ride)
```
Task H.3 (MOTION §6 chapters 0–1). Chapter 0: cream globe with chocolate land dots (precompute a ≤ 25 KB dots file with a script in scripts/), Cameroon highlight, orange arcs DLA→hubs (CONTENT §9), paper-plane mesh with a speed-line trail, slow idle rotation that stops after 5 s; on scroll the camera dives to Buea, cross-fades to the street and front door, the bike pulls up; caption "It starts at your door." (CONTENT §2.10). Chapter 1: the winding road through the Services section; the bike rides it with scrub; each service card activates as the bike passes (DOM timeline), mode cameos (plane overhead, quay, train, overtaking truck, shelves, bike turns to camera); progress dots 1–6. Render the hero poster from the Stage with a script (WebP/AVIF) and use it as the LCP image. Lighthouse mobile Home ≥ 85. Commit "feat(motion): hero dive and services ride". STOP.
```

### H4: Chapters 2–3 (bike product moment and truck hand-off)
```
Task H.4 (MOTION §6 chapters 2–3). Chapter 2 on the dark chocolate section: pin 200 vh, bike centre-stage, slow camera orbit (side → three-quarter → rear box), top-box lid opens to show the parcel, beats "Picked up. / On the way. / Delivered." synced to the timeline, phone-holder mini map with a moving dot; bike rides out. Chapter 3 on cream: parcel hand-off from bike to truck, camera pulls back to the stylised road with Limbe · Buea · Douala pins checking off as the truck drives. Mobile: shorter pins and three fixed camera angles cross-faded instead of the orbit. Keep the 2D SVG versions of these two scenes (GSAP) as the no-WebGL fallback. Commit "feat(motion): bike and truck chapters". STOP.
```

### H5: Chapters 4–8 (world, label, contact, arrival)
```
Task H.5 (MOTION §6 chapters 4–8). Chapter 4: camera rises to orbit, globe returns, the parcel boards the paper plane at Douala, flies an arc while the other lanes draw, then releases into the real Leaflet network map section (restyled; arcs drawn once on reveal). Chapter 5: parcel box fills the frame, rotates to the label, barcode draws, scan beam, TX7K2M9P types in, capability tiles reveal. Chapter 6: bike parks beside the contact form; the loop stops while any field has focus. Chapter 7: Stage dims to a still frame for FAQ and Blog (hidden on mobile). Chapter 8: the bike reaches a front door at the footer, box opens, "Delivered." line; footer mark draws its speed lines. Commit "feat(motion): world, label and arrival chapters". STOP.
```

### H6: Swap in the final models and render posters
```
Task H.6 (MOTION §4). When the artist's glTF arrives: validate (triangles, pivots, scale, single atlas), compress (gltf-transform: meshopt or Draco, texture to KTX2/WebP), check ≤ 450 KB total, swap it in for the primitives bike/truck, retune lights/materials to the palette. Re-render every chapter poster from the Stage with the script (WebP + AVIF, fixed sizes). If the asset hasn't arrived, polish the primitives version instead and keep this task open. Commit "feat(motion): final bike and truck models". STOP.
```

### H7: Other pages and Journey QA
```
Tasks H.7–H.8 (MOTION §9–§11). Inner pages: hero line reveals + subtle parallax, batch reveals, the small route-rail progress bike on long pages, 200 ms route transitions, courier marker interpolation on Track Result. Then the full QA checklist in MOTION §11: Lighthouse mobile ×3 median on Home/Services/Track/Blog, reversibility, fling-scroll, resize, 375/768/1440/1920, reduced motion / Save-Data / no-WebGL / context loss, memory after 10 route changes, 60 fps at 4× CPU slowdown, Safari iOS + Chrome Android + Samsung Internet + Firefox, text contrast over the Stage in every chapter. Fix regressions (simplify scenes before touching LCP/INP); record numbers in the tracker. Commit "perf(motion): journey QA". STOP with the table.
```

---

## Phase I: Admin console

### I1: Console reskin
```
Task I.1. Reskin the console (AdminLayout, sidebar in Chocolate 950 with cream text and orange active marker, top bar, tables, forms, modals, drawers, toasts, dashboard cards) on --tx-* tokens using the C.3 components. No logic change in CreateShipmentView/DocumentCenterView beyond class/token swaps. Move shared public rules out of admin CSS so admin CSS can leave the public bundle (#41) — prove CSS parity on public pages. Fix #57 (Escape closes preview). Commit "design: console reskin". STOP with screenshots of every view.
```

### I2: Console languages and clean-up
```
Tasks I.2–I.3. Console strings into the dictionaries (EN/FR; French for console labels added to CONTENT_FR §10 first). Then remove the --ngf-* aliases (every usage moved to --tx-*), rename remaining ngf- classes and ngf_ storage keys to tx (migrate stored keys once on load, including ngf_live_shipment_stream and ngf_recent_tracking), update the cookie policy text. Prove no visual change with screenshots. Commit "chore: console i18n and ngf → tx clean-up". STOP.
```

---

## Phase J: QA, security & launch

### J1: Regression and security
```
Tasks J.1–J.2. Full regression in EN and FR as each role: tracking, booking, quotes, documents, payments + proofs, messages, blog, dispatch end to end, users/roles, password reset. Security: run the permission matrix test, review uploads (types, sizes, private folders), sanitiser, rate limits on every public write, session cookie flags, error responses, then add a Content-Security-Policy in helmet that allow-lists exactly what the site loads (map tiles, OSRM/Nominatim, wa.me links are navigations not fetches). Fix #47 and #59 items. Commit per fix. STOP with a findings table.
```

### J2: Accessibility, devices, owner sign-off 🧑
```
Tasks J.3–J.4. axe on public pages, console and courier app (0 serious/critical), keyboard and focus traps in modals (#45), screen-reader pass on Track and the courier app. Give me a device checklist (#43) for my phones. Then produce an owner sign-off list: every [confirm] item, every empty placeholder still hidden, the French review status, legal review status. STOP.
```

### J3 🧑: Secrets, repo and Hostinger
```
Tasks J.5–J.6 (DEPLOYMENT §2–§6). Walk me through, one step at a time, waiting for my confirmation: generating SESSION_SECRET and the temporary Super Admin password hash on my machine; creating the new GitHub repo and pushing a fresh-history commit (orphan branch) — verify `git remote -v` shows only the TanEx repo; creating the Hostinger Node app, tanex-data folder, env vars, domain + www redirect + SSL; the info@tanexsarl.com mailbox and SPF/DKIM/DMARC. Never ask me to paste passwords into the chat.
```

### J4 🧑: Go live
```
Task J.7. Run DEPLOYMENT §7 on the live domain with me: each line, what to click, what I should see. Then set up daily backups of tanex.db + uploads, the uptime monitor, and remove /api/diag/storage after the persistence check. Update the tracker and write a short handover note in docs/HANDOVER.md (how to add staff, couriers, zones/rates, publish a post, restore a backup). STOP.
```

---

## Utility prompts

### Prompt R: Resume in a new chat
```
Resume the TanEx build. Read CLAUDE.md, docs/TANEX_PLAN.md, docs/PROJECT_TRACKER.md and PROMPTS.md, run `git status`, `git branch` and `git log --oneline -10`, then tell me which task we're on, what's next and anything blocked. Don't change anything until I confirm.
```

### Prompt F: Fix something that broke
```
Something broke: [what you see, page/URL, role, language, steps, error message].
Find the root cause (check the latest commits first) and explain it before fixing. Apply the smallest fix that doesn't change design or unrelated behaviour. Confirm `npm run build` and `npm test` pass and that staff login → create shipment → public track (TX ID) still works, then commit "fix: …" and log it in the tracker.
```

### Prompt O: Owner facts arrived
```
Here are TanEx facts: [phone / WhatsApp / wall-sign line / MD name and title / social links / vector logo / photos / network lanes / RCCM-NIU / Smartsupp key].
Put each where it belongs (brand.ts, CONTENT.md + CONTENT_FR.md, console settings defaults, JSON-LD, images pipeline), confirm the hidden UI now shows correctly in EN and FR, close the matching Blocked items in the tracker, build, test and commit "content: add TanEx [what]".
```

### Prompt N: Copy change
```
Copy change: [section and new text, EN and/or FR].
Update CONTENT.md and CONTENT_FR.md first (same section number), then the dictionaries/components that use it. If only one language was given, translate it and mark it "native review pending". Build, check the page in both languages, commit "content: …".
```
