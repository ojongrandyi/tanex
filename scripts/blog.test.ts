// Blog API (docs/BLOG_SPEC.md §2, §3, §5, §8) against the real /api mounts on a file database
// in a temp folder: blog.* permissions and ownership, slug uniqueness per locale, publishing and
// scheduling, old-slug redirects, 404 for anything not public, translations, media checks and
// audit entries. Run with `npm test`.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tanex-blog-test-'));
process.env.DB_PATH = path.join(tmpDir, 'tanex.db');
process.env.UPLOADS_DIR = path.join(tmpDir, 'uploads');
delete process.env.NODE_ENV;

const express = (await import('express')).default;
const { db, initDatabase } = await import('../server/db.ts');
const { SqliteSessionStore, createSessionMiddleware } = await import('../server/auth/sessionStore.ts');
const { requireJsonOrMultipart } = await import('../server/middleware/auth.ts');
const { registerApiRoutes } = await import('../server/apiRoutes.ts');
const { publishDuePosts } = await import('../server/blog/posts.ts');

initDatabase();

const PASSWORD = 'correct horse battery';
const HASH = bcrypt.hashSync(PASSWORD, 4);
const now0 = Date.now();

function addRole(id: string, keys: string[]) {
  db.prepare(`INSERT INTO roles (id, name, description, is_system, is_locked, created_at_ts, updated_at_ts) VALUES (?, ?, '', 0, 0, ?, ?)`)
    .run(id, id, now0, now0);
  for (const k of keys) db.prepare('INSERT INTO role_permissions (role_id, permission_key) VALUES (?, ?)').run(id, k);
}
function addUser(id: string, roleId: string, name: string) {
  db.prepare(`
    INSERT INTO users (id, email, display_name, password_hash, status, must_change_password, job_title, created_at_ts, updated_at_ts)
    VALUES (?, ?, ?, ?, 'ACTIVE', 0, ?, ?, ?)
  `).run(id, `${id}@example.test`, name, HASH, `${name} title`, now0, now0);
  db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').run(id, roleId);
}
addRole('role_t_writer', ['blog.write']);
addRole('role_t_editor', ['blog.view', 'blog.write', 'blog.edit_any', 'blog.publish', 'blog.categories']);
addUser('usr_writer', 'role_t_writer', 'Writer One');
addUser('usr_writer2', 'role_t_writer', 'Writer Two');
addUser('usr_editor', 'role_t_editor', 'Editor');
addUser('usr_marketing', 'role_marketing', 'Marketing'); // seeded: view, write, publish, categories
addUser('usr_ops', 'role_operations_manager', 'Ops'); // no blog permission

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(createSessionMiddleware(new SqliteSessionStore(db, { purgeIntervalMs: false }), 'test-secret'));
app.use('/api', requireJsonOrMultipart);
registerApiRoutes(app);
const server = app.listen(0);
await new Promise<void>((r) => server.once('listening', () => r()));
const BASE = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

