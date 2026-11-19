# Notifications Specification (email + free WhatsApp)

> Part of the TanEx plan (`docs/TANEX_PLAN.md`). Email foundation in tracker **B.6**; dispatch/customer messages in
> **G.8**.

## 1. Channels

| Channel | How | Cost | Automatic? |
|---|---|---|---|
| **Email** | The company's own mailbox over SMTP (Hostinger Email `smtp.hostinger.com`, port 465 SSL), via `nodemailer` | Included with hosting | Yes |
| **WhatsApp** | **Click-to-chat link** `https://wa.me/<number>?text=<url-encoded message>` opened by a staff member or courier, who presses send in their own WhatsApp (or WhatsApp Business app) | Free | One tap per message |
| **In-app** | Existing console badges and toasts (messages, proofs) + dispatch board | Free | Yes |

**Why WhatsApp isn't sent automatically:** Meta's WhatsApp Business **Cloud API** bills business-initiated
(template) messages per message, and needs business verification. Unofficial libraries that drive WhatsApp Web
break WhatsApp's terms and get the number banned. The owner asked for **free**, so v1 uses click-to-chat links.
Upgrade path (§5) keeps the same templates.

## 2. WhatsApp links

- `src/shared/whatsapp.ts`: `buildWhatsAppLink(phoneE164, templateKey, vars, locale)`. Phone numbers are normalised
  with `libphonenumber-js` (default region **CM**); invalid numbers disable the button with a hint.
- Messages are short, plain text, with the public tracking link, signed with the brand name. No personal data of
  other people.
- Each tap creates a `notification_log` row (channel `WHATSAPP_LINK`, template, job/shipment, user). We record that
  the link was **opened**, not that the message was sent; the UI says so ("Opened in WhatsApp").
- On a desktop browser the link opens WhatsApp Web/Desktop; on phones the app.
- **Built in G.8:** the job messages per step live in `src/shared/jobMessages.ts` (plan + builder, shared by the dispatch drawer and the courier app, in the job's `notify_locale`). The browser tells the server after each tap (`POST /api/notifications/whatsapp`, or `POST /api/local-delivery/whatsapp-opened` from the booking page); the server takes the phone from the job or account, never from the request, stores it masked, and never stores the message text (it can hold a temporary password). Rows show in the job drawer next to the emails.

## 3. Email

- Env: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` (e.g.
  `"TanEx <info@tanexsarl.com>"`), optional `MAIL_REPLY_TO`, `MAIL_STAFF_ALERTS_TO`. If `SMTP_HOST` is unset the
  mailer is **off**: nothing is queued, and features that require email (self-service password reset) hide.
- **Outbox:** `email_outbox (id, to_addr, subject, html, text, template_key, locale, status QUEUED|SENT|FAILED,
  attempts, last_error, related_type, related_id, created_at_ts, sent_at_ts)`. A worker in the same process sends
  queued mail every 30 s, retrying with backoff (1, 5, 15, 60 min; max 5 attempts). The console shows failures
  under Settings → Email.
- Templates: `server/mail/templates/<key>.<locale>.ts` returning `{ subject, html, text }`; simple, branded,
  table-based HTML (logo, chocolate header bar, cream body), plain-text twin, no remote trackers.
- DNS: SPF, DKIM, DMARC for tanexsarl.com (DEPLOYMENT §6) or mail lands in spam.
- `notification_log (id, at_ts, channel, template_key, locale, to_masked, related_type, related_id, user_id, status)`.

## 4. Templates (EN/FR copy in CONTENT §14 / CONTENT_FR §14)

| Key | Channel | When | To |
|---|---|---|---|
| `auth.reset` | email | password reset requested | staff user |
| `auth.welcome` | email / WhatsApp link | user created (temporary password shown once to the admin, never emailed in plain text; the email links to the console and says the admin will share the password) | staff user |
| `quote.received` | email | quote request submitted | customer |
| `quote.ready` | email | quote published | customer |
| `booking.confirmed` | email + WhatsApp link | shipment/local job booked | sender (+ recipient link for local jobs) |
| `local.assigned` | WhatsApp link | courier assigned | recipient / sender |
| `local.on_the_way` | WhatsApp link (+ email) | courier marked on the way | recipient |
| `local.delivered` | WhatsApp link + email | delivered (not a first-mile leg) | sender |
| `local.failed` | WhatsApp link | failed attempt | sender |
| `contact.received` | email | contact/callback/support form | customer (+ staff alert) |
| `payment.proof_received` | email | proof uploaded | staff alert |
| `payment.confirmed` | email | payment approved | customer |
| `shop.order_staff_alert` | email (English, Reply-To the customer) | shop order placed | order email in Shop settings (SHOP_SPEC §12) |
| `shop.order_received` | email | shop order placed | customer (if email; hourly per-address cap) |
| `shop.order_dispatched` | email | shop order sent to dispatch (M.7) | customer (if email) |
| `shop.order_cancelled` | email | shop order cancelled (M.7) | customer (if email) |

## 5. Later upgrade (not in v1, needs owner approval and budget)

WhatsApp Business Cloud API with approved utility templates for fully automatic messages; SMS through a local
aggregator. The template keys and variables above stay the same, so only the sender changes.

## 6. Tests

Phone normalisation (local `6XXXXXXXX` → `+2376XXXXXXXX`), link encoding (accents, line breaks), outbox retry and
give-up, mailer off when unset, no secrets in logs.
