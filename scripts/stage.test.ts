// The 3D Stage's pure parts (MOTION_3D_SPEC §4–§6, H.2–H.3): the bike model file and the primitive fallback match the 3D brief's
// node names and triangle budget, the lane anchor and camera rail are continuous functions of
// scroll (reversible), and assets load in priority order.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Box3, Object3D, Vector3 } from 'three';
import { BIKE_NODES, buildPrimitiveBike, triangleCount } from '../src/motion/stage/bike.ts';
import { CAMERA_KEYS, CameraRail } from '../src/motion/stage/camera.ts';
import { laneAnchor } from '../src/motion/stage/lanes.ts';
import { BIKE_MODEL_URL, loadAssets, readyChapters, type StageAsset } from '../src/motion/stage/assets.ts';
import { distanceAt } from '../src/motion/stage/Stage.ts';
import { journeyEase } from '../src/motion/stage/ease.ts';
import { HERO_TIMELINE, heroDistance, heroPhase, ROLL_METRES } from '../src/motion/stage/chapters/hero.ts';
import { bandFrame, rideProgress } from '../src/motion/stage/chapters/services.ts';
import { ARC_HUBS, BUEA, buildGlobe, landIndices, latLonDir, latticePoint } from '../src/motion/stage/globe.ts';
import { CAMEROON_DOTS, DOT_COUNT } from '../src/motion/stage/globeDots.ts';

test('primitive bike: brief node names, hierarchy, scale, orientation and budget', () => {
  const bike = buildPrimitiveBike();
  assert.equal(bike.name, 'tanex_bike');
  for (const name of BIKE_NODES) assert.ok(bike.getObjectByName(name), name);
  const parentOf = (n: string) => bike.getObjectByName(n)?.parent?.name;
  assert.equal(parentOf('front_wheel'), 'handlebar');
  assert.equal(parentOf('phone_holder'), 'handlebar');
  assert.equal(parentOf('phone_screen'), 'phone_holder');
  assert.equal(parentOf('rear_wheel'), 'tanex_bike');
  assert.equal(parentOf('rider_torso'), 'rider');
  assert.equal(parentOf('box_lid'), 'top_box');
  assert.equal(parentOf('parcel_socket'), 'top_box');
  // Pivots at rest: no rotation, scale 1 (brief §5.3).
  for (const name of ['handlebar', 'front_wheel', 'rear_wheel', 'rider_torso', 'box_lid']) {
    const o = bike.getObjectByName(name) as Object3D;
    assert.ok(o.rotation.x === 0 && o.rotation.y === 0 && o.rotation.z === 0, `${name} rotation`);
    assert.ok(o.scale.equals(new Vector3(1, 1, 1)), `${name} scale`);
  }
  // Metres, on the ground, facing +Z: front axle ahead of the rear one, ≈ 1.95 m long.
  bike.updateMatrixWorld(true);
  const front = bike.getObjectByName('front_wheel')!.getWorldPosition(new Vector3());
  const rear = bike.getObjectByName('rear_wheel')!.getWorldPosition(new Vector3());
  assert.ok(front.z > rear.z, 'faces +Z');
  assert.ok(Math.abs(front.z - rear.z - 1.25) < 0.05, 'wheelbase ≈ 1.25 m');
  const box = new Box3().setFromObject(bike);
  assert.ok(box.min.y > -0.02 && box.min.y < 0.02, 'origin on the ground');
  const length = box.max.z - box.min.z;
  assert.ok(length > 1.7 && length < 2.2, `length ${length.toFixed(2)} m`);
  assert.equal(bike.getObjectByName('phone_screen') && (bike.getObjectByName('phone_screen') as unknown as { material: { name: string } }).material.name, 'screen');
  const tris = triangleCount(bike);
  assert.ok(tris <= 8000, `${tris} triangles`);
});

