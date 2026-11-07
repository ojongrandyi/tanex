# TanEx Brand Guide & Design System

> **Context:** the platform is already built and working. TanEx gets a **complete visual redesign** through the
> design system (`src/styles/tokens.css` + components), not by rewriting features. See `docs/TANEX_PLAN.md`.
> The design direction (palette, type, one homepage mockup) is approved by the owner before pages are built
> (tracker C.1). Approved by the owner on 2026-11-07 (`design/direction.html`); the values below are final.

## 1. Name usage

| Context | Use | Constant (`src/config/brand.ts`) |
|---|---|---|
| Legal line, invoices, terms, copyright | **Tanex SARL** | `LEGAL_NAME` |
| Titles, first mention, meta, UI | **TanEx** (capital T and E, as on the logo) | `COMPANY`, `COMPANY_SHORT` |

- Never hard-code these; import from `brand.ts`. `TX` is an ID prefix, not a name for copy.
- Copyright: `© {currentYear} Tanex SARL. All rights reserved.` / `© {année} Tanex SARL. Tous droits réservés.`
- Tagline: **From Your Door to the World** (`TAGLINE`) · FR **De votre porte au monde entier** (`TAGLINE_FR`).
- Secondary slogan (owner flyer): **Saving Situations** (`SLOGAN`), used small (About, footer, social), never instead of the tagline.
- Flyer lines the owner already uses, available to CONTENT: "Send goods abroad", "From Cameroon, to the world", "We deliver excellence".

## 2. Positioning

**One line:** TanEx picks up from your door and delivers across town, across Cameroon and across the world, with one
tracking ID and a team that answers.

**Pillars** (every page reinforces at least one):
1. **Door to world.** Bike delivery in town, trucks between cities, air, sea and rail beyond, in one network.
2. **Live visibility.** One 8-character tracking ID; live rider position for in-town deliveries.
3. **Accountable hands.** Named couriers, photo proof of delivery, every hand-off recorded.
4. **Local roots.** Based in Buea, serving Buea, Limbe and Douala every day, in English and French.

## 3. Voice & tone

- Confident, warm, clear. Short sentences, active voice, concrete nouns ("photo proof of delivery", "customs
  clearance"). Never hype ("revolutionary", "cutting-edge", "seamless").
- English: International/British spelling (*colour, centre, organisation*). French: professional *vous*,
  natural Cameroonian business French, no anglicisms where a French term is standard.
- **Numbers:** only real, verifiable numbers. Otherwise describe the capability.
- Tracking term: "tracking ID" / "numéro de suivi". Documents: "Tracking ID / Waybill No." /
  "N° de suivi / N° de lettre de transport".

## 4. Colour

Source: owner brief (*dark chocolate, cream, a small amount of orange*) and the logo (orange measured at **#F48800**,
wordmark black). Orange is an **accent**: buttons, the paper-plane mark, route lines, highlights, never large
areas of text.

### 4.1 Palette

| Scale | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Chocolate** | `#F7F1EE` | `#EDE1DA` | `#D9C2B5` | `#BF9C8A` | `#9C7360` | `#7B5545` | `#5F4034` | `#4A3128` | `#38241D` | `#2A1B16` | `#1C120E` |
| **Cream** | `#FFFCF7` | `#FBF6EC` | `#F5ECDB` | `#EDDFC4` | `#E2CFA8` | n/a | | | | | |
| **Orange** | `#FFF6EB` | `#FFE9CC` | `#FFD199` | `#FFB55C` | `#FF9F2E` | **`#F48800`** | `#C76A00` | `#9A5200` | `#723C00` | | |

Semantic status colours stay universal and are **never** brand colours: success (delivered, green), info (in
transit, blue), warning (delayed, amber), danger (on hold/exception, red), plus neutral greys.

### 4.2 Contrast rules (measured, WCAG 2.x)

| Pairing | Ratio | Use |
|---|---|---|
| Chocolate 900 `#2A1B16` on Cream 100 `#FBF6EC` | 15.39 | body text on light |
| Chocolate 600 `#5F4034` on Cream 100 | 8.59 | muted text on light |
| Chocolate 500 `#7B5545` on Cream 200 `#F5ECDB` | 5.55 | smallest allowed muted text on light |
| Cream 100 on Chocolate 950 `#1C120E` | 17.07 | body text on dark |
| Chocolate 200 `#D9C2B5` on Chocolate 900 | 9.74 | muted text on dark |
| **Orange 500 `#F48800` on Chocolate 950** | 7.33 | orange text/icons on dark: OK at any size |
| Orange 500 on Chocolate 800 `#38241D` | 5.82 | OK |
| **Chocolate 950 on Orange 500** | 7.33 | **text on orange buttons is always chocolate** |
| White on Orange 500 | 2.51 | ❌ never |
| Orange 500 on Cream 100 | 2.33 | ❌ never for text or meaningful icons; decorative only |
| Orange 700 `#9A5200` on Cream 100 / white | 5.44 / 5.86 | small orange-toned text (links, eyebrows) on light |

### 4.3 Tokens

New tokens use the **`--tx-*`** prefix in `src/styles/tokens.css`:

```css
--tx-choc-50 … --tx-choc-950;  --tx-cream-50 … --tx-cream-400;  --tx-orange-50 … --tx-orange-800;
/* role aliases: components use these */
--tx-bg, --tx-bg-alt (cream), --tx-surface (white cards), --tx-surface-dark (choc-950), --tx-surface-dark-2 (choc-900),
--tx-text, --tx-text-muted, --tx-text-on-dark, --tx-text-muted-on-dark,
--tx-accent (orange-500), --tx-accent-text-on-light (orange-700), --tx-on-accent (choc-950),
--tx-border, --tx-border-on-dark, --tx-focus (orange-500 ring + 2px choc-950 offset);
--tx-success-*, --tx-info-*, --tx-warning-*, --tx-danger-*, --tx-grey-*;
```
**Implemented (C.2)** in `src/styles/tokens.css`, which also holds the type scale (`--tx-fs-*`), spacing
(`--tx-space-1…10`, 4 px base), radii, shadows, motion (`--tx-ease*`, `--tx-dur*`) and focus (`--tx-focus-ring`) tokens.
Role tokens have a light default and a **`.tx-dark`** context that redefines them (`--tx-bg`, `--tx-surface`,
`--tx-text`, `--tx-text-muted`, `--tx-accent-text`, `--tx-border*`, `--tx-field-bg`, `--tx-icon-bg`), so a component
works in either section type. **`--tx-accent-text`** is Orange 700 on light and Orange 500 inside `.tx-dark`: use it
for every orange-toned text or meaningful icon. Where CSS variables can't reach (Leaflet lines, SVG gradient stops,
canvas) use `BRAND_COLORS` in `src/config/brand.ts`.

