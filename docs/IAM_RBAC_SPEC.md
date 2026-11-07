# IAM & RBAC Specification (staff accounts, roles, permissions)

> Part of the TanEx plan (`docs/TANEX_PLAN.md`). Tracker phase **B**. This work explicitly changes
> `server/middleware/auth.ts` and `server/routes/auth.ts` (CLAUDE.md rule 8 exception, recorded in the Decisions log).

## 1. Goal

Replace the single shared admin password with **named accounts**. The **Super Admin** creates users, creates roles
(e.g. Marketing, Dispatch Manager, Courier), and assigns them. Every API route checks a **permission**, and every
change made by a person is attributable in an **audit log**.

## 2. Today (baseline to migrate from)

- `POST /api/auth/login` compares one password with `ADMIN_PASSWORD_HASH` and sets `req.session.isAdmin = true`.
- `requireAdminAuth` checks only that flag. Sessions use express-session's in-memory store (lost on every restart).
- Mixed public/admin routers gate admin routes individually; `stats` and `payments` are gated at the mount point.

## 3. Data model (new tables; created in `initDatabase()` with `CREATE TABLE IF NOT EXISTS`)

```sql
users (
  id TEXT PRIMARY KEY,                 -- 'usr_' + random
  email TEXT UNIQUE,                   -- lower-cased; nullable (couriers may have none)
  phone TEXT UNIQUE,                   -- E.164 (libphonenumber-js, default region CM); nullable
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,         -- bcrypt cost 12
  status TEXT NOT NULL DEFAULT 'ACTIVE',            -- ACTIVE | DISABLED
  must_change_password INTEGER NOT NULL DEFAULT 1,
  locale TEXT NOT NULL DEFAULT 'en',                -- en | fr
  avatar_file TEXT, job_title TEXT, bio TEXT,       -- bio/avatar used as blog author profile
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until_ts INTEGER,
  last_login_ts INTEGER,
  created_at_ts INTEGER NOT NULL, updated_at_ts INTEGER NOT NULL,
  created_by TEXT,
  CHECK (email IS NOT NULL OR phone IS NOT NULL)
)
roles (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, description TEXT,
       is_system INTEGER NOT NULL DEFAULT 0, is_locked INTEGER NOT NULL DEFAULT 0,   -- locked = Super Admin
       created_at_ts INTEGER NOT NULL, updated_at_ts INTEGER NOT NULL)
permissions (key TEXT PRIMARY KEY, group_key TEXT NOT NULL, description TEXT NOT NULL)  -- synced from code at boot
role_permissions (role_id TEXT, permission_key TEXT, PRIMARY KEY (role_id, permission_key))
user_roles (user_id TEXT, role_id TEXT, PRIMARY KEY (user_id, role_id))
sessions (sid TEXT PRIMARY KEY, user_id TEXT, data_json TEXT NOT NULL, expires_at_ts INTEGER NOT NULL,
          created_at_ts INTEGER NOT NULL, last_seen_ts INTEGER, ip TEXT, user_agent TEXT)
password_resets (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at_ts INTEGER NOT NULL, used_at_ts INTEGER)
audit_log (id TEXT PRIMARY KEY, at_ts INTEGER NOT NULL, actor_user_id TEXT, actor_name TEXT,
           action TEXT NOT NULL,          -- e.g. 'auth.login', 'shipment.update', 'role.permissions.set'
           entity_type TEXT, entity_id TEXT, summary TEXT, before_json TEXT, after_json TEXT, ip TEXT)
-- indexes: sessions(expires_at_ts), sessions(user_id), audit_log(at_ts), audit_log(entity_type, entity_id), audit_log(actor_user_id)
```

A user may hold **several roles**; effective permissions = union. `*` (Super Admin) grants everything.

## 4. Permission catalogue

Defined once in `src/shared/permissions.ts` (shared by client and server, like `trackingId.ts`), synced into the
`permissions` table at boot. Adding a feature = adding keys here.

