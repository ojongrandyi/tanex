# Languages, Routing & Page Meta Specification (EN / FR)

> Part of the TanEx plan (`docs/TANEX_PLAN.md`). Tracker phase **D**.

## 1. Goals

1. Every public page exists in **English and French**, each at its own indexable URL.
2. Public pages move from hash URLs (`/#/services`) to **real paths** (`/services`), so pages and blog posts can be
   indexed and shared with correct previews. (This closes tracker #44.)
3. The courier app is bilingual from day one; the admin console follows in phase I.

## 2. URL scheme

| Page | English | French |
|---|---|---|
| Home | `/` | `/fr/` |
| Services | `/services` | `/fr/services` |
| Local delivery booking | `/local-delivery` | `/fr/livraison-locale` |
| Track | `/track`, `/track/TX7K2M9P` | `/fr/suivi`, `/fr/suivi/TX7K2M9P` |
| Quote / quote result | `/quote`, `/quote/QR-2026-00001` | `/fr/devis`, `/fr/devis/QR-…` |
| Ship (book) | `/ship` | `/fr/expedier` |
| About · Contact · Help · Network · Legal | `/about` `/contact` `/help` `/locations` `/legal/<tab>` | `/fr/a-propos` `/fr/contact` `/fr/aide` `/fr/reseau` `/fr/mentions-legales/<tab>` |
| Blog | `/blog`, `/blog/<slug>` | `/fr/blog`, `/fr/blog/<slug>` |

- One route table, `src/router/routes.ts`: `{ id, en, fr, component, meta }`. `navigate()` uses the History API;
  `<Link>` renders real `<a href>` (works with middle-click, crawlers and no-JS).
- Language switch maps the current route id to the other language's path (blog posts use their linked
  translation, or the other language's blog index if none).
- Legacy hash links (`/#/track/TX…`) are converted to the path form on load (cheap insurance for shared links).
- `/private-user/` is unchanged and never localised in the URL.
- No React Router (CLAUDE.md §3): the existing custom routing in `App.tsx` is extended.

## 3. Language choice

- The URL decides the language. `/` is English.
- The switch remembers the choice in `localStorage` (`tx_locale`). On the first visit to `/` from a French browser
  (`navigator.language` starts with `fr`) a small, dismissible banner offers *"Voir le site en français"*; no
  automatic redirect (keeps crawling and sharing predictable).
- `<html lang>` is set per page.

## 4. Server: paths and meta injection (`server/render/pageMeta.ts`)

- The server knows the public route table (shared file) and answers known paths with `index.html` (200), unknown
  ones with the 404 page (status 404) as today.
- Before sending, it injects into `<head>`: `<title>`, meta description, canonical, `hreflang` alternates
  (`en`, `fr`, `x-default` = English), Open Graph/Twitter tags, and JSON-LD (Organization on home; BlogPosting on
  posts; BreadcrumbList on inner pages). Blog posts read their meta from the DB. Responses stay `no-cache`.
- `sitemap.xml` lists every public path in both languages (with `xhtml:link` alternates) and every published post;
  `robots.txt` unchanged in spirit (admin path never listed).
- Shared code with the client must stay DOM-free (it runs in Node).

## 5. Client i18n (`src/i18n/`)

- `en.ts` is the **master** dictionary (nested object of strings / small functions for plurals and variables).
- `fr.ts` is typed `satisfies Messages` where `Messages = typeof en`, so a missing or extra key **fails the build**.
- `I18nProvider` + `useT()` → `t('home.hero.title')` with typed keys; `useLocale()`.
- Dictionaries are split per area (`common`, `home`, `track`, `courier`, `admin`…) and lazy-loaded with their page,
  so the main bundle carries only `common` in the active language.
- **Formatting** (`format.ts`): dates/times with `Intl.DateTimeFormat` (`en-CM` / `fr-CM`, event time zones as
  today), numbers, money with `Intl.NumberFormat` (XAF shows as "FCFA"/"F CFA" per locale with 0 decimals; other
  currencies keep 2), distances in km.
- **Shared server strings** (status names in `src/shared/shipmentStatus.ts`, dispatch statuses, failure reasons,
  email/WhatsApp templates) get `{ en, fr }` pairs; the API returns **codes**, and clients render the label in their
  language. Tracking-event titles written by the server are stored in English plus a `title_key` so the public
  page can show them in French (`tracking_events` gains `title_key TEXT`, `title_vars_json TEXT`; older rows show
  their stored text).
- **Validation and API errors** return a stable `code` alongside the English `error`; the client maps the code.

## 6. Content rules

- English copy master: `docs/CONTENT.md`. French: `docs/CONTENT_FR.md`, same section numbers. Code dictionaries
  are filled **from these files**; never invent copy in code.
- French is written in clear, professional, Cameroonian-appropriate business French (vouvoiement), reviewed by a
  native speaker on the owner's side before launch (tracker #108).
- Tracking IDs, references and brand names are not translated. "TanEx" stays as is.

## 7. Tests

Every route has both paths; switching language keeps the page; `fr.ts` key parity (compile-time) plus a test that no
French string is an English copy by mistake (allow-list for brand terms); server returns correct `hreflang` and
canonical for a sample of paths; unknown paths 404; `/private-user/` unaffected.