test('lane anchor: centred on the visible lane, glides between lanes, hides with none', () => {
  const view = { top: 72, bottom: 900 };
  const lane = { left: 800, top: 200, width: 500, height: 420 };
  const a = laneAnchor([lane], view);
  const near = (v: number, e: number) => Math.abs(v - e) < 1e-6;
  assert.ok(near(a.x, 1050) && near(a.y, 410) && near(a.weight, 1) && near(a.size, 500), JSON.stringify(a));
  assert.equal(laneAnchor([{ ...lane, top: 1200 }], view).weight, 0);
  assert.equal(laneAnchor([], view).weight, 0);
  // Scrolling one pixel at a time never jumps (continuity = no visible pops, reversible).
  const lanes = (scroll: number) => [
    { left: 800, top: 300 - scroll, width: 500, height: 420 },
    { left: 100, top: 1500 - scroll, width: 500, height: 420 },
  ];
  let prev = laneAnchor(lanes(0), view);
  for (let s = 1; s <= 1600; s++) {
    const next = laneAnchor(lanes(s), view);
    // Position must be smooth while the bike is visibly drawn; between distant lanes it fades out
    // (weight → 0) and may cross over quickly while nearly transparent.
    if (prev.weight > 0.25 && next.weight > 0.25) {
      assert.ok(Math.abs(next.x - prev.x) < 12 && Math.abs(next.y - prev.y) < 12, `jump at ${s}`);
    }
    assert.ok(Math.abs(next.weight - prev.weight) < 0.02, `weight jump at ${s}`);
    prev = next;
  }
});

test('camera rail: passes through every key and moves continuously', () => {
  const rail = new CameraRail();
  for (const k of CAMERA_KEYS) {
    const v = rail.sample(k.at);
    assert.ok(Math.abs(v.az - k.az) < 1e-6 && Math.abs(v.el - k.el) < 1e-6 && Math.abs(v.zoom - k.zoom) < 1e-6, `key ${k.at}`);
  }
  let prev = rail.sample(0);
  for (let t = 0.001; t <= 8; t += 0.001) {
    const v = rail.sample(t);
    assert.ok(Math.abs(v.az - prev.az) < 1.5 && Math.abs(v.el - prev.el) < 1 && Math.abs(v.zoom - prev.zoom) < 0.01, `step at ${t.toFixed(3)}`);
    prev = v;
  }
  assert.deepEqual(rail.sample(-1), rail.sample(0));
  assert.deepEqual(rail.sample(99), rail.sample(8));
});

test('wheel distance never runs backwards while scrolling down', () => {
  let prev = distanceAt(0);
  for (let t = 0.01; t <= 8.0001; t += 0.01) {
    const d = distanceAt(t);
    assert.ok(d >= prev - 1e-9);
    prev = d;
  }
  assert.equal(distanceAt(6.5), distanceAt(7.5), 'parked at Contact and FAQ');
});

test('assets load by priority; a chapter is ready only when all its assets are', async () => {
  const order: string[] = [];
  const asset = (id: string, priority: number, chapters: number[]): StageAsset => ({ id, priority, chapters, load: async () => new Object3D() });
  const list = [asset('truck', 2, [3]), asset('bike', 0, [0, 3]), asset('globe', 1, [0, 4])];
  await loadAssets((a) => order.push(a.id), undefined, list);
  assert.deepEqual(order, ['bike', 'globe', 'truck']);
  assert.deepEqual([...readyChapters(new Set(['bike']), list)].sort(), []);
  assert.deepEqual([...readyChapters(new Set(['bike', 'globe']), list)].sort(), [0, 4]);
  const controller = new AbortController();
  controller.abort();
  const none: string[] = [];
  await loadAssets((a) => none.push(a.id), controller.signal, list);
  assert.deepEqual(none, []);
});

