// Tests for the admin console path match (tracker L.5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_PATH, ADMIN_URL, SITE_URL, isAdminPathname } from '../src/config/brand.ts';

test('ADMIN_PATH and ADMIN_URL', () => {
  assert.equal(ADMIN_PATH, '/private-user/');
  assert.equal(ADMIN_URL, `${SITE_URL}/private-user/`);
});

test('isAdminPathname: the exact path, trailing slash and case ignored', () => {
  for (const p of ['/private-user', '/private-user/', '/Private-User/', '/PRIVATE-USER', '/private-user//']) {
    assert.equal(isAdminPathname(p), true, p);
  }
});

test('isAdminPathname: look-alikes and other paths do not match', () => {
  for (const p of ['/', '', '/admin', '/private-user-x', '/private-users', '/private-user/x', '/x/private-user', '/private', '/private-use']) {
    assert.equal(isAdminPathname(p), false, p);
  }
});