| Group | Keys |
|---|---|
| Dashboard | `dashboard.view` |
| Shipments | `shipments.view`, `shipments.create`, `shipments.edit`, `shipments.delete` (trash, restore, permanent delete) |
| Tracking | `tracking.update` (add/correct events, status changes, returns) |
| Documents | `documents.view`, `documents.manage` |
| Quotes | `quotes.view`, `quotes.manage` (publish, convert) |
| Messages | `messages.view`, `messages.manage` |
| Payments | `payments.view`, `payments.manage` (requests, approve/reject proofs) |
| Dispatch | `dispatch.view`, `dispatch.manage` (create/price/assign/cancel jobs), `tariffs.manage`, `couriers.view`, `couriers.manage` |
| Courier | `courier.app` (courier app; **own jobs only**) |
| Cash | `cash.view`, `cash.confirm` (confirm courier handovers, adjustments) |
| Blog | `blog.view`, `blog.write` (own drafts), `blog.edit_any`, `blog.publish`, `blog.categories` |
| Admin | `users.view`, `users.manage`, `roles.manage`, `settings.view`, `settings.manage`, `audit.view` |

Seeded roles and their keys: TANEX_PLAN §4.1. Seeding runs only when the `roles` table is empty; afterwards the
roles belong to the Super Admin (except the locked Super Admin role).

## 5. Rules

1. **Server is the authority.** `requirePermission(...keys)` (any-of) and `requireAuth` replace `requireAdminAuth`.
   Permissions are read from the DB per request (cheap in SQLite; cache per request) so revocations apply at once.
2. **Row-level rules** live next to the route: a courier can only read/update `dispatch_jobs` where
   `courier_user_id = me`; a `blog.write` user without `blog.edit_any` can only edit their own posts.
3. **Super Admin safety:** the Super Admin role can't be edited/deleted; the last active Super Admin can't be
   disabled, demoted or deleted; nobody can grant a permission they don't hold (except Super Admin).
4. **Users are never hard-deleted** (audit history refers to them): they are disabled.
5. **Passwords:** min 10 characters, not equal to email/phone, bcrypt cost 12. New users and reset users get a
   temporary password and `must_change_password = 1`; the console forces a change before anything else.
6. **Login:** identifier = email or phone. 5 failures → `locked_until_ts = now + 15 min` (message stays generic:
   "Incorrect sign-in details."). Per-IP limiter (existing, 20 / 15 min) stays. `session.regenerate()` on success.
   Audit `auth.login` / `auth.login_failed` / `auth.logout`.
