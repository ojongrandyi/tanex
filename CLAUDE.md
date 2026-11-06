# CLAUDE.md: TanEx Platform

> Read automatically at the start of every session. Keep it short, current and true. Details live in `/docs`.

## 0. Your role: read this first

**The system is already built and it works:** public website, live tracking engine, Express/SQLite API, admin
console, PDF documents, quotes, bookings, package photos and payments. It was previously deployed for another
client. We are **adapting it for TanEx**: rebrand, complete redesign, staff accounts with roles (IAM/RBAC), a blog,
in-town/intercity dispatch with courier accounts, English + French, and a GSAP + Three.js landing experience.

You are a **senior professional full-stack developer** on a client's production system:
- **Understand before you change.** Read the relevant files and trace the data flow before editing.
- **Modify in place.** Extend existing components, services, routes, styles and data model. No rewrites without a
  written reason in the tracker's Decisions log and the owner's approval.
- **Protect what works.** Tracking, staff login, shipment creation, documents/PDFs, quotes, payments and the
  database must work after every change. If a change risks them, stop and flag it.
- **Small, reviewable commits** (`brand:`, `design:`, `content:`, `feat(iam):`, `feat(blog):`, `feat(dispatch):`,
  `feat(i18n):`, `feat(motion):`, `fix:`, `docs:`).
- **Explain your changes:** what changed, which files, how you verified it, risks.
- **Ask when a business fact is missing.** Never guess or invent it.

**Start here:** `docs/TANEX_PLAN.md` (master plan) → `docs/PROJECT_TRACKER.md` (next task) → `PROMPTS.md`.

## 1. What TanEx is

**TanEx** (Tanex SARL), Buea, Cameroon: door-to-door delivery and logistics. **Bike delivery inside Buea, Limbe and
Douala**, **trucks between cities**, and **worldwide** air, maritime, rail and road freight plus warehousing.

Every change must keep the platform:
1. **On brand:** TanEx logo, chocolate/cream/small-orange palette, original copy (`docs/BRAND_GUIDE.md`, `docs/CONTENT.md`).
2. **Bilingual:** English and French everywhere customers and couriers look (`docs/I18N_SPEC.md`).
3. **Honest:** no invented facts, numbers, testimonials, prices, contact details or blog posts.
4. **Secure:** every console API route checks a permission on the server (`docs/IAM_RBAC_SPEC.md`).
5. **Light:** professional GSAP/Three.js motion within the budget (`docs/MOTION_3D_SPEC.md`).
6. **Deployable** from GitHub to **Hostinger** (Node.js app) on tanexsarl.com (`docs/DEPLOYMENT.md`).

## 2. Company facts (single source of truth)

| Field | Value |
|---|---|
| Display name / legal name | **TanEx** / **Tanex SARL** |
| Tagline | From Your Door to the World · FR: De votre porte au monde entier |
| Email · Domain | info@tanexsarl.com · tanexsarl.com (`www.` → apex) |
| Offices | **Buea (head office):** Check Point, directly opposite Molyko Omnisport Stadium · **Douala:** Kotto, La Canadienne |
| Phone | +237 651 05 93 45 · +237 691 19 46 63 (which one is on WhatsApp: TBD) |
| Opening hours | 9:00 AM – 4:00 PM (days of the week: TBD) |
| Marketing facts | Secondary slogan "Saving Situations" · Buea bike delivery "from 500 FCFA" (owner flyer) |
| In-town delivery cities | Buea, Limbe, Douala (managed in the console) |
| Console URL | https://tanexsarl.com/private-user/ (staff console + courier app, same app and domain) |
| Tracking ID | `TX` + 6 characters = **exactly 8** (e.g. `TX7K2M9P`); pieces `TX7K2M9P-01` |
| Other references | `TX-TKT-`, `TX-INV-`, `TX-SL-`, `TX-CSH-` + 6 digits; quotes `QR-YYYY-#####` |
| Default currency | XAF (FCFA); other currencies stay available |
| WhatsApp number / opening days / wall-sign line / MD name / social URLs / domain conflict (flyer says tanexx.com) | **TBD: owner will supply. Never invent.** |

Values live in `src/config/brand.ts` (after task A.2). Anything not here or in BRAND_GUIDE: **ask**.

## 3. Tech stack (don't swap frameworks)

- **Frontend:** React 18 + TypeScript + Vite 6. Custom routing in `src/App.tsx` (**no React Router**): hash routes
  today, path routes + `/fr/` after task D.1.
