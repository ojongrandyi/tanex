// i18n foundation (tracker D.3, I18N_SPEC §5, §7): dictionary parity and no English left in
// French by mistake, formatting, the language switch's path mapping, bilingual shared statuses,
// keyed tracking-event titles (stored and served), and stable API error codes.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

import enCommon from '../src/i18n/en/common.ts';
import frCommon from '../src/i18n/fr/common.ts';
import enNotFound from '../src/i18n/en/notFound.ts';
import frNotFound from '../src/i18n/fr/notFound.ts';
import enHome from '../src/i18n/en/home.ts';
import frHome from '../src/i18n/fr/home.ts';
import enServices from '../src/i18n/en/services.ts';
import frServices from '../src/i18n/fr/services.ts';
import enAbout from '../src/i18n/en/about.ts';
import frAbout from '../src/i18n/fr/about.ts';
import enNetwork from '../src/i18n/en/network.ts';
import frNetwork from '../src/i18n/fr/network.ts';
import enHelp from '../src/i18n/en/help.ts';
import frHelp from '../src/i18n/fr/help.ts';
import enContact from '../src/i18n/en/contact.ts';
import frContact from '../src/i18n/fr/contact.ts';
import enLegal from '../src/i18n/en/legal.ts';
import frLegal from '../src/i18n/fr/legal.ts';
import enTrack from '../src/i18n/en/track.ts';
import frTrack from '../src/i18n/fr/track.ts';
import enTrackResult from '../src/i18n/en/trackResult.ts';
import frTrackResult from '../src/i18n/fr/trackResult.ts';
import enQuote from '../src/i18n/en/quote.ts';
import frQuote from '../src/i18n/fr/quote.ts';
import enShip from '../src/i18n/en/ship.ts';
import frShip from '../src/i18n/fr/ship.ts';
import enPayment from '../src/i18n/en/payment.ts';
import frPayment from '../src/i18n/fr/payment.ts';
import enBlog from '../src/i18n/en/blog.ts';
import frBlog from '../src/i18n/fr/blog.ts';
import enCompany from '../src/i18n/en/company.ts';
import frCompany from '../src/i18n/fr/company.ts';
import { PAYMENT_TERMS_FR, paymentTerm } from '../src/i18n/paymentTerms.ts';
import { PAYMENT_METHODS } from '../src/shared/paymentMethods.ts';
import { legalDocs } from '../src/data/legalDocs.ts';
import { HELP_ARTICLES } from '../src/data/helpArticles.ts';
import { translate } from '../src/i18n/runtime.ts';
import { formatClock, formatDistanceKm, formatMoney, formatOpeningHoursIn, frenchSpacing } from '../src/i18n/format.ts';
import { alternatePath, langOfPath } from '../src/router/routes.ts';
import { SHIPMENT_STATUS_OPTIONS, shipmentStatusLabel } from '../src/shared/shipmentStatus.ts';
import { PAYMENT_STATUS_LABELS } from '../src/shared/paymentRequest.ts';
import { EVENT_TITLES, eventTitleColumns, eventTitleText, renderEventTitle } from '../src/shared/eventTitles.ts';
import { PUBLIC_ERROR_CODES, generalErrorCode } from '../src/shared/apiErrors.ts';

const NBSP = ' ';
const NNBSP = ' ';

type Tree = { [k: string]: string | Tree };

function leaves(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.set(key, v);
    else for (const [kk, vv] of leaves(v, key)) out.set(kk, vv);
  }
  return out;
}

