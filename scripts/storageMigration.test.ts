// Tests for the one-time ngf_ → tx_ browser storage key move (tracker I.3). Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { LEGACY_STORAGE_KEYS, migrateLegacyStorageKeys } from '../src/utils/storageMigration.ts';

function memoryStore(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return {
    map: m,
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
  };
}

test('storage migration: old keys move to tx_ once and are removed', () => {
  const s = memoryStore({ ngf_recent_tracking: '["TX7K2M9P"]', ngf_units: 'imperial', other: 'kept' });
  assert.equal(migrateLegacyStorageKeys(s), 2);
  assert.equal(s.getItem('tx_recent_tracking'), '["TX7K2M9P"]');
  assert.equal(s.getItem('tx_units'), 'imperial');
  assert.equal(s.getItem('ngf_recent_tracking'), null);
  assert.equal(s.getItem('ngf_units'), null);
  assert.equal(s.getItem('other'), 'kept');
  assert.equal(migrateLegacyStorageKeys(s), 0, 'second run does nothing');
});

test('storage migration: a value already under the new name wins', () => {
  const s = memoryStore({ ngf_units: 'imperial', tx_units: 'metric' });
  assert.equal(migrateLegacyStorageKeys(s), 0);
  assert.equal(s.getItem('tx_units'), 'metric');
  assert.equal(s.getItem('ngf_units'), null);
});

test('storage migration: blocked storage never throws', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
  assert.equal(migrateLegacyStorageKeys(broken), 0);
  assert.equal(migrateLegacyStorageKeys(null), 0);
});

test('no ngf names left in the app source', () => {
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(css|tsx?)$/.test(e.name) && !p.endsWith('storageMigration.ts') && /ngf[-_]/.test(fs.readFileSync(p, 'utf8'))) hits.push(p);
    }
  };
  walk(path.join(import.meta.dirname, '..', 'src'));
  assert.deepEqual(hits, []);
  for (const [from, to] of LEGACY_STORAGE_KEYS) assert.equal(to, from.replace(/^ngf_/, 'tx_'));
});
