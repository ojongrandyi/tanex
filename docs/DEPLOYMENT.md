# Deployment: GitHub → Hostinger (TanEx, tanexsarl.com)

> **Context:** one working platform, adapted for TanEx (`docs/TANEX_PLAN.md`). This is a **new site**: a **new
> GitHub repo** with fresh history, a **new Hostinger Node.js app**, a **new empty database**, **new secrets** and
> **new staff accounts**. Never connect it to, push to or reuse any other client's repo, app, domain, database,
> chat widget key or secrets.

The app is **one Node.js process** on **one domain**: Express serves the API (`/api/*`), the built site (`dist/`),
the blog and the staff console at **`https://tanexsarl.com/private-user/`** (the courier app opens there too).
Data lives in a **SQLite file** plus an **uploads folder**, both outside the deploy folder.

## 1. Hosting requirements

| Need | Why |
|---|---|
| Hostinger plan that runs **Node.js web apps** (Business / Cloud, or a VPS) | Express API, tracking, console and courier app |
| **Node.js ≥ 22.5** (22.x LTS or newer) | `node:sqlite` |
| **Persistent storage** outside the deploy folder | Database and uploads must survive redeploys |
| HTTPS (free SSL) | Secure session cookie; geolocation in the courier app only works on HTTPS |
| **Hostinger Email** mailbox `info@tanexsarl.com` (SMTP) | Password resets and customer emails (NOTIFICATIONS_SPEC) |

## 2. Repository (new repo, fresh history)

1. Create a **new, empty private GitHub repo** for TanEx.
2. `.gitignore` must exclude `node_modules/`, `dist/`, `dist-server/`, `/data/`, `.env`, `images/` originals that
   aren't needed in production (keep `images/*/SOURCES.md` if credits are required).
3. Push one fresh-history commit:
   ```bash
   git checkout --orphan tanex-main
   git add -A
   git commit -m "TanEx: initial release"
   git branch -M main
   git remote add origin <NEW-EMPTY-TANEX-REPO-URL>
   git remote -v        # must show ONLY the TanEx repo
   git push -u origin main
   ```

## 3. Hostinger app configuration