// French values allowed to equal the English ones: brand terms, codes and words that are the
// same in both languages. Anything else identical is an untranslated string.
const SAME_IN_BOTH: Record<string, string> = {
  'common:header.blog': 'same word in French',
  'common:header.menu': 'same word in French',
  'common:footer.links.blog': 'same word in French',
  'blog:eyebrow': 'same word in French',
  'company:careers.values.service.title': 'same word in French',
  'common:header.cities': 'place names',
  'common:language.en': 'language code',
  'common:language.fr': 'language code',
  'common:language.enName': 'each language is named in itself',
  'common:language.frName': 'each language is named in itself',
  'common:footer.columns.services': 'same word in French',
  'common:footer.links.contact': 'same word in French',
  'events:event.status': 'variable only ({status} is translated by name)',
  'home:bike.priceAmount': 'variable only (the amount is formatted per language)',
  'home:labels.demo.originValue': 'airport code and place name',
  'home:labels.demo.destination': 'same word in French',
  'home:labels.demo.destinationValue': 'airport code and place name',
  'home:labels.demo.service': 'same word in French',
  'home:contact.whatsapp': 'brand name',
  'home:contact.form.message': 'same word in French',
  'home:rail.chapters.services': 'same word in French',
  'home:rail.chapters.contact': 'same word in French',
  'services:eyebrows.services': 'same word in French',
  'services:compare.service': 'same word in French',
  'services:items.rail.h4': 'intentionally empty: rail has three highlights',
  'services:items.road.h4': 'intentionally empty: road has three highlights',
  'about:hero.slogan': 'variable only (the slogan stays in English, #102)',
  'about:offices.douala': 'place name',
  'network:gateways.regions.Europe': 'same word in French',
  'network:gateways.modesLabel': 'same word in French',
  'contact:channels.whatsapp': 'brand name',
  'contact:offices.douala': 'place name',
  'contact:form.message': 'same word in French',
  'track:batch.count': 'variables only',
  'track:batch.delayedOrHeld': 'variables only',
  'track:batch.destination': 'same word in French',
  'track:support.message': 'same word in French',
  'trackResult:metrics.service': 'same word in French',
  'trackResult:metrics.distance': 'same word in French',
  'trackResult:summary.service': 'same word in French',
  'trackResult:corridor.destination': 'same word in French',
  'trackResult:map.destination': 'same word in French',
  'trackResult:map.layerSatellite': 'same word in French',
  'trackResult:container.terminal': 'same word in French',
  'trackResult:document.signature': 'same word in French',
  'trackResult:details.destination': 'same word in French',
  'trackResult:details.service': 'same word in French',
  'trackResult:details.dimensions': 'same word in French',
  'quote:form.province': 'same word in French',
  'quote:form.service': 'same word in French',
  'quote:form.serviceLabel': 'same word in French',
  'quote:done.service': 'same word in French',
  'quote:result.total': 'same word in French',
  'quote:result.totalLabel': 'same word in French',
  'quote:result.transport': 'same word in French',
  'quote:result.transportRoute': 'same word in French',
  'quote:result.service': 'same word in French',
  'quote:result.dimensionsShort': 'same word in French',
  'ship:fields.province': 'same word in French',
  'ship:fields.serviceGroup': 'same word in French',
  'ship:summary.service': 'same word in French',
};

const PAIRS: [string, Tree, Tree][] = [
  ['common', enCommon as unknown as Tree, frCommon as unknown as Tree],
  ['notFound', enNotFound as unknown as Tree, frNotFound as unknown as Tree],
  ['home', enHome as unknown as Tree, frHome as unknown as Tree],
  ['services', enServices as unknown as Tree, frServices as unknown as Tree],
  ['about', enAbout as unknown as Tree, frAbout as unknown as Tree],
  ['network', enNetwork as unknown as Tree, frNetwork as unknown as Tree],
  ['help', enHelp as unknown as Tree, frHelp as unknown as Tree],
  ['contact', enContact as unknown as Tree, frContact as unknown as Tree],
  ['legal', enLegal as unknown as Tree, frLegal as unknown as Tree],
  ['track', enTrack as unknown as Tree, frTrack as unknown as Tree],
  ['trackResult', enTrackResult as unknown as Tree, frTrackResult as unknown as Tree],
  ['quote', enQuote as unknown as Tree, frQuote as unknown as Tree],
  ['ship', enShip as unknown as Tree, frShip as unknown as Tree],
  ['payment', enPayment as unknown as Tree, frPayment as unknown as Tree],
  ['blog', enBlog as unknown as Tree, frBlog as unknown as Tree],
  ['company', enCompany as unknown as Tree, frCompany as unknown as Tree],
];

test('fr dictionaries have exactly the English keys', () => {
  for (const [area, en, fr] of PAIRS) {
    assert.deepEqual([...leaves(fr).keys()].sort(), [...leaves(en).keys()].sort(), area);
  }
});

