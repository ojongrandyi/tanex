// Path routing (tracker D.1, I18N_SPEC §2): the route table, link building, legacy hash links,
// and which paths the server answers with the app (200), a redirect (301) or a 404.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { ROUTES, buildPath, legacyHashToPath, matchPath, pagePath } from '../src/router/routes.ts';
import { publicPages } from '../server/publicPages.ts';
import { quoteUrl } from '../server/mail/urls.ts';

test('every live route round-trips through buildPath and matchPath, in both languages', () => {
  for (const route of ROUTES) {
    for (const lang of ['en', 'fr'] as const) {
      const base = buildPath(route.id, undefined, lang);
      const m = matchPath(base);
      if (route.live === false) {
        assert.equal(m, null, `${base} is reserved, not live`);
        continue;
      }
      assert.deepEqual(m && { id: m.id, lang: m.lang, canonical: m.canonical }, { id: route.id, lang, canonical: base });
      if (route.param) {
        const withParam = buildPath(route.id, 'TX7K2M9P-01', lang);
        assert.equal(matchPath(withParam)?.param, 'TX7K2M9P-01');
      }
    }
  }
});

test('URL scheme matches I18N_SPEC §2', () => {
  assert.equal(pagePath('home'), '/');
  assert.equal(pagePath('home', undefined, 'fr'), '/fr/');
  assert.equal(pagePath('track-result', 'TX7K2M9P'), '/track/TX7K2M9P');
  assert.equal(pagePath('track-result', 'TX7K2M9P', 'fr'), '/fr/suivi/TX7K2M9P');
  assert.equal(pagePath('quote-result', 'QR-2026-00001'), '/quote/QR-2026-00001');
  assert.equal(pagePath('quote-result', 'QR-2026-00001', 'fr'), '/fr/devis/QR-2026-00001');
  assert.equal(pagePath('services', 'air'), '/services/air');
  assert.equal(pagePath('legal', 'privacy', 'fr'), '/fr/mentions-legales/privacy');
  assert.equal(pagePath('locations', undefined, 'fr'), '/fr/reseau');
  assert.equal(pagePath('ship', undefined, 'fr'), '/fr/expedier');
  // A quote's preselected service and a contact gateway code are page state, not URL.
  assert.equal(pagePath('quote', 'Priority'), '/quote');
  assert.equal(pagePath('contact', 'DLA'), '/contact');
  assert.equal(pagePath('no-such-page'), '/');
  // Parameters are encoded on the way out and decoded on the way in.
  assert.equal(pagePath('track-result', 'a b'), '/track/a%20b');
});

test('matchPath: canonical forms, trailing slashes and unknown paths', () => {
  assert.equal(matchPath('/services/')?.canonical, '/services');
  assert.equal(matchPath('/fr')?.canonical, '/fr/');
  assert.equal(matchPath('/index.html')?.canonical, '/');
  assert.equal(matchPath('/track/TX7K2M9P/')?.canonical, '/track/TX7K2M9P');
  assert.equal(matchPath('/fr/suivi/TX7K2M9P')?.id, 'track');
  for (const p of ['/nope', '/track/a/b', '/admin', '/private-user/', '/Services', '/track/%E0%A4%A', '/track/<x>', '/blog', '/blog/post', '/local-delivery', '/fr/livraison-locale']) {
    assert.equal(matchPath(p), null, p);
  }
});

test('legacy hash links convert to paths', () => {
  assert.equal(legacyHashToPath('#/'), '/');
  assert.equal(legacyHashToPath('#/services'), '/services');
  assert.equal(legacyHashToPath('#/services/air'), '/services/air');
  assert.equal(legacyHashToPath('#/track'), '/track');
  assert.equal(legacyHashToPath('#/track/TX7K2M9P'), '/track/TX7K2M9P');
  assert.equal(legacyHashToPath('#/quote/QR-2026-00001'), '/quote/QR-2026-00001');
  assert.equal(legacyHashToPath('#/legal/shipping-terms'), '/legal/shipping-terms');
  assert.equal(legacyHashToPath('#/locations'), '/locations');
  assert.equal(legacyHashToPath('#/whatever'), '/');
  assert.equal(legacyHashToPath('#/admin'), null);
  assert.equal(legacyHashToPath('#reset=abc'), null);
  assert.equal(legacyHashToPath(''), null);
});

test('quote emails link to the path URL', () => {
  delete process.env.APP_URL;
  assert.match(quoteUrl('QR-2026-00001'), /^https:\/\/[^/]+\/quote\/QR-2026-00001$/);
});

// Server: the same index.html for every known page, 301 for non-canonical spellings, 404 otherwise.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tanex-router-test-'));
const indexPath = path.join(tmpDir, 'index.html');
fs.writeFileSync(indexPath, '<!doctype html><title>app</title>');
const app = express();
app.use(publicPages(indexPath));
app.use((req, res) => res.status(404).send('Not found'));
const server = app.listen(0);
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
after(() => {
  server.closeAllConnections();
  server.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('server: known public paths answer 200 with the app', async () => {
  for (const p of ['/', '/services', '/services/air', '/track', '/track/TX7K2M9P', '/quote', '/quote/QR-2026-00001',
    '/ship', '/about', '/contact', '/help', '/locations', '/legal', '/legal/privacy', '/fr/', '/fr/suivi/TX7K2M9P', '/fr/a-propos']) {
    const res = await fetch(base + p, { redirect: 'manual' });
    assert.equal(res.status, 200, p);
    assert.equal(res.headers.get('cache-control'), 'no-cache', p);
    assert.match(await res.text(), /<title>app<\/title>/, p);
  }
});

test('server: non-canonical spellings redirect, query kept', async () => {
  for (const [from, to] of [['/services/', '/services'], ['/fr', '/fr/'], ['/track/TX7K2M9P/?a=1', '/track/TX7K2M9P?a=1']]) {
    const res = await fetch(base + from, { redirect: 'manual' });
    assert.equal(res.status, 301, from);
    assert.equal(res.headers.get('location'), to, from);
  }
});

test('server: unknown and not-yet-live paths are 404; non-GET passes through', async () => {
  for (const p of ['/nope', '/track/a/b', '/blog', '/blog/hello', '/local-delivery', '/admin', '/Services']) {
    const res = await fetch(base + p, { redirect: 'manual' });
    assert.equal(res.status, 404, p);
  }
  const post = await fetch(`${base}/services`, { method: 'POST' });
  assert.equal(post.status, 404);
});
