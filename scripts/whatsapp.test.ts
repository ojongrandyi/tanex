// WhatsApp links (docs/NOTIFICATIONS_SPEC.md §2, §6): phone normalisation, message templates,
// link encoding. Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWhatsAppLink,
  renderWhatsAppMessage,
  whatsAppDigits,
  WHATSAPP_SIGNATURE,
  WHATSAPP_TEMPLATES
} from '../src/shared/whatsapp.ts';

test('phone numbers: local Cameroon format, spaces, +237, invalid', () => {
  assert.equal(whatsAppDigits('651059345'), '237651059345');
  assert.equal(whatsAppDigits('6 51 05 93 45'), '237651059345');
  assert.equal(whatsAppDigits('+237 691 19 46 63'), '237691194663');
  assert.equal(whatsAppDigits('+44 20 7946 0958'), '442079460958');
  assert.equal(whatsAppDigits('12'), null);
  assert.equal(whatsAppDigits(''), null);
  assert.equal(whatsAppDigits(null), null);
});

test('temporary password message: EN and FR, signature, all placeholders filled', () => {
  const vars = { url: 'https://tanexsarl.com/private-user/', identifier: '+237670000001', password: 'k7mq-3xpa-9rtd' };
  const en = renderWhatsAppMessage('auth.temp_password', vars, 'en');
  assert.ok(en.startsWith('Your TanEx console account is ready. Sign in at https://tanexsarl.com/private-user/ with +237670000001'));
  assert.ok(en.includes('k7mq-3xpa-9rtd'));
  assert.ok(en.endsWith(`\n${WHATSAPP_SIGNATURE}`));
  assert.ok(!/\{\w+\}/.test(en));
  const fr = renderWhatsAppMessage('auth.temp_password', vars, 'fr');
  assert.ok(fr.startsWith('Votre compte TanEx est prêt.'));
  assert.ok(fr.includes('mot de passe temporaire : k7mq-3xpa-9rtd'));
  // A missing value never shows a raw placeholder.
  assert.ok(!/\{\w+\}/.test(renderWhatsAppMessage('local.assigned', {}, 'en')));
});

test('link: wa.me with the digits and an encoded message (accents, line breaks)', () => {
  const link = buildWhatsAppLink('670000001', 'local.failed', { id: 'TX7K2M9P', reason: 'adresse erronée' }, 'fr');
  assert.ok(link);
  const url = new URL(link!);
  assert.equal(url.origin, 'https://wa.me');
  assert.equal(url.pathname, '/237670000001');
  const text = url.searchParams.get('text')!;
  assert.equal(text, renderWhatsAppMessage('local.failed', { id: 'TX7K2M9P', reason: 'adresse erronée' }, 'fr'));
  assert.ok(text.includes('\n'));
  assert.ok(link!.includes('%0A'));
  assert.ok(!link!.includes(' '));
  assert.equal(buildWhatsAppLink('not a phone', 'auth.temp_password', {}, 'en'), null);
});

test('every template has EN and FR text', () => {
  for (const [key, t] of Object.entries(WHATSAPP_TEMPLATES)) {
    assert.ok(t.en.trim() && t.fr.trim(), key);
  }
});