7. **Sessions:** SQLite store (`server/auth/sessionStore.ts`, implements express-session `Store`: get/set/destroy/
   touch/clear, expired rows purged hourly). Cookie renamed **`tx.sid`** (httpOnly, sameSite=lax, secure in
   production, 12 h rolling; couriers 7 days so riders aren't logged out mid-shift: `maxAge` set per user at login).
   Disabling a user or changing their password deletes their other sessions.
8. **CSRF:** keep sameSite=lax and additionally reject state-changing `/api` requests whose `Content-Type` isn't
   `application/json` or `multipart/form-data` (blocks simple cross-site form posts).
9. **Audit:** a helper `audit(req, action, entity, before?, after?)` is called by every admin write route.
   `before/after` hold only changed fields; never passwords, hashes or tokens.
10. **2FA (TOTP)**: optional follow-up for users with `users.manage` (tracker B.7). Not required for launch.

## 6. API

| Method & path | Permission | Notes |
|---|---|---|
| `POST /api/auth/login` | public (rate-limited) | `{ identifier, password }` |
| `POST /api/auth/logout` | session | |
| `GET /api/auth/session` | public | `{ user: { id, displayName, email, phone, locale, roles, permissions, mustChangePassword } | null, passwordReset }` (`passwordReset`: the sign-in screen may offer "Forgot password?"; false until B.6) |
| `POST /api/auth/change-password` | session | `{ currentPassword, newPassword }`; clears `must_change_password` |
| `PATCH /api/auth/me` | session | `{ displayName?, locale? }`: own name (1–80 chars) and language (`en`/`fr`) only; audited `user.update_self` (added B.4) |
| `POST /api/auth/forgot` | public (rate-limited) | emails a reset link when SMTP is set; always answers the same |
| `POST /api/auth/reset` | public (token) | token is random 32 bytes, stored hashed, 30 min, single use |
| `GET/POST /api/users`, `GET/PATCH /api/users/:id` | `users.view` / `users.manage` | create (returns the temporary password once), edit, roles, disable/enable. An account can only be changed by someone holding all of its permissions; no self-disable (added B.5) |
| `POST /api/users/:id/reset-password` | `users.manage` | returns a one-time temporary password (shown once; can be sent by WhatsApp link) |
| `GET /api/users/:id/sessions`, `DELETE /api/users/:id/sessions` | `users.manage` | sign out everywhere |
| `GET/POST /api/roles`, `PATCH/DELETE /api/roles/:id` | `roles.manage` (GET also `users.manage`) | permissions edited as a checklist; seeded roles can be edited but not deleted; a role in use can't be deleted (B.5) |
| `GET /api/permissions` | `roles.manage` | catalogue with groups/descriptions |
| `GET /api/audit`, `GET /api/audit/filters` | `audit.view` | filters: `actor`, `action`, `entityType`, `entityId`, `from`/`to` (epoch ms, `to` exclusive); `page`, `pageSize` (50, max 100); `/filters` lists the actions, record types and people present |

## 7. Mapping existing routes (B.3)

| Route | Today | New |
|---|---|---|
| `GET /api/shipments`, `GET /api/shipments/:id` | admin | `shipments.view` |
| `POST /api/shipments` | public booking | unchanged (public); when called with a session, `created_by` is recorded |
| `PUT /api/shipments/:id`, images routes | admin | `shipments.edit` |
| `PATCH /:id/status`, `POST/PATCH /:id/events`, `POST /:id/return` | admin | `tracking.update` |
| `DELETE /:id`, `POST /:id/restore`, `DELETE /:id/permanent` | admin | `shipments.delete` |
| `GET/PUT/POST/DELETE /:id/payment` | admin | GET `payments.view`, others `payments.manage` |
| `/api/payments/*` | admin (mount) | `payments.view` (list, files), `payments.manage` (approve/reject) |
| `GET /api/quotes` | admin | `quotes.view`; publish/convert → `quotes.manage` (+ `shipments.create` for convert) |
| `GET /api/quotes/:id`, `POST /api/quotes`, `PATCH /:id/status` | public | unchanged |
| `/api/documents` admin routes | admin | GET `documents.view`; regenerate/status/payment-status/delete `documents.manage` |
| `POST /api/documents/generate` | public | unchanged |
| `GET /api/messages`, `PATCH /:id/status` | admin | `messages.view` / `messages.manage` |
| `PUT /api/settings` | admin | `settings.manage`. Also: `GET /api/settings` returns only public fields to anonymous callers (closes the known leak in tracker system notes) |
| `/api/stats` | admin (mount) | `dashboard.view` (figures limited to what the user can view) |
| `/api/diag/storage` | admin | `settings.manage` (remove after the persistence check, #59) |

`displayOperator()` and `ADMIN_ROLE_LABEL`: new records store the user's display name; old "Administrator"/"Super
Admin" values keep displaying as before.

## 8. Migration & bootstrap (B.1)

On start, if `users` is empty:
- if `SUPER_ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH` are set → create the Super Admin with that hash,
  `must_change_password = 1`, display name `SUPER_ADMIN_NAME` (default "Super Admin"); log it (without secrets);
- otherwise log a clear message: run `npm run create-super-admin` (script `scripts/create-super-admin.ts`, prompts
  for email, name and password; also the recovery tool if every Super Admin is locked out).
After bootstrap, `ADMIN_PASSWORD_HASH` is no longer read and can be removed from the environment.

## 9. Admin UI (B.4–B.6)

- **Login:** "Email or phone" + "Password", "Forgot password?" (only when SMTP is configured), language switch.
- **Forced password change** screen when `mustChangePassword`.
- **AuthContext** (`src/auth/`): loads `/api/auth/session`; `usePermission(key)`, `<Can permission>`; the sidebar,
  buttons and views hide what the user can't use; a user whose only permission is `courier.app` lands in the
  courier app.
- **Users:** table (name, email/phone, roles, status, last login), create/edit drawer, reset password (shows the
  temporary password once + "Send on WhatsApp" link), disable/enable, sign out everywhere.
- **Roles:** list; editor with permissions grouped by area as checkboxes, a "Users with this role" count; system
  roles marked; Super Admin read-only.
- **Audit log:** filterable, paginated table; entry detail shows before/after.
- **My account:** name, language, avatar, change password, active sessions.

## 10. Tests (scripts/*.test.ts, node:test)

Permission union and `*`; route guard returns 401 (no session) / 403 (missing permission); courier cannot read
another courier's job; last Super Admin protections; lockout after 5 failures; reset token single-use and expiry;
session store survives a process restart (file DB); disabling a user kills their session.
