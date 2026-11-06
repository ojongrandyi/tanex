# Blog Specification

> Part of the TanEx plan (`docs/TANEX_PLAN.md`). Tracker phase **F**. Needs IAM (B), path routing + i18n (D) and the
> new design (E).

## 1. Goal

Staff with blog permissions write professional articles in the console (**Blog studio**). Published posts appear on
`/blog` (EN) and `/fr/blog` (FR), on the homepage "From the blog" section, in the sitemap and RSS, and look right when
shared on WhatsApp, Facebook and LinkedIn.

## 2. Roles

| Permission | Can |
|---|---|
| `blog.view` | See the studio and all posts (read-only). |
| `blog.write` | Create posts and edit **their own** drafts; submit for review. |
| `blog.edit_any` | Edit any post. |
| `blog.publish` | Publish, schedule, unpublish, archive. |
| `blog.categories` | Manage categories. |

Marketing gets all five by default; a junior writer role can be given `blog.write` only (review workflow).

## 3. Data model (additions only)

```sql
blog_posts (
  id TEXT PRIMARY KEY,
  locale TEXT NOT NULL,                     -- en | fr
  translation_group_id TEXT NOT NULL,       -- same value for the EN and FR versions of one article
  slug TEXT NOT NULL,                       -- unique per locale; lower-case, ascii, hyphens
  title TEXT NOT NULL, excerpt TEXT NOT NULL,
  content_json TEXT NOT NULL,               -- TipTap/ProseMirror document (editing source)
  content_html TEXT NOT NULL,               -- sanitised HTML (rendering source), generated on save
  cover_media_id TEXT, cover_alt TEXT,
  author_user_id TEXT NOT NULL,
  status TEXT NOT NULL,                     -- DRAFT | IN_REVIEW | SCHEDULED | PUBLISHED | ARCHIVED
  published_at_ts INTEGER,                  -- for SCHEDULED: the go-live time
  seo_title TEXT, seo_description TEXT,     -- fall back to title / excerpt
  tags TEXT,                                -- comma list
  reading_minutes INTEGER NOT NULL,
  created_at_ts INTEGER NOT NULL, updated_at_ts INTEGER NOT NULL, updated_by TEXT,
  UNIQUE (locale, slug)
)
blog_categories (id TEXT PRIMARY KEY, locale TEXT NOT NULL, slug TEXT NOT NULL, name TEXT NOT NULL,
                 description TEXT, translation_group_id TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0,
                 UNIQUE (locale, slug))
blog_post_categories (post_id TEXT, category_id TEXT, PRIMARY KEY (post_id, category_id))
blog_media (id TEXT PRIMARY KEY, file_name TEXT NOT NULL, width INTEGER, height INTEGER, size_bytes INTEGER,
            alt TEXT, uploaded_by TEXT NOT NULL, created_at_ts INTEGER NOT NULL)
```
Old slugs: when a published post's slug changes, the old slug is kept in a `blog_slug_redirects (locale, old_slug,
post_id)` table and answered with a 301.

A post is public when `status = 'PUBLISHED'`, or `status = 'SCHEDULED'` and `published_at_ts <= now` (the server
flips scheduled posts to PUBLISHED on read and every minute).

**No sample posts** are created (CLAUDE.md rule 9). The homepage section and the blog index hide or show an empty
state until the first real post is published.

## 4. Studio (admin, lazy chunk)

- **List:** tabs by status, language filter, search, columns (title, language, author, category, status, date),
  "Translation: FR missing / linked" indicator.
- **Editor:** TipTap (MIT; `@tiptap/react`, `@tiptap/starter-kit`, link, image, placeholder, character-count),
  loaded only inside the console. Blocks: headings H2–H4, paragraphs, bold/italic, links, bulleted/numbered lists,
  quote, image with caption + alt (required), horizontal rule, simple table (optional), callout. No raw HTML.
- **Side panel:** slug (auto from title, editable), excerpt (160 chars guide), cover image + alt, categories, tags,
  author (default me; `blog.edit_any` can change), SEO title/description with a live Google/WhatsApp preview,
  reading time, language + "Create French version" (copies the structure into a linked FR draft).
- **Actions:** Save draft (also autosave every 20 s), Preview (opens the public page in preview mode with a
  signed, short-lived token), Submit for review, Publish now / Schedule, Unpublish, Archive.
- **Media:** images are compressed in the browser (existing `imageCompress.ts`) to WebP at 1600 px and 800 px wide,
  uploaded to `UPLOADS_DIR/blog/`, served at `/media/blog/<file>` with a 30-day cache. Server checks type
  (JPEG/PNG/WebP/AVIF), size (≤ 3 MB each) and decodes dimensions. `sharp` is not required in production.

## 5. Server

- `server/routes/blog.ts` (admin CRUD + media, permissions above, audit entries `blog.*`) and
  `server/routes/publicBlog.ts` (published only).
- On save: `content_html` = render `content_json` → HTML, then **sanitise** with `sanitize-html` (allow-list of
  the editor's tags/attributes; links get `rel="noopener"` and external ones `nofollow ugc` off by default;
  images only from `/media/blog/`). Reading time = words ÷ 200, min 1.
- Public API: `GET /api/blog?locale=&category=&page=` (12 per page, excerpt + cover only),
  `GET /api/blog/:locale/:slug` (full post + previous/next + up to 3 related by category),
  `GET /api/blog/latest?locale=&limit=3` (homepage).

## 6. Public pages

- `/blog`, `/fr/blog`: hero (eyebrow + title from CONTENT §15), category chips, featured latest post, grid of
  cards (cover, category, title, excerpt, date, reading time), pagination.
- `/blog/<slug>`: title, author (name, avatar, job title), date, reading time, cover, article body with the brand
  typography (max 70ch, generous line height), share buttons (WhatsApp, Facebook, LinkedIn, X, copy link: plain
  links, no third-party scripts), related posts, "Get a Quote" CTA, language switch to the linked translation.
- `/blog/category/<slug>`.
- **Homepage section** (CONTENT §2.9): latest 3 posts in the current language; hidden if none.

## 7. SEO

Server-side meta per post (I18N_SPEC §4): `<title>`, description, canonical, `hreflang` en/fr/x-default for linked
translations, Open Graph (`article`, cover image ≥ 1200 px wide), Twitter card, JSON-LD `BlogPosting` (headline,
image, datePublished, dateModified, author, publisher = Tanex SARL with logo). Posts and categories in
`sitemap.xml` with `lastmod`. RSS 2.0 at `/blog/rss.xml` and `/fr/blog/rss.xml`. Article pages render the post body
from the API on the client; the server-injected meta and a `<noscript>` excerpt make shares and indexing work
without full SSR.

## 8. Tests

Sanitiser strips scripts/handlers/`javascript:` URLs; slug uniqueness per locale; scheduled post becomes visible at
its time; writer can't edit others' posts or publish; old slug redirects; unpublished posts 404 publicly.