test('bike model file: brief node names, screen material, web budget, meshopt only', () => {
  const file = fs.readFileSync(path.join('Public', BIKE_MODEL_URL));
  assert.ok(file.length <= 450 * 1024, `${Math.round(file.length / 1024)} KB`);
  assert.equal(file.readUInt32LE(0), 0x46546c67, 'binary glTF');
  const json = JSON.parse(file.subarray(20, 20 + file.readUInt32LE(12)).toString('utf8'));
  const names = (json.nodes as { name?: string }[]).map((n) => n.name);
  for (const name of BIKE_NODES) assert.ok(names.includes(name), name);
  assert.ok((json.materials as { name?: string }[]).some((m) => m.name === 'screen'), 'screen material');
  const supported = ['EXT_meshopt_compression', 'KHR_mesh_quantization'];
  for (const ext of json.extensionsRequired ?? []) assert.ok(supported.includes(ext), `required ${ext}`);
  assert.ok(!(json.extensionsUsed ?? []).includes('KHR_draco_mesh_compression'), 'no Draco');
  type Prim = { indices?: number };
  const tris = (json.meshes as { primitives: Prim[] }[]).flatMap((m) => m.primitives)
    .reduce((n, p) => n + (p.indices === undefined ? 0 : json.accessors[p.indices].count / 3), 0);
  assert.ok(tris <= 40000, `${tris} triangles`);
});

// ---- H.3: chapters 0–1 ----

test('lane anchor: shares say how much each lane is the bike\'s place', () => {
  const view = { top: 72, bottom: 900 };
  const a = laneAnchor([
    { left: 800, top: 200, width: 500, height: 420 },
    { left: 100, top: 2000, width: 500, height: 420 },
    { left: 100, top: 700, width: 1200, height: 180 },
  ], view);
  assert.equal(a.shares.length, 3);
  assert.equal(a.shares[1], 0, 'off-screen lane has no share');
  assert.ok(Math.abs(a.shares.reduce((s, v) => s + v, 0) - 1) < 1e-9, 'shares sum to 1');
  assert.ok(a.shares[0] > a.shares[2], 'the more visible, more central lane leads');
  assert.deepEqual(laneAnchor([], view).shares, []);
});

test('journey ease: CSS cubic-bezier(0.65, 0, 0.35, 1), monotonic and symmetric', () => {
  assert.equal(journeyEase(0), 0);
  assert.equal(journeyEase(1), 1);
  assert.ok(Math.abs(journeyEase(0.5) - 0.5) < 1e-4);
  let prev = 0;
  for (let t = 0.01; t <= 1.0001; t += 0.01) {
    const v = journeyEase(t);
    assert.ok(v >= prev - 1e-9, `monotonic at ${t}`);
    assert.ok(Math.abs(v + journeyEase(1 - t) - 1) < 1e-4, `symmetric at ${t}`);
    prev = v;
  }
});

test('hero: dive, opening and arrival are continuous and in order', () => {
  const T = HERO_TIMELINE;
  const at0 = heroPhase(0);
  assert.equal(at0.dive, 0);
  assert.equal(at0.hole, 0);
  assert.equal(at0.globe, 1);
  assert.equal(at0.door, 0);
  assert.equal(at0.bikeShown, false, 'the bike waits behind the globe');
  assert.equal(at0.clip, 1);
  const parked = heroPhase((T.roll[1] + T.depart[0]) / 2);
  assert.equal(parked.dive, 1);
  assert.equal(parked.globe, 0, 'globe gone once the bike is at the door');
  assert.ok(Math.abs(parked.bikeZ) < 1e-12, 'stopped at the door');
  assert.equal(parked.door, 1);
  assert.equal(heroPhase(1).door, 0, 'door left behind by Services');
  assert.ok(T.hole[0] < T.dive[1] && T.globeOut[1] <= T.clip[1], 'the opening starts during the dive; the clip opens after the globe');
  let prev = heroPhase(0);
  for (let t = 0.001; t <= 1.0001; t += 0.001) {
    const p = heroPhase(t);
    for (const key of ['dive', 'hole', 'globe', 'arcs', 'door', 'clip'] as const) {
      assert.ok(Math.abs(p[key] - prev[key]) < 0.02, `${key} jumps at ${t.toFixed(3)}`);
    }
    assert.ok(Math.abs(p.bikeZ - prev.bikeZ) < 0.02, `bike jumps at ${t.toFixed(3)}`);
    assert.ok(p.dive >= prev.dive && p.hole >= prev.hole, 'dive and opening only move forward with scroll');
    prev = p;
  }
  // The wheels turn exactly as far as the bike rolls in.
  assert.ok(Math.abs(heroDistance(T.roll[1]) - ROLL_METRES) < 1e-9);
  assert.equal(distanceAt((T.roll[1] + T.depart[0]) / 2), distanceAt(T.depart[0]), 'parked at the door');
});