**Migration:** the existing `--ngf-*` tokens are kept as **aliases that point at the new `--tx-*` values**
(e.g. `--ngf-accent-500: var(--tx-orange-500)`), so every existing page re-skins at once without touching
thousands of lines. Components are then moved to `--tx-*` as they are redesigned; the aliases are deleted at the end
(tracker I.3). Class prefix for new components: `tx-`. Storage keys for new features: `tx_`.

### 4.4 How colour is used

- **Light sections:** Cream 100 background, white cards, chocolate text.
- **Dark sections** (hero, bike scene, footer, admin sidebar): Chocolate 950/900 with cream text and orange accents.
- **Primary button:** orange fill + chocolate text; hover lightens to Orange 400 `#FF9F2E` (chocolate text 8.97:1;
  darkening to Orange 600 would drop to 4.81:1). **Secondary:** chocolate fill + cream text. **Ghost:** chocolate outline. On dark: cream
  outline. The **Track** button is always primary.
- Orange appears at most in 1–2 places per screen (CTA + one highlight). "Small orange" is the rule.

## 5. Typography

| Use | Font | Weights | Notes |
|---|---|---|---|
| Display / headings | **Plus Jakarta Sans** (already self-hosted) | 700, 800 (+ 800 italic) | The italic 800 echoes the logo's slanted wordmark; use it for **one emphasised word** per headline at most |
| Body / UI | **Inter** (already self-hosted) | 400, 500, 600 | |
| IDs, codes, labels | **JetBrains Mono** | 500, 600 | |

- Fluid scale (`clamp`): Display 44→76 px · H1 36→56 · H2 28→40 · H3 20→26 · body 16→18 · small 14.
- Headings: letter-spacing −0.02em, line-height 1.08–1.15. Body: line-height 1.6, max 70ch.
- Latin + Latin Extended subsets cover French (é, è, ê, à, ç, œ, «»). French text runs ~15–20% longer: layouts
  must not depend on English string lengths.
- French typography: non-breaking space before `: ; ! ?` and inside « » (handled in the i18n helper).

## 6. Logo