test('no French string is an English copy, except the allow-list', () => {
  const copies: string[] = [];
  for (const [area, en, fr] of PAIRS) {
    const frLeaves = leaves(fr);
    for (const [key, value] of leaves(en)) {
      if (frLeaves.get(key) === value && !SAME_IN_BOTH[`${area}:${key}`]) copies.push(`${area}:${key} = "${value}"`);
    }
  }
  for (const [key, t] of Object.entries(EVENT_TITLES)) {
    if (t.en === t.fr && !SAME_IN_BOTH[`events:${key}`]) copies.push(`events:${key}`);
  }
  for (const s of SHIPMENT_STATUS_OPTIONS) if (s.labels.en === s.labels.fr) copies.push(`status:${s.value}`);
  for (const [code, l] of Object.entries(PAYMENT_STATUS_LABELS)) if (l.en === l.fr) copies.push(`payment:${code}`);
  assert.deepEqual(copies, []);
  // The allow-list holds no stale entries.
  for (const entry of Object.keys(SAME_IN_BOTH)) {
    const [area, key] = entry.split(':');
    if (area === 'events') continue;
    const pair = PAIRS.find(([a]) => a === area)!;
    assert.equal(leaves(pair[1]).get(key), leaves(pair[2]).get(key), `allow-listed ${entry} is no longer identical`);
  }
});

test('every public API error code has a text in both languages', () => {
  for (const code of PUBLIC_ERROR_CODES) {
    assert.ok(enCommon.errors[code], `en ${code}`);
    assert.ok(frCommon.errors[code], `fr ${code}`);
  }
  assert.equal(generalErrorCode(404), 'NOT_FOUND');
  assert.equal(generalErrorCode(422), 'BAD_REQUEST');
  assert.equal(generalErrorCode(502), 'SERVER_ERROR');
});

test('t(): variables and French typography', () => {
  assert.equal(translate(enCommon as any, 'footer.copyright', 'en', { year: 2026, legalName: 'Tanex SARL' }), '© 2026 Tanex SARL. All rights reserved.');
  assert.equal(translate(frCommon as any, 'header.needHelp', 'fr'), `Besoin d'aide${NNBSP}?`);
  assert.equal(translate(frCommon as any, 'header.open', 'fr', { hours: 'de 9 h' }), 'Ouvert de 9 h');
  assert.equal(translate(enCommon as any, 'header.nope', 'en'), 'header.nope');
  assert.equal(frenchSpacing('« Bonjour » : oui ; non ! quoi ?'), `«${NBSP}Bonjour${NBSP}»${NBSP}: oui${NNBSP}; non${NNBSP}! quoi${NNBSP}?`);
  assert.equal(frenchSpacing('https://tanexsarl.com/fr/ 16:00'), 'https://tanexsarl.com/fr/ 16:00');
});

test('format: XAF without decimals, French grouping, clocks, distances', () => {
  assert.equal(formatMoney(1500, 'XAF', 'en'), `1,500${NBSP}FCFA`);
  assert.equal(formatMoney(1500.6, 'XAF', 'fr'), `1${NNBSP}501${NBSP}FCFA`);
  assert.match(formatMoney(350, 'USD', 'en'), /350\.00/);
  assert.match(formatMoney(350, 'EUR', 'fr'), /350,00/);
  assert.equal(formatClock('16:00', 'fr'), `16${NBSP}h${NBSP}00`);
  assert.equal(formatClock('09:00', 'en'), `9:00${NBSP}AM`);
  assert.equal(formatOpeningHoursIn('fr'), `24${NBSP}h/24, 7${NBSP}j/7`);
  assert.equal(formatOpeningHoursIn('en'), '24/7');
  assert.equal(formatOpeningHoursIn('fr', { opens: '09:00', closes: '16:00' }), `de 9${NBSP}h${NBSP}00 à 16${NBSP}h${NBSP}00`);
  assert.equal(formatOpeningHoursIn('en', { opens: '09:00', closes: '16:00' }), `9:00${NBSP}AM – 4:00${NBSP}PM`);
  assert.equal(formatDistanceKm(2.5, 'fr'), `2,5${NBSP}km`);
});

