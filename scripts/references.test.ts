// Tests for reference numbers (BRAND_GUIDE §7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateReference, referenceFor, REFERENCE_PATTERN } from '../src/shared/references.ts';

test('generateReference: TX-SL/TKT/INV/CSH + 6 digits', () => {
  for (const [kind, prefix] of [['seal', 'TX-SL-'], ['ticket', 'TX-TKT-'], ['invoice', 'TX-INV-'], ['cash', 'TX-CSH-']] as const) {
    for (let i = 0; i < 500; i++) {
      const ref = generateReference(kind);
      assert.ok(ref.startsWith(prefix), ref);
      assert.match(ref, REFERENCE_PATTERN);
    }
  }
});

test('REFERENCE_PATTERN rejects other prefixes and lengths', () => {
  for (const bad of ['AB-TKT-123456', 'TX-TKT-12345', 'TX-TKT-1234567', 'TX-ABC-123456', 'tx-inv-123456', 'TX-CSH-12345A']) {
    assert.doesNotMatch(bad, REFERENCE_PATTERN, bad);
  }
});

test('referenceFor is stable per seed and well-formed', () => {
  assert.equal(referenceFor('invoice', 'INV-2026-48213'), referenceFor('invoice', 'INV-2026-48213'));
  assert.notEqual(referenceFor('invoice', 'INV-2026-48213'), referenceFor('invoice', 'INV-2026-48214'));
  assert.match(referenceFor('invoice', 'x'), /^TX-INV-\d{6}$/);
  assert.match(referenceFor('cash', 'x'), /^TX-CSH-\d{6}$/);
});
