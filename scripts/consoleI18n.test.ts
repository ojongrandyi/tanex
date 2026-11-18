// Console languages (tracker I.2): the French console text has exactly the English keys, every
// function takes the same arguments and returns text, and switching the language switches what
// every text object (and its nested sections) returns. Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import fr from '../src/i18n/fr/console/index.ts';
import { AUTH_TEXT, AUTH_TEXT_EN, IAM_TEXT_EN, MAIL_TEXT_EN } from '../src/auth/strings.ts';
import { loadConsoleLang, setConsoleLang, consoleLang } from '../src/admin/i18n/consoleText.ts';

const SRC = path.join(import.meta.dirname, '..', 'src');

/** area -> English master, read from the modules the console uses. */
async function englishAreas(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { auth: AUTH_TEXT_EN, iam: IAM_TEXT_EN, mail: MAIL_TEXT_EN };
  const files = [
    'admin/blog/menuText.ts', 'admin/dispatch/menuText.ts', 'admin/cash/strings.ts', 'admin/blog/strings.ts',
    'admin/dispatch/strings.ts', 'admin/dispatch/boardStrings.ts',
  ];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.text.ts')) files.push(path.relative(SRC, p).split(path.sep).join('/'));
    }
  };
  walk(path.join(SRC, 'admin'));
  for (const rel of files) {
    const text = fs.readFileSync(path.join(SRC, rel), 'utf8');
    const mod = await import(`../src/${rel}`);
    for (const m of text.matchAll(/export const (\w+_EN) = [\s\S]*?consoleText\('(\w+)', \1\)/g)) out[m[2]] = mod[m[1]];
  }
  return out;
}

function compare(en: unknown, frv: unknown, where: string, problems: string[]) {
  if (typeof en === 'function') {
    if (typeof frv !== 'function') return void problems.push(`${where}: not a function`);
    if (frv.length !== en.length) problems.push(`${where}: ${frv.length} parameters, English has ${en.length}`);
    const args = Array.from({ length: en.length }, (_, i) => (i === 0 ? 2 : 'x'));
    if (typeof frv(...args) !== 'string') problems.push(`${where}: does not return text`);
    return;
  }
  if (typeof en === 'string') {
    if (typeof frv !== 'string' || !frv.trim()) problems.push(`${where}: missing or empty`);
    else for (const v of en.match(/\{\w+\}/g) ?? []) if (!frv.includes(v)) problems.push(`${where}: lost ${v}`);
    return;
  }
  if (en && typeof en === 'object') {
    if (!frv || typeof frv !== 'object') return void problems.push(`${where}: missing section`);
    const a = Object.keys(en).sort(); const b = Object.keys(frv).sort();
    for (const k of a) if (!b.includes(k)) problems.push(`${where}.${k}: missing in French`);
    for (const k of b) if (!a.includes(k)) problems.push(`${where}.${k}: not in English`);
    for (const k of a) if (b.includes(k)) compare((en as Record<string, unknown>)[k], (frv as Record<string, unknown>)[k], `${where}.${k}`, problems);
  }
}

test('console French: same areas, keys, placeholders and function arguments as English', async () => {
  const en = await englishAreas();
  assert.deepEqual(Object.keys(fr).sort(), Object.keys(en).sort(), 'areas');
  const problems: string[] = [];
  for (const area of Object.keys(en)) compare(en[area], (fr as Record<string, unknown>)[area], area, problems);
  assert.deepEqual(problems, []);
});

test('console language: text objects and nested sections follow the active language', async () => {
  const login = AUTH_TEXT.login; // a module-level alias, as the views use
  assert.equal(consoleLang(), 'en');
  assert.equal(login.submit, 'Sign in');
  await loadConsoleLang('fr');
  setConsoleLang('fr');
  try {
    assert.equal(login.submit, 'Se connecter');
    assert.equal(AUTH_TEXT.account.sessions.signedOut(2), 'Déconnecté sur 2 autres appareils.');
    assert.deepEqual(Object.keys(AUTH_TEXT.login).sort(), Object.keys(AUTH_TEXT_EN.login).sort());
    assert.equal(AUTH_TEXT.login, login, 'a section is the same object across reads');
  } finally {
    setConsoleLang('en');
  }
  assert.equal(login.submit, 'Sign in');
});