| Setting | Value |
|---|---|
| Source | GitHub → TanEx repo, branch `main` |
| Node version | 22.x (≥ 22.5) |
| Install | `npm install` (postinstall runs `npm run build`) |
| Build | empty if allowed, otherwise `npm run build` (don't build twice) |
| Start | `npm start` → `node dist-server/server/index.js` |
| Port | the platform's `PORT` |

## 4. Environment variables (hPanel; never commit)

Create `/home/<hostinger-user>/tanex-data/` (outside the app folder) first.

```ini
NODE_ENV=production
SESSION_SECRET=<64 hex chars, new for TanEx>
DB_PATH=/home/<user>/tanex-data/tanex.db
UPLOADS_DIR=/home/<user>/tanex-data/uploads

# First start only: creates the first Super Admin (IAM_RBAC_SPEC §8), then remove ADMIN_PASSWORD_HASH
SUPER_ADMIN_EMAIL=<owner's email>
SUPER_ADMIN_NAME=<owner's name>
ADMIN_PASSWORD_HASH=<bcrypt hash of a strong temporary password>

# Email (Hostinger Email)
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=info@tanexsarl.com
SMTP_PASS=<mailbox password>
MAIL_FROM="TanEx <info@tanexsarl.com>"
MAIL_STAFF_ALERTS_TO=info@tanexsarl.com
# Optional: MAIL_REPLY_TO; APP_URL (base of links in emails, default https://tanexsarl.com;
# set it only for a staging copy). Links never use the request Host header.
# Optional: CORS_ORIGINS (extra origins allowed to call the API; normally unset).
# Without SESSION_SECRET a random secret is generated once into DB_PATH's folder (.session-secret).
```
Without `SMTP_HOST` email is off: nothing is queued and "Forgot password?" is hidden (the server log says so
at start). With it, emails wait in the `email_outbox` table and are sent every 30 s, retried after 1, 5, 15 and
60 min; failures show under Settings → Email.
Leave unset: `SEED_DEMO_DATA` (ignored; no demo data ships) and `ADMIN_PROXY_TARGET` (unused proxy mode).

Generate secrets locally:
```bash
node -e "console.log(require('bcryptjs').hashSync('TEMPORARY-STRONG-PASSWORD', 12))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Recovery: `npm run create-super-admin` on the server (SSH) creates or resets a Super Admin.

**Uploads folder** holds `images/` (package photos), `proofs/` (payment proofs, private), `blog/` (public blog
images), `pod/` (proof-of-delivery photos and signatures, private) and `couriers/` (courier photos).

**Persistence check:** signed in as Super Admin, open `/api/diag/storage`: `dataDir` must be `tanex-data`. Redeploy;
`markerFirstSeen` must not change. Then remove the endpoint (#59).

## 5. Domain and paths

| Host | Points to |
|---|---|
| `tanexsarl.com` | The TanEx Node app (site, blog, API, console) |
| `www.tanexsarl.com` | 301 → `https://tanexsarl.com` (one host keeps the session cookie and canonical URLs consistent) |

- Staff console and courier app: **`https://tanexsarl.com/private-user/`**: never linked publicly, never in
  `robots.txt`/sitemap, served with `X-Robots-Tag: noindex, nofollow`.
- Public pages are real paths (`/services`, `/fr/services`, `/blog/<slug>`), answered by the server with per-page
  meta (I18N_SPEC §4). Unknown paths → 404 page.
- SSL on both hosts; force HTTPS.

## 6. Email DNS (info@tanexsarl.com)

- Create the mailbox in Hostinger Email; add **MX**, **SPF** (`v=spf1 include:_spf.mail.hostinger.com ~all` or as
  hPanel shows), **DKIM** (from hPanel), **DMARC** (`v=DMARC1; p=quarantine; rua=mailto:info@tanexsarl.com`).
- In the console: Settings → Email → **Send test email**. In Gmail, "Show original": SPF/DKIM/DMARC = PASS.

## 7. Launch checklist (on the live domain)

- [ ] **No demo data:** empty database; tracking a made-up ID (`TX7K2M9P`) says "not found"; no sample blog posts.
- [ ] Home over HTTPS with the TanEx logo, name, favicon; `/fr/` in French; no console errors.
- [ ] `www.` and `http://` redirect to `https://tanexsarl.com/`.
- [ ] `/api/health` → `ok`, `"service": "TanEx API"`.
- [ ] `SESSION_SECRET` set in hPanel (64 hex chars, §4). Until it is, the server uses the random secret it generated in `tanex-data/.session-secret` (start log says so); setting it signs everyone out once.
- [ ] `/private-user/` login with the Super Admin; forced password change; `ADMIN_PASSWORD_HASH` removed afterwards.
- [ ] Create users for each role; each sees only their areas; a Courier lands in the courier app.
- [ ] `/#/admin` shows Home; `/admin` shows 404; robots.txt and sitemap don't mention `private-user`.
- [ ] Admin shipment → `TX` 8-character ID → public track (lower case, spaces, piece label) works.
- [ ] Waybill, BOL, invoice PDFs show TanEx, `info@tanexsarl.com`, `tanexsarl.com`, `TX-INV-` only.
- [ ] Quote → publish → public link; contact form → Messages with `TX-TKT-`; emails arrive (not spam).
- [ ] Package photo, payment request with **MTN MoMo/Orange Money** accounts, proof upload → approve.
- [ ] Local delivery: public booking in Buea → dispatch prices and assigns → courier phone: accept, picked up,
      on my way (live dot visible on the public track page), delivered with photo → cash recorded → Finance confirms.
- [ ] WhatsApp buttons open WhatsApp with the right text and number (test on a phone).
- [ ] Blog: publish an EN post and its FR translation → `/blog`, `/fr/blog`, home section, sitemap, RSS, WhatsApp
      preview (OG image) correct.
- [ ] Redeploy → shipment, photos, blog images, POD and sessions still there.
- [ ] Compression on JS; `/assets/*` immutable; HTML `no-cache`.
- [ ] Lighthouse mobile on Home meets MOTION_3D_SPEC §2; reduced-motion path checked on a phone.
- [ ] View source: no previous-client names, domains, emails, keys.

## 8. After launch

- **Backups (daily):** `tanex.db` **and** the whole `UPLOADS_DIR` to off-server storage. Use
  `sqlite3 tanex.db ".backup tanex-backup.db"` where available, or copy while idle. Test a restore once.
- **Data retention:** courier locations purge after 30 days automatically; audit log kept (export yearly).
- **Updates:** push to `main` → redeploy; use a `staging` branch for big changes.
- **Monitoring:** free uptime monitor on `/api/health` (5 min) alerting `info@tanexsarl.com`; check Settings →
  Email for failed messages weekly.
- **Security:** rotate `SESSION_SECRET` if staff with server access leave (logs everyone out); disable departing
  users in the console the same day; `npm audit` monthly; remove `/api/diag/storage` after the persistence check.