- Source: `images/tanex files/logo.png`: 1080×1080 RGB, **not transparent**, white background; wordmark "Tan"
  black, "Ex" orange `#F48800`, orange paper plane with speed lines, tagline "From Your Door to the World" below.
  **A vector (SVG/AI/PDF) original is requested** from the owner (tracker #101).
- `scripts/optimize-images.mjs --brand` derives into `Public/brand/`:
  - `logo.png`: full lockup with tagline, transparent (white keyed out, soft edges), for light surfaces and documents;
  - `logo-wordmark.png` + `logo-wordmark-web.webp`: **without the tagline** (the tagline is unreadable at header
    size), for the header;
  - `logo-white.png` / `logo-wordmark-white*.webp`: black parts turned **cream `#FBF6EC`**, orange kept, for dark surfaces;
  - `mark.png`: the **orange paper plane** (with speed lines) on transparent; favicons (the 16 px one shows the plane
    alone), app icons (maskable and Apple touch on Chocolate 950, with padding) and `og-image.jpg` (1200×630: cream
    logo on Chocolate 950).
  - Paths and pixel sizes live in `src/config/brand.ts`; bump `BRAND_ASSET_VERSION` (and the `?v=` in `index.html`
    and `site.webmanifest`) whenever the files are regenerated.
- Clear space = height of the "T". Minimum widths: wordmark 104 px, full lockup 160 px.
- Never stretch, recolour the orange, add effects, or place on busy photos without a chocolate overlay.

## 7. Identifiers

**Tracking ID: exactly 8 characters:** `TX` + 6 from the safe alphabet.

```
Format:    TX + [6 chars]       e.g. TX7K2M9P
Alphabet:  23456789ABCDEFGHJKLMNPQRSTUVWXYZ   (no 0/O, 1/I)
Regex:     ^TX[2-9A-HJ-NP-Z]{6}$
Input:     trim, upper-case, strip spaces and dashes ("tx 7k2-m9p" → TX7K2M9P)
Pieces:    TX7K2M9P-01, -02 …   (a search for a piece resolves to the parent)
```
One shared module (`src/shared/trackingId.ts`); the server allocates IDs (`server/trackingIds.ts`). Local and
intercity deliveries use the same tracking IDs.

| Reference | Format | Example |
|---|---|---|
| Support / contact ticket | `TX-TKT-######` | TX-TKT-418230 |
| Invoice | `TX-INV-######` | TX-INV-004091 |
| Security seal | `TX-SL-######` | TX-SL-892401 |
| Cash ledger entry | `TX-CSH-######` | TX-CSH-120554 |
| Quote | `QR-YYYY-#####` | QR-2026-00001 |

## 8. Imagery

- The owner flyer (`images/tanex files/info.png`) confirms the visual mood: cream background, dark chocolate band, orange accents, riders in a tan/brown jacket and helmet with a TanEx top box. Its aircraft, ship and box images are computer-generated with TanEx paint and are **not** used as photos (tracker #121).
- **Real TanEx first:** the Managing Director portrait (About page), the team in the brown TanEx uniform, riders
  and bikes with the orange-branded boxes, trucks, the Check Point office. Photo brief for the owner: tracker #103.
- Until real photos arrive: free-licence photos (Unsplash/Pexels/CC0, credits in `images/*/SOURCES.md`) showing
  African and especially Central/West African settings (ports, airports, markets, motorbike couriers, warehouses).
  No other company's branding visible.
- **3D models** for the homepage Journey (MOTION_3D_SPEC §4): low-poly, matte, warm, in the brand palette only; the rider wears the brown TanEx vest; the top box is orange with the paper-plane mark. Commissioned (tracker #117).
- **Illustration** for 2D fallbacks and posters (bike, truck, city, Mount Cameroon silhouette): flat vector style in the
  brand palette, drawn in-house as SVG (MOTION_3D_SPEC §5).
- Pipeline unchanged: `scripts/optimize-images.mjs` → WebP + JPG per width in `Public/images/site/`, manifest
  `src/data/siteImages.ts`, `<ResponsiveImage>`. Alt text in CONTENT §12 (EN) and CONTENT_FR §12.

## 9. UI details

- **Grid:** 12 columns, max width 1280 px (wide 1440 px), gutters 24 px (16 px mobile). Spacing on a 4 px base
  (4, 8, 12, 16, 24, 32, 48, 64, 96, 128).
- **Radius:** 14 px cards, 10 px inputs, 999 px pills/buttons.
- **Elevation:** soft, warm shadows tinted with chocolate: `0 1px 2px rgb(28 18 14 / .06), 0 8px 24px rgb(28 18 14 / .08)`;
  lifted `0 24px 48px rgb(28 18 14 / .14)`.
- **Signature motifs:** the paper-plane mark, the logo's three speed lines (used as section dividers and on
  moving elements), dashed orange route lines between pins.
- **Icons:** lucide-react, stroke 1.75, sizes 18/20/24; custom SVG mode icons (plane, ship, train, truck,
  warehouse, bike) drawn to match lucide's stroke.
- **Status chips:** semantic colours (§4.1), always with text.
- **Focus:** 2 px orange ring with chocolate offset, always visible on keyboard focus.
- **Forms:** labels above fields, 48 px min touch height on mobile, inline errors with icons + text.
- **Courier app:** 56 px primary action buttons, large type (18 px base), high-contrast mode friendly, works one-handed.
