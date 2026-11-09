// Tests for brand facts and formatters in src/config/brand.ts (CLAUDE.md §2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPANY, LEGAL_NAME, SITE_URL, PHONE, PHONE_2, OFFICES, HQ_ADDRESS, SMARTSUPP_KEY,
  TRACKING_ID_EXAMPLE, formatPhone, formatOpeningHours,
} from '../src/config/brand.ts';
import { isValidTrackingId } from '../src/shared/trackingId.ts';

test('brand facts', () => {
  assert.equal(COMPANY, 'TanEx');
  assert.equal(LEGAL_NAME, 'Tanex SARL');
  assert.equal(SITE_URL, 'https://tanexsarl.com');
  assert.equal(OFFICES[0].address, HQ_ADDRESS);
  assert.equal(SMARTSUPP_KEY, '');
  assert.equal(TRACKING_ID_EXAMPLE, 'TX7K2M9P');
  assert.ok(isValidTrackingId(TRACKING_ID_EXAMPLE));
});

test('formatPhone groups Cameroon numbers as +237 XXX XX XX XX', () => {
  assert.equal(formatPhone(PHONE), '+237 651 05 93 45');
  assert.equal(formatPhone(PHONE_2), '+237 691 19 46 63');
  assert.equal(formatPhone('  00237 651-05-93-45 '), '+237 651 05 93 45');
  assert.equal(formatPhone('+237 651 05 93 45'), '+237 651 05 93 45');
});

test('formatPhone leaves other numbers as entered', () => {
  assert.equal(formatPhone(' +44 20 7946 0000 '), '+44 20 7946 0000');
  assert.equal(formatPhone('651059345'), '651059345');
  assert.equal(formatPhone(''), '');
});

test('formatOpeningHours', () => {
  assert.equal(formatOpeningHours(), '24/7');
  assert.equal(formatOpeningHours({ opens: '09:00', closes: '16:00' }), '9:00 AM – 4:00 PM');
  assert.equal(formatOpeningHours({ opens: '00:30', closes: '12:00' }), '12:30 AM – 12:00 PM');
});