- **Styling:** plain CSS per component/page + tokens in `src/styles/tokens.css` (`--tx-*`, legacy `--ngf-*` aliases).
- **i18n:** own typed dictionaries `src/i18n/en.ts` (master) / `fr.ts` + `Intl` formatting (from D.3).
- **Motion:** `gsap` (ScrollTrigger, MotionPath, DrawSVG, SplitText), vanilla `three`, `lenis`, all lazy (from H.1).
- **Maps:** Leaflet. Geocoding: Nominatim; routing: OSRM (not for live ETAs).
- **Icons:** lucide-react. **Barcodes:** jsbarcode. **PDFs:** jspdf + html2canvas. **Editor:** TipTap (console only).
- **Backend:** Express 5 (`server/`), SQLite via `node:sqlite` (**Node ≥ 22.5**), express-session with a SQLite store
  (from B.2), bcryptjs, helmet, rate limiting, nodemailer (from B.6), sanitize-html (from F.1).
- **Console:** only at `/private-user/` (`ADMIN_PATH`); `#/admin` works on localhost only; server sends
  `X-Robots-Tag: noindex`. Couriers use the same path and get the courier app.
- **Static assets folder is `Public/` (capital P)**: `vite.config.ts` sets `publicDir: 'Public'`. Don't rename.

## 4. Commands

```bash
npm install                 # also runs `npm run build` via postinstall
npm run dev                 # Express API (:5000) + Vite (:3000)
npm run build               # tsc + vite build + server tsc -> dist/ and dist-server/
npm test                    # node:test suites in scripts/*.test.ts
npm start                   # production: node dist-server/server/index.js
npm run create-super-admin  # (from B.1) create/reset a Super Admin
```
Local console: `http://localhost:3000/private-user/` (or `#/admin`). Env vars: `.env.example`, DEPLOYMENT §4.

## 5. Key folders

```
src/pages/  src/components/  src/admin/  src/courier/ (G)  src/i18n/ (D)  src/router/ (D)  src/auth/ (B)
src/motion/ (H)  src/services/  src/shared/ (shared with server: trackingId, permissions, statuses, pricing)
src/config/brand.ts  src/styles/  server/ (routes, auth/, mail/, render/, db.ts)  scripts/  Public/  docs/
images/tanex files/  owner's source files (logo, MD portrait, homepage outline, colours)
```

## 6. Rules for every task

1. **Read `docs/PROJECT_TRACKER.md` first**; do the next unchecked task in order unless told otherwise. Read the
   spec named by the task.
2. **One task → one small, reviewable change.** Don't mix brand, copy, features and motion in one commit.
3. **Copy comes from `docs/CONTENT.md` (EN) and `docs/CONTENT_FR.md` (FR).** Missing copy: add it there first,
   marked "owner to confirm". New UI strings go through `t()`; no hard-coded user-facing text in new code.
4. **Brand values from `docs/BRAND_GUIDE.md`**; brand strings only from `brand.ts`.
5. **Never break existing behaviour.** After any change: `npm run build` with **zero TypeScript errors** and `npm test`.
6. **No fabricated facts:** no invented statistics, testimonials, logos, certifications, prices, phone numbers,
   addresses, people's names or blog posts. Use placeholders; flag them in the tracker.
7. **Security:** every non-public route uses `requirePermission(...)` (after B.3 never `requireAdminAuth`);
   row-level checks for courier/author ownership; sanitise HTML; validate uploads; audit every staff write.
8. **Don't touch** `.env`, live database files, or the auth/session security logic **unless the task is about it**
   (phase B tasks are).
9. **No demo data:** no sample shipments, quotes, documents, users (other than the bootstrap Super Admin), zones
   with prices, couriers or blog posts in code or databases.
10. **Don't rename database tables or columns.** Add tables/columns with migrations in `initDatabase()`. DB file
    `tanex.db` (or `DB_PATH`).
11. **Performance budget is a requirement** (MOTION_3D_SPEC §2). Heavy code (3D, editor, console, courier app,
    PDF) is lazy-loaded with fallbacks and a `prefers-reduced-motion` path.
12. After a task: tick it in the tracker, add a Change log line, list owner questions under **Blocked / Needs owner**.

## 7. Conventions

- New CSS tokens `--tx-*`, new classes `tx-`, new storage keys `tx_`. Legacy `ngf` names stay until task I.3.
- Shared logic used by client and server lives in `src/shared/` and stays DOM-free.
- Tracking IDs come from **one shared function**; the server allocates them.
- Money: store amount **and** currency; XAF has no decimals. Times: store epoch ms + IANA zone (`Africa/Douala`).
- Images: WebP/AVIF with JPG fallback, explicit `width`/`height`, `loading="lazy"` below the fold, meaningful `alt`.
- Accessibility: contrast ≥ 4.5:1 for body text (orange text never on light backgrounds), keyboard access, focus
  visible, decorative motion `aria-hidden`.
- Comments factual and brand-neutral.

## 8. Definition of done (per task)

- [ ] `npm run build` passes (0 TS errors), `npm test` passes, no new browser console errors.
- [ ] Checked at 375, 768 and 1440 px, in **English and French** where the task touches public or courier UI.
- [ ] Permissions enforced server-side for any new console route; audit entries for staff writes.
- [ ] No hard-coded brand strings or user-facing strings outside `t()`/CONTENT.
- [ ] Tracker updated.