test('language switch maps the current page to the other language', () => {
  assert.equal(alternatePath('/', 'fr'), '/fr/');
  assert.equal(alternatePath('/fr/', 'en'), '/');
  assert.equal(alternatePath('/track/TX7K2M9P', 'fr'), '/fr/suivi/TX7K2M9P');
  assert.equal(alternatePath('/fr/mentions-legales/cookies', 'en'), '/legal/cookies');
  assert.equal(alternatePath('/services/air', 'fr'), '/fr/services/air');
  assert.equal(alternatePath('/no-such-page', 'fr'), '/fr/');
  assert.equal(langOfPath('/fr/nope'), 'fr');
  assert.equal(langOfPath('/fr'), 'fr');
  assert.equal(langOfPath('/france'), 'en');
  assert.equal(langOfPath('/private-user/'), 'en');
});

test('shared statuses and event titles are bilingual', () => {
  assert.equal(shipmentStatusLabel('OUT_FOR_DELIVERY'), 'Out for delivery');
  assert.equal(shipmentStatusLabel('OUT_FOR_DELIVERY', 'fr'), 'En cours de livraison');
  assert.equal(shipmentStatusLabel('EXCEPTION', 'fr'), 'En attente');
  assert.equal(shipmentStatusLabel('cancelled', 'fr'), 'Annulé');
  const cols = eventTitleColumns('event.returning', { reason: 'Refused' });
  assert.deepEqual(cols, { title: 'Returning to sender: Refused', titleKey: 'event.returning', titleVarsJson: '{"reason":"Refused"}' });
  assert.equal(renderEventTitle('event.returning', { reason: 'Refused' }, 'fr'), `Retour à l'expéditeur${NBSP}: Refused`);
  assert.equal(renderEventTitle('event.status', { status: 'DELIVERED' }, 'fr'), 'Livré');
  assert.equal(eventTitleColumns('event.payment_confirmed').titleVarsJson, null);
  // Staff-typed and older rows show their stored text in every language.
  assert.equal(eventTitleText({ title: 'Scanned at Kotto' }, 'fr'), 'Scanned at Kotto');
  assert.equal(eventTitleText({ title: 'x', titleKey: 'nope' }, 'fr'), 'x');
  assert.equal(eventTitleText({ title: 'Payment confirmed', titleKey: 'event.payment_confirmed' }, 'en'), 'Payment confirmed');
  assert.equal(eventTitleText({ title: 'Payment confirmed', titleKey: 'event.payment_confirmed' }, 'fr'), 'Paiement confirmé');
});

// ---- Server: stored keys and error codes ----

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tanex-i18n-test-'));
process.env.DB_PATH = path.join(tmpDir, 'tanex.db');
process.env.UPLOADS_DIR = path.join(tmpDir, 'uploads');
delete process.env.NODE_ENV;
delete process.env.SMTP_HOST;

const express = (await import('express')).default;
const { db, initDatabase } = await import('../server/db.ts');
const { requireJsonOrMultipart } = await import('../server/middleware/auth.ts');
const { registerApiRoutes } = await import('../server/apiRoutes.ts');
const { addErrorCodes } = await import('../server/middleware/errorCodes.ts');
const { SqliteSessionStore, createSessionMiddleware } = await import('../server/auth/sessionStore.ts');

initDatabase();

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(createSessionMiddleware(new SqliteSessionStore(db, { purgeIntervalMs: false }), 'test-secret'));
app.use('/api', requireJsonOrMultipart);
// A route with no code of its own, to check the general code is filled in.
app.get('/api/__conflict', addErrorCodes, (_req, res) => { res.status(409).json({ success: false, error: 'Busy.' }); });
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

let ip = 0;
const call = (method: string, p: string, body?: unknown) => fetch(BASE + p, {
  method,
  headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `203.0.113.${(ip++ % 250) + 1}` },
  body: body === undefined ? undefined : JSON.stringify(body),
});

test('tracking_events has the nullable title_key and title_vars_json columns', () => {
  const cols = (db.prepare('PRAGMA table_info(tracking_events)').all() as { name: string; notnull: number }[]);
  for (const name of ['title_key', 'title_vars_json']) {
    const col = cols.find((c) => c.name === name);
    assert.ok(col, name);
    assert.equal(col!.notnull, 0);
  }
});