after(async () => {
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function call(method: string, p: string, cookie?: string, body?: unknown, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {};
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(`${BASE}${p}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), ...init });
}

const cookies = new Map<string, string>();
async function as(userId: string): Promise<string> {
  if (!cookies.has(userId)) {
    const res = await call('POST', '/api/auth/login', undefined, { identifier: `${userId}@example.test`, password: PASSWORD });
    assert.equal(res.status, 200, `sign-in as ${userId}`);
    cookies.set(userId, res.headers.getSetCookie().find((h) => h.startsWith('tx.sid='))!.split(';')[0]);
  }
  return cookies.get(userId)!;
}

const doc = (text: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
const ADMIN = '/api/admin/blog';

async function createPost(user: string, body: Record<string, unknown>) {
  const res = await call('POST', `${ADMIN}/posts`, await as(user), { locale: 'en', excerpt: 'Short summary.', content: doc('Some words here.'), ...body });
  const json = await res.json();
  assert.equal(res.status, 201, JSON.stringify(json));
  return json.data;
}
async function publish(id: string, user = 'usr_editor', body: Record<string, unknown> = {}) {
  return call('POST', `${ADMIN}/posts/${id}/publish`, await as(user), body);
}
const auditCount = (action: string, entityId: string) =>
  (db.prepare('SELECT COUNT(*) AS c FROM audit_log WHERE action = ? AND entity_id = ?').get(action, entityId) as { c: number }).c;

test('no sample posts, categories or media exist on a new database', () => {
  for (const table of ['blog_posts', 'blog_categories', 'blog_media', 'blog_slug_redirects']) {
    assert.equal((db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c, 0, table);
  }
});

test('permissions: signed out 401, no blog permission 403', async () => {
  assert.equal((await call('GET', `${ADMIN}/posts`)).status, 401);
  assert.equal((await call('POST', `${ADMIN}/posts`, undefined, { locale: 'en', title: 'x' })).status, 401);
  const ops = await as('usr_ops');
  assert.equal((await call('GET', `${ADMIN}/posts`, ops)).status, 403);
  assert.equal((await call('POST', `${ADMIN}/posts`, ops, { locale: 'en', title: 'x' })).status, 403);
  assert.equal((await call('POST', `${ADMIN}/categories`, ops, { locale: 'en', name: 'x' })).status, 403);
  assert.equal((await call('GET', `${ADMIN}/media`, ops)).status, 403);
});

test('writer: own drafts only, cannot publish, cannot edit others or published posts', async () => {
  const mine = await createPost('usr_writer', { title: 'Writer draft' });
  assert.equal(mine.status, 'DRAFT');
  assert.equal(mine.author.id, 'usr_writer');
  assert.equal(auditCount('blog.post_create', mine.id), 1);
  const theirs = await createPost('usr_writer2', { title: 'Other writer draft' });
  const w = await as('usr_writer');

  // Sees and lists only their own posts; the other writer's post is "not found".
  const list = await (await call('GET', `${ADMIN}/posts`, w)).json();
  assert.deepEqual(list.data.map((p: { id: string }) => p.id), [mine.id]);
  assert.equal((await call('GET', `${ADMIN}/posts/${theirs.id}`, w)).status, 404);
  assert.equal((await call('PUT', `${ADMIN}/posts/${theirs.id}`, w, { title: 'Hijack' })).status, 404);
  assert.equal((await call('DELETE', `${ADMIN}/posts/${theirs.id}`, w)).status, 404);

  // Edits own draft; cannot change the author or the status through a save.
  const edit = await call('PUT', `${ADMIN}/posts/${mine.id}`, w, { title: 'Writer draft, edited' });
  assert.equal(edit.status, 200);
  assert.equal(auditCount('blog.post_update', mine.id), 1);
  assert.equal((await call('PUT', `${ADMIN}/posts/${mine.id}`, w, { authorUserId: 'usr_editor' })).status, 403);
  assert.equal((await call('PUT', `${ADMIN}/posts/${mine.id}`, w, { status: 'PUBLISHED' })).status, 400);

  // Cannot publish; can submit for review.
  assert.equal((await publish(mine.id, 'usr_writer')).status, 403);
  const submit = await call('POST', `${ADMIN}/posts/${mine.id}/submit`, w);
  assert.equal(submit.status, 200);
  assert.equal((await submit.json()).data.status, 'IN_REVIEW');

  // Once an editor publishes it, the writer can no longer change it.
  assert.equal((await publish(mine.id)).status, 200);
  const locked = await call('PUT', `${ADMIN}/posts/${mine.id}`, w, { title: 'Sneaky change' });
  assert.equal(locked.status, 403);
  assert.equal((await locked.json()).code, 'BLOG_POST_LOCKED');
  assert.equal((await call('DELETE', `${ADMIN}/posts/${mine.id}`, w)).status, 403);
});

test('blog.view without blog.edit_any reads every post but edits only its own', async () => {
  const theirs = await createPost('usr_writer2', { title: 'Visible to marketing' });
  const m = await as('usr_marketing');
  assert.equal((await call('GET', `${ADMIN}/posts/${theirs.id}`, m)).status, 200);
  const res = await call('PUT', `${ADMIN}/posts/${theirs.id}`, m, { title: 'Changed by marketing' });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).code, 'BLOG_NOT_YOUR_POST');
  // blog.edit_any may edit it and reassign the author.
  const e = await as('usr_editor');
  const ok = await call('PUT', `${ADMIN}/posts/${theirs.id}`, e, { title: 'Changed by editor', authorUserId: 'usr_marketing' });
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).data.author.id, 'usr_marketing');
  // Categories need blog.categories: writers can't, marketing can.
  assert.equal((await call('POST', `${ADMIN}/categories`, await as('usr_writer'), { locale: 'en', name: 'Guides' })).status, 403);
});

test('slugs: unique per locale; auto slugs get a suffix, an explicit duplicate is refused', async () => {
  const a = await createPost('usr_editor', { title: 'Shipping to Douala' });
  assert.equal(a.slug, 'shipping-to-douala');
  const b = await createPost('usr_editor', { title: 'Shipping to Douala' });
  assert.equal(b.slug, 'shipping-to-douala-2');
  const e = await as('usr_editor');
  const dup = await call('POST', `${ADMIN}/posts`, e, { locale: 'en', title: 'Other', slug: 'shipping-to-douala' });
  assert.equal(dup.status, 409);
  assert.equal((await dup.json()).code, 'BLOG_SLUG_TAKEN');
  const rename = await call('PUT', `${ADMIN}/posts/${b.id}`, e, { slug: 'shipping-to-douala' });
  assert.equal(rename.status, 409);
  assert.equal((await call('POST', `${ADMIN}/posts`, e, { locale: 'en', title: 'Bad', slug: 'Bad Slug!' })).status, 400);
  // The same slug in French is a different page.
  const fr = await createPost('usr_editor', { locale: 'fr', title: 'Shipping to Douala' });
  assert.equal(fr.slug, 'shipping-to-douala');
  const accents = await createPost('usr_editor', { locale: 'fr', title: 'Expédier à Limbé' });
  assert.equal(accents.slug, 'expedier-a-limbe');
});

test('public API: drafts, reviews, archived and unknown posts are 404; published posts are served', async () => {
  const post = await createPost('usr_editor', { title: 'Bike delivery in Buea', excerpt: 'How it works.', content: doc('Riders cover Buea.') });
  const url = '/api/blog/en/bike-delivery-in-buea';
  assert.equal((await call('GET', url)).status, 404, 'draft');
  await call('POST', `${ADMIN}/posts/${post.id}/submit`, await as('usr_editor'));
  assert.equal((await call('GET', url)).status, 404, 'in review');

  assert.equal((await publish(post.id)).status, 200);
  assert.equal(auditCount('blog.post_publish', post.id), 1);
  const res = await call('GET', url);
  assert.equal(res.status, 200);
  const data = (await res.json()).data;
  assert.equal(data.title, 'Bike delivery in Buea');
  assert.equal(data.contentHtml, '<p>Riders cover Buea.</p>');
  assert.equal(data.path, '/blog/bike-delivery-in-buea');
  assert.equal(data.author.name, 'Editor');
  assert.equal(data.author.jobTitle, 'Editor title');
  assert.equal(data.seoTitle, 'Bike delivery in Buea');
  assert.equal(data.seoDescription, 'How it works.');
  assert.equal(data.readingMinutes, 1);
  assert.ok(!('content_json' in data) && !('authorUserId' in data) && !('id' in data));
  assert.equal((await call('GET', '/api/blog/fr/bike-delivery-in-buea')).status, 404, 'other locale');
  assert.equal((await call('GET', '/api/blog/de/bike-delivery-in-buea')).status, 404, 'unknown locale');
  assert.equal((await call('GET', '/api/blog/en/no-such-post')).status, 404);

  // Unpublish → 404 again; archive → 404.
  assert.equal((await call('POST', `${ADMIN}/posts/${post.id}/unpublish`, await as('usr_editor'))).status, 200);
  assert.equal((await call('GET', url)).status, 404, 'unpublished');
  assert.equal((await publish(post.id)).status, 200);
  assert.equal((await call('POST', `${ADMIN}/posts/${post.id}/archive`, await as('usr_editor'))).status, 200);
  assert.equal((await call('GET', url)).status, 404, 'archived');
  const listed = await (await call('GET', '/api/blog?locale=en')).json();
  assert.ok(!listed.data.some((p: { slug: string }) => p.slug === 'bike-delivery-in-buea'));
});

test('publishing needs a title, excerpt, body and alt text', async () => {
  const empty = await createPost('usr_editor', { title: 'Empty body', content: { type: 'doc', content: [{ type: 'paragraph' }] } });
  const res = await publish(empty.id);
  assert.equal(res.status, 400);
  assert.equal((await res.json()).code, 'BLOG_NOT_READY');
  const noExcerpt = await createPost('usr_editor', { title: 'No excerpt', excerpt: '' });
  assert.equal((await publish(noExcerpt.id)).status, 400);
  const noAlt = await createPost('usr_editor', {
    title: 'Image without alt',
    content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Words' }] },
      { type: 'image', attrs: { src: '/media/blog/11111111-2222-4333-8444-555555555555.webp' } }] }
  });
  assert.equal((await publish(noAlt.id)).status, 400);
});

test('scheduling: a scheduled post stays hidden until its time, then goes live', async () => {
  const post = await createPost('usr_editor', { title: 'Scheduled article' });
  const url = '/api/blog/en/scheduled-article';
  const at = Date.now() + 60 * 60 * 1000;
  const res = await publish(post.id, 'usr_editor', { publishAt: at });
  assert.equal(res.status, 200);
  const data = (await res.json()).data;
  assert.equal(data.status, 'SCHEDULED');
  assert.equal(data.publishedAt, at);
  assert.equal(auditCount('blog.post_schedule', post.id), 1);
  assert.equal((await call('GET', url)).status, 404, 'before its time');
  const latest = await (await call('GET', '/api/blog/latest?locale=en&limit=6')).json();
  assert.ok(!latest.data.some((p: { slug: string }) => p.slug === 'scheduled-article'));
  assert.equal(publishDuePosts(db, Date.now()), 0);

  // Time passes (moved back in the database rather than waiting).
  db.prepare('UPDATE blog_posts SET published_at_ts = ? WHERE id = ?').run(Date.now() - 1000, post.id);
  const live = await call('GET', url);
  assert.equal(live.status, 200, 'visible once due');
  const row = db.prepare('SELECT status FROM blog_posts WHERE id = ?').get(post.id) as { status: string };
  assert.equal(row.status, 'PUBLISHED', 'flipped to PUBLISHED on read');

  // The scheduler flips due posts on its own as well.
  const other = await createPost('usr_editor', { title: 'Second scheduled' });
  await publish(other.id, 'usr_editor', { publishAt: Date.now() + 5000 });
  assert.equal(publishDuePosts(db, Date.now() + 10_000), 1);
  // Unpublishing a scheduled post cancels it.
  const third = await createPost('usr_editor', { title: 'Cancelled schedule' });
  await publish(third.id, 'usr_editor', { publishAt: Date.now() + 60_000 });
  const cancel = await (await call('POST', `${ADMIN}/posts/${third.id}/unpublish`, await as('usr_editor'))).json();
  assert.equal(cancel.data.status, 'DRAFT');
  assert.equal(cancel.data.publishedAt, null);
  assert.equal((await publish(third.id, 'usr_editor', { publishAt: 'tomorrow' })).status, 400);
});

test('redirects: a published post\'s old slug answers 301 to the new one', async () => {
  const e = await as('usr_editor');
  const post = await createPost('usr_editor', { title: 'Old name' });
  // Renaming a never-published draft leaves no redirect.
  await call('PUT', `${ADMIN}/posts/${post.id}`, e, { slug: 'first-name' });
  assert.equal((db.prepare('SELECT COUNT(*) AS c FROM blog_slug_redirects WHERE post_id = ?').get(post.id) as { c: number }).c, 0);

  await publish(post.id);
  assert.equal((await call('PUT', `${ADMIN}/posts/${post.id}`, e, { slug: 'new-name' })).status, 200);
  await call('PUT', `${ADMIN}/posts/${post.id}`, e, { slug: 'newest-name' });

  for (const old of ['first-name', 'new-name']) {
    const res = await call('GET', `/api/blog/en/${old}`, undefined, undefined, { redirect: 'manual' });
    assert.equal(res.status, 301, old);
    assert.equal(res.headers.get('location'), '/api/blog/en/newest-name');
    assert.equal((await res.json()).path, '/blog/newest-name');
  }
  // fetch follows the redirect to the post.
  const followed = await call('GET', '/api/blog/en/first-name');
  assert.equal(followed.status, 200);
  assert.equal((await followed.json()).data.slug, 'newest-name');

  // A redirect never reveals a post that isn't public.
  await call('POST', `${ADMIN}/posts/${post.id}/unpublish`, e);
  assert.equal((await call('GET', '/api/blog/en/new-name', undefined, undefined, { redirect: 'manual' })).status, 404);
  await publish(post.id);

  // A new post that takes an old slug wins over the redirect.
  const taker = await createPost('usr_editor', { title: 'Takes the slug', slug: 'new-name' });
  await publish(taker.id);
  const res = await call('GET', '/api/blog/en/new-name', undefined, undefined, { redirect: 'manual' });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).data.title, 'Takes the slug');
});

test('translations: one linked version per language; the public post lists public translations', async () => {
  const e = await as('usr_editor');
  const en = await createPost('usr_editor', { title: 'Customs guide', content: doc('English body.') });
  const res = await call('POST', `${ADMIN}/posts`, e, { translationOf: en.id, title: 'Guide des douanes', excerpt: 'Résumé.' });
  assert.equal(res.status, 201);
  const fr = (await res.json()).data;
  assert.equal(fr.locale, 'fr');
  assert.equal(fr.translationGroupId, en.translationGroupId);
  assert.equal(fr.contentHtml, '<p>English body.</p>', 'starts from the source structure');
  const again = await call('POST', `${ADMIN}/posts`, e, { translationOf: en.id, title: 'Encore' });
  assert.equal(again.status, 409);
  assert.equal((await call('POST', `${ADMIN}/posts`, e, { translationOf: en.id, locale: 'en', title: 'Same' })).status, 400);

  await publish(en.id);
  let pub = (await (await call('GET', '/api/blog/en/customs-guide')).json()).data;
  assert.deepEqual(pub.translations, [], 'draft translation not listed');
  await publish(fr.id);
  pub = (await (await call('GET', '/api/blog/en/customs-guide')).json()).data;
  assert.deepEqual(pub.translations, [{ locale: 'fr', slug: 'guide-des-douanes', path: '/fr/blog/guide-des-douanes' }]);
  const admin = (await (await call('GET', `${ADMIN}/posts/${en.id}`, e)).json()).data;
  assert.equal(admin.translations[0].locale, 'fr');
});

test('categories, public list, latest, related and previous/next', async () => {
  const m = await as('usr_marketing');
  const cat = await call('POST', `${ADMIN}/categories`, m, { locale: 'fr', name: 'Conseils d’expédition' });
  assert.equal(cat.status, 201);
  const catFr = (await cat.json()).data;
  assert.equal(catFr.slug, 'conseils-dexpedition');
  const catEnRes = await call('POST', `${ADMIN}/categories`, m, { locale: 'en', name: 'Shipping tips', translationOf: catFr.id });
  const catEn = (await catEnRes.json()).data;
  assert.equal(catEn.translationGroupId, catFr.translationGroupId);
  assert.equal((await call('POST', `${ADMIN}/categories`, m, { locale: 'en', name: 'Shipping tips' })).status, 409);

  const e = await as('usr_editor');
  // A post can't take a category in the other language.
  const wrong = await call('POST', `${ADMIN}/posts`, e, { locale: 'en', title: 'Wrong cat', categoryIds: [catFr.id] });
  assert.equal(wrong.status, 400);

  const ids: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const p = await createPost('usr_editor', { title: `Tip number ${i}`, categoryIds: [catEn.id] });
    await publish(p.id);
    db.prepare('UPDATE blog_posts SET published_at_ts = ? WHERE id = ?').run(Date.now() - (10 - i) * 60_000, p.id);
    ids.push(p.id);
  }
  const list = await (await call('GET', '/api/blog?locale=en&category=shipping-tips')).json();
  assert.equal(list.total, 3);
  assert.deepEqual(list.data.map((p: { title: string }) => p.title), ['Tip number 3', 'Tip number 2', 'Tip number 1']);
  assert.equal(list.category.name, 'Shipping tips');
  assert.ok(!('contentHtml' in list.data[0]), 'cards carry the excerpt only');
  assert.equal((await call('GET', '/api/blog?locale=en&category=nope')).status, 404);
  assert.equal((await call('GET', '/api/blog?locale=xx')).status, 400);

  const chips = await (await call('GET', '/api/blog/categories?locale=en')).json();
  assert.deepEqual(chips.data.map((c: { slug: string; postCount: number }) => [c.slug, c.postCount]), [['shipping-tips', 3]]);
  const frChips = await (await call('GET', '/api/blog/categories?locale=fr')).json();
  assert.deepEqual(frChips.data, [], 'a category without public posts is not listed');

  const latest = await (await call('GET', '/api/blog/latest?locale=en&limit=2')).json();
  assert.equal(latest.data.length, 2);

  const middle = (await (await call('GET', '/api/blog/en/tip-number-2')).json()).data;
  assert.deepEqual(middle.related.map((p: { title: string }) => p.title).sort(), ['Tip number 1', 'Tip number 3']);
  assert.equal(middle.previous.title, 'Tip number 1');
  assert.equal(middle.next.slug !== undefined, true);
  assert.deepEqual(middle.categories, [{ slug: 'shipping-tips', name: 'Shipping tips' }]);

  // Deleting a category keeps its posts.
  assert.equal((await call('DELETE', `${ADMIN}/categories/${catFr.id}`, m)).status, 200);
  assert.equal(auditCount('blog.category_delete', catFr.id), 1);
});

test('deleting: never a live post; writers only their own drafts', async () => {
  const e = await as('usr_editor');
  const live = await createPost('usr_editor', { title: 'Live post to keep' });
  await publish(live.id);
  assert.equal((await call('DELETE', `${ADMIN}/posts/${live.id}`, e)).status, 409);
  const draft = await createPost('usr_writer', { title: 'Writer throwaway' });
  assert.equal((await call('DELETE', `${ADMIN}/posts/${draft.id}`, await as('usr_writer'))).status, 200);
  assert.equal(auditCount('blog.post_delete', draft.id), 1);
  assert.equal((await call('GET', `${ADMIN}/posts/${draft.id}`, e)).status, 404);
});

test('media: type, size and dimension checks; served at /media/blog with a 30-day cache', async () => {
  const w = await as('usr_writer');
  const img = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: '#5a3a22' } });
  const big = await img(1600, 900).webp({ quality: 60 }).toBuffer();
  const res = await call('POST', `${ADMIN}/media`, w, { image: `data:image/webp;base64,${big.toString('base64')}`, alt: 'A rider' });
  assert.equal(res.status, 201);
  const media = (await res.json()).data;
  assert.equal(media.width, 1600);
  assert.equal(media.height, 900);
  assert.match(media.url, /^\/media\/blog\/[0-9a-f-]{36}\.webp$/);
  assert.equal(auditCount('blog.media_upload', media.id), 1);

  const served = await call('GET', media.url);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get('content-type'), 'image/webp');
  assert.equal(served.headers.get('cache-control'), 'public, max-age=2592000');
  assert.equal(served.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(Buffer.from(await served.arrayBuffer()), big);
  assert.equal((await call('GET', '/media/blog/00000000-0000-4000-8000-000000000000.webp')).status, 404);
  assert.equal((await call('GET', '/media/blog/..%2Fproofs%2Fx.png')).status, 404);

  // The 800 px copy: must be narrower.
  const small = await img(800, 450).avif({ quality: 50 }).toBuffer();
  const smallRes = await call('PUT', `${ADMIN}/media/${media.id}/small`, w, { image: small.toString('base64') });
  assert.equal(smallRes.status, 200);
  const withSmall = (await smallRes.json()).data;
  assert.equal(withSmall.small.width, 800);
  assert.equal((await call('GET', withSmall.small.url)).headers.get('content-type'), 'image/avif');
  assert.equal((await call('PUT', `${ADMIN}/media/${media.id}/small`, w, { image: big.toString('base64') })).status, 400);
  // Another writer can't touch it.
  assert.equal((await call('PUT', `${ADMIN}/media/${media.id}/small`, await as('usr_writer2'), { image: small.toString('base64') })).status, 403);

  // Refused: not an allowed image, too wide, too large, unreadable.
  const gif = Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00\x00;', 'latin1');
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>');
  const wide = await img(5000, 100).png({ compressionLevel: 9 }).toBuffer();
  const fakeJpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]), Buffer.alloc(32)]);
  for (const [label, buf] of [['gif', gif], ['svg', svg], ['wide', wide], ['fake jpeg', fakeJpeg]] as const) {
    const r = await call('POST', `${ADMIN}/media`, w, { image: buf.toString('base64') });
    assert.equal(r.status, 400, label);
    assert.equal((await r.json()).code, 'BLOG_INVALID_IMAGE', label);
  }
  const huge = Buffer.concat([big, Buffer.alloc(3 * 1024 * 1024)]);
  assert.equal((await call('POST', `${ADMIN}/media`, w, { image: huge.toString('base64') })).status, 400, 'over 3 MB');

  // In a post the image gets its size and srcset; while used it can't be deleted.
  const post = await createPost('usr_writer', {
    title: 'With picture',
    coverMediaId: media.id,
    coverAlt: 'Cover alt',
    content: { type: 'doc', content: [{ type: 'image', attrs: { src: media.url, alt: 'A rider', caption: 'Buea' } }] }
  });
  assert.match(post.contentHtml, /width="1600" height="900" srcset="\/media\/blog\/[0-9a-f-]{36}\.avif 800w, \/media\/blog\/[0-9a-f-]{36}\.webp 1600w"/);
  assert.equal(post.cover.url, media.url);
  const del = await call('DELETE', `${ADMIN}/media/${media.id}`, w);
  assert.equal(del.status, 409);
  assert.equal((await call('POST', `${ADMIN}/posts`, w, { locale: 'en', title: 'Bad cover', coverMediaId: 'nope' })).status, 400);

  // An unused image can be deleted, and its files go with it.
  const spare = (await (await call('POST', `${ADMIN}/media`, w, { image: big.toString('base64') })).json()).data;
  assert.equal((await call('DELETE', `${ADMIN}/media/${spare.id}`, w)).status, 200);
  assert.equal((await call('GET', spare.url)).status, 404);
  assert.equal(fs.existsSync(path.join(tmpDir, 'uploads', 'blog', spare.url.split('/').pop())), false);
});

test('autosave conflict: a stale expectedUpdatedAt is refused', async () => {
  const e = await as('usr_editor');
  const post = await createPost('usr_editor', { title: 'Autosaved' });
  const first = await call('PUT', `${ADMIN}/posts/${post.id}`, e, { title: 'Autosaved 1', expectedUpdatedAt: post.updatedAt });
  assert.equal(first.status, 200);
  const stale = await call('PUT', `${ADMIN}/posts/${post.id}`, e, { title: 'Autosaved 2', expectedUpdatedAt: post.updatedAt - 1 });
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).code, 'BLOG_POST_CHANGED');
});

test('preview links: signed, short-lived, any status, never for someone who cannot see the post', async () => {
  const { createPreviewToken, readPreviewToken, PREVIEW_TTL_MS } = await import('../server/blog/preview.ts');
  const post = await createPost('usr_writer', { title: 'Preview me', content: doc('Draft words.') });

  // Another writer can't see the post, so can't get a link; signed out is 401.
  assert.equal((await call('POST', `${ADMIN}/posts/${post.id}/preview`, await as('usr_writer2'))).status, 404);
  assert.equal((await call('POST', `${ADMIN}/posts/${post.id}/preview`)).status, 401);

  const res = await call('POST', `${ADMIN}/posts/${post.id}/preview`, await as('usr_writer'));
  assert.equal(res.status, 200);
  const { token, expiresAt } = (await res.json()).data;
  assert.ok(expiresAt > Date.now() && expiresAt <= Date.now() + PREVIEW_TTL_MS);
  assert.equal(auditCount('blog.post_preview', post.id), 1);

  // The draft is readable with the token, without a session, and not cached or indexed.
  const pv = await call('GET', `/api/blog/preview/${token}`);
  assert.equal(pv.status, 200);
  assert.equal(pv.headers.get('cache-control'), 'no-store');
  assert.match(pv.headers.get('x-robots-tag') ?? '', /noindex/);
  const body = (await pv.json()).data;
  assert.equal(body.title, 'Preview me');
  assert.equal(body.status, 'DRAFT');
  assert.equal(body.isPublic, false);
  assert.match(body.contentHtml, /Draft words\./);
  assert.equal(body.author.name, 'Writer One');
  // ...and still 404 on the public post route.
  assert.equal((await call('GET', `/api/blog/en/${post.slug}`)).status, 404);

  // Tampered, extended, malformed or traversal tokens are 404.
  const [id, exp, mac] = token.split('.');
  const flip = mac.slice(0, -1) + (mac.endsWith('A') ? 'B' : 'A');
  for (const bad of [`${id}.${exp}.${flip}`, `${id}.${Number(exp) + 1}.${mac}`, 'post_x.1.y', '../../x']) {
    assert.equal((await call('GET', `/api/blog/preview/${encodeURIComponent(bad)}`)).status, 404, bad);
  }
  const old = createPreviewToken(post.id, Date.now() - PREVIEW_TTL_MS - 1000).token;
  assert.equal(readPreviewToken(old), null);
  assert.equal((await call('GET', `/api/blog/preview/${old}`)).status, 404);
  // A token can't claim more than the allowed lifetime.
  assert.equal(readPreviewToken(createPreviewToken(post.id, Date.now() + 60_000).token), null);
});

test('author profile: own job title, bio and photo; the public post shows them', async () => {
  const w = await as('usr_writer2');
  const patch = await call('PATCH', '/api/auth/me', w, { jobTitle: '  Content   lead ', bio: 'Line one.\r\n\r\n\r\nLine   two.' });
  assert.equal(patch.status, 200);
  const user = (await patch.json()).user;
  assert.equal(user.jobTitle, 'Content lead');
  assert.equal(user.bio, 'Line one.\n\nLine two.');
  assert.equal((await call('PATCH', '/api/auth/me', w, { jobTitle: 'x'.repeat(81) })).status, 400);
  assert.equal((await call('PATCH', '/api/auth/me', w, { bio: 'x'.repeat(501) })).status, 400);
  assert.equal((await call('PATCH', '/api/auth/me', undefined, { jobTitle: 'x' })).status, 401);

  const photo = await sharp({ create: { width: 400, height: 400, channels: 3, background: '#3b2416' } }).webp().toBuffer();
  const up = await call('POST', '/api/auth/me/avatar', w, { image: photo.toString('base64') });
  assert.equal(up.status, 200);
  const url1 = (await up.json()).user.avatarUrl as string;
  assert.match(url1, /^\/media\/avatars\/[0-9a-f-]{36}\.webp$/);
  const served = await call('GET', url1);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get('content-type'), 'image/webp');
  assert.equal(auditCount('user.update_self', 'usr_writer2') >= 2, true);

  // Too big or not an image: refused. A new photo replaces (and deletes) the old one.
  const big = await sharp({ create: { width: 1200, height: 300, channels: 3, background: '#000' } }).png().toBuffer();
  assert.equal((await call('POST', '/api/auth/me/avatar', w, { image: big.toString('base64') })).status, 400);
  assert.equal((await call('POST', '/api/auth/me/avatar', w, { image: Buffer.from('<svg/>').toString('base64') })).status, 400);
  const url2 = (await (await call('POST', '/api/auth/me/avatar', w, { image: photo.toString('base64') })).json()).user.avatarUrl;
  assert.notEqual(url2, url1);
  assert.equal((await call('GET', url1)).status, 404);

  // The public post carries the author's name, job title and photo.
  const post = await createPost('usr_writer2', { title: 'Profile post' });
  assert.equal((await call('POST', `${ADMIN}/posts/${post.id}/publish`, await as('usr_editor'), {})).status, 200);
  const pub = (await (await call('GET', `/api/blog/en/${post.slug}`)).json()).data;
  assert.deepEqual(pub.author, { name: 'Writer Two', jobTitle: 'Content lead', avatarUrl: url2 });

  // Removing the photo stops serving it.
  const del = await call('DELETE', '/api/auth/me/avatar', w);
  assert.equal((await del.json()).user.avatarUrl, null);
  assert.equal((await call('GET', url2)).status, 404);
});