test('services: the ride across the band follows the pinned story', () => {
  assert.equal(rideProgress(0, 0.9), 0);
  assert.equal(rideProgress(1, 0.1), 0, 'waits at the left during the arrive part');
  assert.equal(rideProgress(1, 0.5), 0.5);
  assert.equal(rideProgress(1, 0.9), 1);
  assert.equal(rideProgress(2, 0), 1);
  const band = { left: 40, top: 500, width: 1200, height: 180 };
  let prevLeft = -Infinity;
  for (let p = 0; p <= 1.0001; p += 0.01) {
    const f = bandFrame(band, Math.min(1, p));
    assert.ok(f.left >= band.left - 1e-9 && f.left + f.width <= band.left + band.width + 1e-9, 'inside the band');
    assert.equal(f.top, band.top);
    assert.ok(f.left >= prevLeft, 'left to right');
    prevLeft = f.left;
  }
  assert.equal(bandFrame({ ...band, width: 200 }, 0.7).width, 200, 'a narrow band is used whole');
});

test('globe dots: generated lattice, land share and Cameroon', () => {
  const file = fs.readFileSync(path.join('src', 'motion', 'stage', 'globeDots.ts'));
  assert.ok(file.length <= 25 * 1024, `${Math.round(file.length / 1024)} KB`);
  const land = landIndices();
  const share = land.length / DOT_COUNT;
  assert.ok(share > 0.25 && share < 0.33, `land share ${share.toFixed(3)}`);
  const isLand = new Set(land);
  assert.ok(CAMEROON_DOTS.length >= 12, `${CAMEROON_DOTS.length} Cameroon dots`);
  const v = new Vector3();
  for (const i of CAMEROON_DOTS) {
    assert.ok(isLand.has(i), `Cameroon dot ${i} is land`);
    latticePoint(i, v);
    const lat = (Math.asin(v.y) * 180) / Math.PI;
    const lon = (Math.atan2(v.x, v.z) * 180) / Math.PI;
    assert.ok(lat > 1.5 && lat < 13.2 && lon > 8.4 && lon < 16.3, `dot ${i} at ${lat.toFixed(1)}, ${lon.toFixed(1)} is in Cameroon's box`);
  }
  // Buea is on land, inside Cameroon's dots' reach.
  const buea = latLonDir(BUEA.lat, BUEA.lon);
  const nearest = Math.min(...CAMEROON_DOTS.map((i) => latticePoint(i, v).angleTo(buea)));
  assert.ok(nearest < 0.05, 'a Cameroon dot near Buea');
});

test('globe: arcs go to listed gateways, the plane is a few triangles', () => {
  const rig = buildGlobe();
  assert.equal(rig.arcs.length, ARC_HUBS.length, 'every arc hub is a listed gateway');
  assert.ok(rig.plane.geometry.attributes.position.count / 3 <= 10, 'paper plane ≤ 10 triangles');
  // Arcs stay below the globe camera's near-plane allowance (radius ≤ 1.2).
  for (const { mesh } of rig.arcs) {
    mesh.geometry.computeBoundingSphere();
    const pos = mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 7) assert.ok(new Vector3().fromBufferAttribute(pos, i).length() < 1.2);
  }
});