test('a server-written event stores its key and the public track answer carries it', async () => {
  const res = await call('POST', '/api/shipments', { origin: { city: 'Buea' }, destination: { city: 'Douala' } });
  assert.equal(res.status, 201);
  const tracking = (await res.json()).data.trackingNumber;
  const row = db.prepare('SELECT title, title_key, title_vars_json FROM tracking_events WHERE shipment_tracking = ?').get(tracking) as any;
  assert.equal(row.title, 'Consignment Registered & Barcode Issued');
  assert.equal(row.title_key, 'event.registered');
  assert.equal(row.title_vars_json, null);

  const track = await (await call('GET', `/api/track/${tracking}`)).json();
  const first = track.data.events.find((e: any) => e.titleKey === 'event.registered');
  assert.ok(first, 'keyed event in the public answer');
  assert.equal(eventTitleText(first, 'fr'), 'Envoi enregistré et code-barres attribué');

  // A row stored before the key existed shows its stored text.
  db.prepare('UPDATE tracking_events SET title_key = NULL WHERE shipment_tracking = ?').run(tracking);
  const old = await (await call('GET', `/api/track/${tracking}`)).json();
  assert.equal(old.data.events[0].titleKey, undefined);
  assert.equal(eventTitleText(old.data.events[0], 'fr'), 'Consignment Registered & Barcode Issued');
});

test('API errors carry stable codes', async () => {
  const expect = async (method: string, p: string, status: number, code: string, body?: unknown) => {
    const res = await call(method, p, body);
    assert.equal(res.status, status, p);
    const json = await res.json();
    assert.equal(json.code, code, p);
    assert.equal(typeof json.error, 'string', p);
  };
  await expect('GET', '/api/track/NOPE', 400, 'INVALID_TRACKING_ID');
  await expect('GET', '/api/track/TX7K2M9P', 404, 'SHIPMENT_NOT_FOUND');
  await expect('GET', '/api/quotes/QR-2026-00000', 404, 'QUOTE_NOT_FOUND');
  await expect('GET', '/api/users', 401, 'AUTH_REQUIRED');
  await expect('GET', '/api/no-such-route', 404, 'NOT_FOUND');
  await expect('POST', '/api/messages', 400, 'MISSING_FIELDS', {});
  await expect('GET', '/api/__conflict', 409, 'CONFLICT');
});

test('legal pages: the same policies and sections in English and French, no placeholders', () => {
  const contact = { email: 'info@example.test', address: 'Somewhere' };
  const en = legalDocs(contact, 'en');
  const fr = legalDocs(contact, 'fr');
  assert.deepEqual(fr.map((d) => d.id), en.map((d) => d.id));
  en.forEach((doc, i) => {
    assert.equal(fr[i].sections.length, doc.sections.length, doc.id);
    doc.sections.forEach((s, j) => assert.equal(fr[i].sections[j].body.length, s.body.length, `${doc.id} §${j + 1}`));
  });
  const all = JSON.stringify([en, fr]);
  assert.ok(!/\{\{|TODO|Nigeria/.test(all), 'no template placeholders or previous-deployment law references');
  assert.match(all, /2024\/017/);
  // The cookie policy names the real cookie and the public storage keys.
  for (const key of ['tx.sid', 'tx_locale', 'ngf_recent_tracking', 'ngf_units', 'ngf_live_shipment_stream']) assert.ok(all.includes(key), key);
});

test('help: every article has a question and an answer in both languages', () => {
  for (const a of HELP_ARTICLES) {
    for (const dict of [enHelp, frHelp]) {
      const entry = (dict.articles as Record<string, { q: string; a: string }>)[a.key];
      assert.ok(entry?.q && entry?.a, a.key);
    }
  }
});

test('payment registry: every customer-facing string has French (src/i18n/paymentTerms.ts)', () => {
  const missing: string[] = [];
  const dummy: Record<string, string> = { link: 'https://x', url: 'https://x', cashtag: '$x', username: '@x', email: 'a@b.c', network: 'TRC20' };
  for (const d of Object.values(PAYMENT_METHODS)) {
    const texts = [d.label, ...d.fields.map((f) => f.label), d.note ?? '', d.link?.(dummy)?.label ?? ''].filter(Boolean);
    for (const text of texts) if (PAYMENT_TERMS_FR[text] === undefined) missing.push(text);
    const warning = d.warning?.(dummy);
    if (warning) assert.notEqual(paymentTerm(warning, 'fr'), warning, warning);
  }
  assert.deepEqual(missing, []);
  assert.equal(paymentTerm('Cash on delivery', 'fr'), 'Paiement à la livraison');
  assert.equal(paymentTerm('Cash on delivery', 'en'), 'Cash on delivery');
});
