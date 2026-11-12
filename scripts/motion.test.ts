// Inner-page motion's pure parts (MOTION_3D_SPEC §9, H.7): the marker glide between polls and
// the progress bike's scroll maths.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { easeInOutCubic, glide, glideAt, GLIDE_MS, HERO_PARALLAX_PX, isLongPage, parallaxAt, scrollProgress } from '../src/motion/glide.ts';

test('marker glide lasts 1 s, starts and ends exactly, never overshoots', () => {
  assert.equal(GLIDE_MS, 1000);
  assert.equal(glideAt(20, 35, 0), 20);
  assert.equal(glideAt(20, 35, GLIDE_MS), 35);
  assert.equal(glideAt(20, 35, GLIDE_MS * 3), 35);
  assert.equal(glideAt(20, 35, 500), 27.5);
  let prev = -Infinity;
  for (let ms = 0; ms <= GLIDE_MS; ms += 50) {
    const v = glideAt(20, 35, ms);
    assert.ok(v >= prev && v >= 20 && v <= 35, `monotonic within range at ${ms} ms`);
    prev = v;
  }
  assert.equal(easeInOutCubic(-1), 0);
  assert.equal(easeInOutCubic(2), 1);
});

test('marker glide jumps straight to the target when motion is unavailable', () => {
  const seen: number[] = [];
  const cancel = glide(10, 60, (v) => seen.push(v));
  assert.deepEqual(seen, [60]);
  cancel();
});

test('progress bike: page progress and the long-page rule', () => {
  assert.equal(scrollProgress(0, 4000, 800), 0);
  assert.equal(scrollProgress(1600, 4000, 800), 0.5);
  assert.equal(scrollProgress(5000, 4000, 800), 1);
  assert.equal(scrollProgress(100, 700, 800), 0, 'a page that cannot scroll');
  assert.equal(isLongPage(2399, 800), false);
  assert.equal(isLongPage(2400, 800), true);
  assert.equal(isLongPage(1000, 0), false);
});

test('hero parallax stays within 40 px and follows the scroll position', () => {
  assert.ok(HERO_PARALLAX_PX <= 40);
  assert.equal(parallaxAt(0, 600), 0);
  assert.equal(parallaxAt(300, 600), HERO_PARALLAX_PX / 2);
  assert.equal(parallaxAt(5000, 600), HERO_PARALLAX_PX);
  assert.equal(parallaxAt(-50, 600), 0);
  assert.equal(parallaxAt(100, 0), 0);
});
