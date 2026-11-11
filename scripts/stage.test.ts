// The 3D Stage's pure parts (MOTION_3D_SPEC §4–§6, H.2–H.5): the bike model file and the primitive fallback match the 3D brief's
// node names and triangle budget, the lane anchor and camera rail are continuous functions of
// scroll (reversible), and assets load in priority order.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Box3, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import { Fade } from '../src/motion/stage/fade.ts';
import { BIKE_NODES, buildPrimitiveBike, triangleCount } from '../src/motion/stage/bike.ts';
import { CAMERA_KEYS, CameraRail } from '../src/motion/stage/camera.ts';
import { laneAnchor } from '../src/motion/stage/lanes.ts';
import { BIKE_MODEL_URL, loadAssets, readyChapters, TRUCK_MODEL_URL, type StageAsset } from '../src/motion/stage/assets.ts';
import { distanceAt, storyTravel } from '../src/motion/stage/Stage.ts';
import { inTownDistance, inTownPhase, mapRoutePoint, RIDE_OUT_METRES } from '../src/motion/stage/chapters/inTown.ts';
import {
  ARRIVE_METRES, CITY_TIMELINE, cityDistance, cityFocus, cityPhase, pinState, roadAt, routeLayout, TRUCK_START_Z, truckU,
} from '../src/motion/stage/chapters/cityToCity.ts';
import { journeyEase } from '../src/motion/stage/ease.ts';
import { HERO_TIMELINE, heroDistance, heroPhase, ROLL_METRES } from '../src/motion/stage/chapters/hero.ts';
import { bandFrame, rideProgress } from '../src/motion/stage/chapters/services.ts';
import { ARC_HUBS, BUEA, buildGlobe, landIndices, latLonDir, latticePoint } from '../src/motion/stage/globe.ts';
import { CAMEROON_DOTS, DOT_COUNT } from '../src/motion/stage/globeDots.ts';
import CODE128B from 'jsbarcode/bin/barcodes/CODE128/CODE128B.js';
import { code128B } from '../src/motion/stage/code128.ts';
import { laneDrawn, WORLD_HUB, WORLD_HUBS, WORLD_TIMELINE, worldPhase } from '../src/motion/stage/chapters/world.ts';
import { LABEL_TIMELINE, LABEL_VIEW, LabelRig, labelPhase } from '../src/motion/stage/chapters/label.ts';
import {
  DOOR_METRES, DOOR_VIEW, gate, IDLE_SECONDS, IdleClock, idleGlow, latePhase, PARK_METRES, PARK_VIEW, riseIn, STILL_DIM,
} from '../src/motion/stage/chapters/arrival.ts';
import { TILE_STEPS } from '../src/motion/journey.ts';
import { TRADE_LANES } from '../src/data/gateways.ts';
import { TRACKING_ID_EXAMPLE } from '../src/config/brand.ts';

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

// ---- H.4: chapters 2–3 ----

test('story travel: pinned chapters 2–5 run on their pin progress, continuously', () => {
  assert.equal(storyTravel({ travel: 1.97, chapter: 1, progress: 0.9 }), 1.97);
  assert.equal(storyTravel({ travel: 2.3, chapter: 2, progress: 0 }), 2, 'holds while the chapter glides in');
  assert.equal(storyTravel({ travel: 2.6, chapter: 2, progress: 0.5 }), 2.5);
  assert.equal(storyTravel({ travel: 2.99, chapter: 2, progress: 1 }), 3, 'ends where chapter 3 starts');
  assert.equal(storyTravel({ travel: 3, chapter: 3, progress: 0 }), 3);
  assert.equal(storyTravel({ travel: 4.2, chapter: 4, progress: 0.3 }), 4.3);
  assert.equal(storyTravel({ travel: 5.4, chapter: 5, progress: 1 }), 6, 'Label ends where Contact starts');
  assert.equal(storyTravel({ travel: 6.4, chapter: 6, progress: 0.4 }), 6.4, 'Contact onwards follows the travel');
});

test('in town: beats in order, the bike rides away and fades as the chapter leaves', () => {
  const at = (s: number) => inTownPhase(s);
  assert.equal(at(0).lid, 0);
  assert.ok(at(0.3).lid > 0.99, 'box open in beat 1 (Picked up)');
  assert.equal(at(0.45).lid, 0, 'box closed in beat 2');
  assert.equal(at(0.3).map, 0);
  assert.ok(at(0.5).map > 0.99 && at(0.5).glance > 0.99, 'beat 2 (On the way): phone map and glance');
  assert.ok(at(0.48).dot < at(0.55).dot, 'the dot moves along the route');
  assert.equal(at(0.75).map, 0);
  assert.equal(at(0.85).bikeZ, 0);
  assert.equal(at(0.85).opacity, 1);
  assert.equal(at(1).opacity, 0, 'gone by the end of the chapter');
  assert.equal(at(1).bikeZ, RIDE_OUT_METRES);
  let prev = inTownDistance(0);
  for (let s = 0.01; s <= 1.0001; s += 0.01) {
    assert.ok(inTownDistance(s) >= prev - 1e-9);
    prev = inTownDistance(s);
  }
  const [x0, y0] = mapRoutePoint(0);
  const [x1, y1] = mapRoutePoint(1);
  assert.ok(x0 >= 0 && x0 <= 1 && y0 >= 0 && y0 <= 1 && x1 >= 0 && x1 <= 1 && y1 >= 0 && y1 <= 1, 'route inside the screen');
});

test('city to city: hand-off order, then the pull-back and the drive', () => {
  const T = CITY_TIMELINE;
  const at = (s: number) => cityPhase(s);
  assert.equal(at(0).bikeOpacity, 0, 'the bike rides in from out of view');
  assert.equal(at(0).bikeZ, -ARRIVE_METRES);
  assert.equal(at(T.arrive[1]).bikeZ + 0, 0, 'parked behind the truck');
  assert.ok(T.doorOpen[1] <= T.arc[0] && T.lidOpen[1] <= T.arc[0], 'door and lid open before the lift');
  assert.ok(T.arc[1] <= T.lidClose[1] && T.arc[1] <= T.doorClose[0], 'they close after it lands');
  assert.ok(T.doorClose[1] <= T.pull[1] && T.pull[0] >= T.doorClose[0], 'pull-back once the door is closing');
  assert.ok(T.drive[0] >= T.pull[0] && T.drive[1] <= 0.85, 'the drive ends within the story (70%)');
  assert.equal(at(0.2).parcel, 'bike');
  assert.equal(at(0.33).parcel, 'arc');
  assert.equal(at(0.5).parcel, 'truck');
  assert.equal(at(0.55).door, 0, 'door shut before the truck drives');
  assert.equal(at(0.59).drive, 0);
  assert.equal(at(0.9).drive, 1);
  assert.ok(cityDistance(1) === ARRIVE_METRES);
});

test('route: pins from the TanEx locations, in order along the road; the truck starts at Limbe', () => {
  const L = routeLayout();
  assert.deepEqual(L.pins.map((p) => p.city), ['Limbe', 'Buea', 'Douala']);
  const [limbe, buea, douala] = L.pins;
  assert.ok(limbe.u < buea.u && buea.u < douala.u, 'Limbe → Buea → Douala along the road');
  assert.ok(buea.z > limbe.z && buea.z > douala.z, 'Buea is the most northerly (+Z)');
  assert.ok(douala.x < buea.x && buea.x < limbe.x + 1e-9, 'Douala is the most easterly (−X)');
  assert.ok(L.start < L.stop && L.stop < douala.u, 'the truck stops short of the Douala pin');
  const start = roadAt(L, truckU(L, 0));
  assert.ok(Math.abs(start.point.x) < 0.05 && Math.abs(start.point.z - TRUCK_START_Z) < 0.2, 'parked ahead of the bike');
  assert.ok(Math.abs(start.yaw) < 0.02, 'facing the way the bike faces');
  // Pins check off in order as the truck drives.
  const states = (u: number) => L.pins.map((p, i) => pinState(p, i, L.pins.length, u, L));
  assert.deepEqual(states(truckU(L, 0)), ['todo', 'todo', 'todo']);
  assert.deepEqual(states(buea.u + 0.01), ['done', 'done', 'todo']);
  assert.deepEqual(states(truckU(L, 1)), ['done', 'done', 'arrived']);
  // Framing goes from the hand-off to the whole route.
  const near = cityFocus(L, 0);
  const wide = cityFocus(L, 1);
  assert.ok(wide.length > 2 * near.length && wide.length >= L.span);
});

test('truck model file: brief node names, budget, meshopt only; bike + truck within the 3D budget', () => {
  const file = fs.readFileSync(path.join('Public', TRUCK_MODEL_URL));
  const bike = fs.readFileSync(path.join('Public', BIKE_MODEL_URL));
  assert.ok(file.length + bike.length <= 450 * 1024, `${Math.round((file.length + bike.length) / 1024)} KB`);
  const json = JSON.parse(file.subarray(20, 20 + file.readUInt32LE(12)).toString('utf8'));
  const names = (json.nodes as { name?: string }[]).map((n) => n.name);
  for (const name of ['tanex_truck', 'truck_body', 'wheel_front_left', 'wheel_front_right', 'wheel_rear_left', 'wheel_rear_right', 'cargo_door']) {
    assert.ok(names.includes(name), name);
  }
  assert.ok((json.materials as unknown[]).length <= 12, 'at most 12 materials');
  const supported = ['EXT_meshopt_compression', 'KHR_mesh_quantization'];
  for (const ext of json.extensionsRequired ?? []) assert.ok(supported.includes(ext), `required ${ext}`);
  type Prim = { indices?: number };
  const tris = (json.meshes as { primitives: Prim[] }[]).flatMap((m) => m.primitives)
    .reduce((n, p) => n + (p.indices === undefined ? 0 : json.accessors[p.indices].count / 3), 0);
  assert.ok(tris <= 30000, `${tris} triangles`);
});

test('a failing asset is skipped: its chapter never becomes ready', async () => {
  const seen: string[] = [];
  const list: StageAsset[] = [
    { id: 'bike', chapters: [2, 3], priority: 0, load: async () => new Object3D() },
    { id: 'truck', chapters: [3], priority: 1, load: async () => { throw new Error('404'); } },
  ];
  await loadAssets((a) => seen.push(a.id), undefined, list);
  assert.deepEqual(seen, ['bike']);
  assert.deepEqual([...readyChapters(new Set(seen), list)], [2]);
});

test('fade: opaque at full opacity, dithered (alpha hash) only while partly faded', () => {
  const a = new MeshStandardMaterial();
  const b = new MeshStandardMaterial();
  const fade = new Fade([a, b]);
  assert.equal(a.alphaHash, false);
  fade.set(0.5);
  assert.equal(a.alphaHash, true);
  assert.equal(b.opacity, 0.5);
  fade.set(1);
  assert.equal(a.alphaHash, false, 'back to the opaque shader');
  assert.equal(a.transparent, false, 'never blended');
  fade.setTransparent(true);
  fade.restore();
  assert.equal(a.alphaHash, false, 'restore follows the current opacity');
});

test('world: the globe returns, the parcel boards, then the plane flies while the other lanes draw', () => {
  const T = WORLD_TIMELINE;
  const at = (s: number) => worldPhase(s);
  assert.equal(at(0).globe, 0, 'the globe returns as the chapter starts');
  assert.equal(at(T.fadeIn[1]).globe, 1);
  assert.equal(at(0).rise, 0);
  assert.equal(at(T.rise[1]).rise, 1, 'risen to orbit');
  assert.ok(T.board[1] <= T.flight[0], 'the parcel is on board before the plane leaves');
  assert.equal(at(T.board[1]).flight, 0);
  assert.ok(T.flight[1] <= 0.85 && T.lanes[1] <= 0.85, 'flight and lanes end within the story (70%)');
  assert.equal(at(1).flight, 1);
  assert.deepEqual(
    [...WORLD_HUBS].sort(),
    TRADE_LANES.map(([, to]) => to).sort(),
    'the lanes are the network map\'s lanes',
  );
  assert.ok(WORLD_HUBS.includes(WORLD_HUB), 'the plane flies one of them');
  const n = WORLD_HUBS.length - 1;
  for (let i = 0; i < n; i++) {
    assert.equal(laneDrawn(0, i, n), 0);
    assert.equal(laneDrawn(1, i, n), 1);
    if (i > 0) assert.ok(laneDrawn(0.5, i, n) <= laneDrawn(0.5, i - 1, n), 'lanes draw one after another');
  }
  const rig = buildGlobe({ hubs: WORLD_HUBS, planeHub: WORLD_HUB });
  assert.deepEqual(rig.arcs.map((a) => a.code), [...WORLD_HUBS]);
});

test('label: the parcel turns, the bars draw, the beam scans, the ID types, then the tiles', () => {
  const T = LABEL_TIMELINE;
  const n = TRACKING_ID_EXAMPLE.length;
  const at = (s: number) => labelPhase(s, n);
  assert.ok(T.turn[1] <= T.bars[0] && T.bars[1] <= T.scan[0] && T.scan[1] <= T.type[0], 'one beat at a time');
  assert.equal(at(0).typed, 0);
  assert.equal(at(T.type[1]).typed, n);
  assert.equal(at(T.bars[0]).bars, 0);
  assert.equal(at(T.bars[1]).bars, 1);
  assert.equal(at(T.scan[0]).beam, 0, 'the beam is off before and after its pass');
  assert.equal(at(T.scan[1]).beam, 0);
  assert.ok(at((T.scan[0] + T.scan[1]) / 2).beam > 0.99);
  assert.ok(TILE_STEPS.every((s, i) => s >= T.type[1] && (i === 0 || s > TILE_STEPS[i - 1]) && s <= 0.9), 'tiles after the ID, in order');

  // At the end of the turn the label faces the camera, its text level and reading left to right.
  const rig = new LabelRig();
  const pose = rig.update(at(T.turn[1]), LABEL_VIEW, T.turn[1]);
  const az = (LABEL_VIEW.az * Math.PI) / 180;
  const el = (LABEL_VIEW.el * Math.PI) / 180;
  const toCam = new Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  const right = new Vector3(0, 1, 0).cross(toCam).normalize();
  const face = new Vector3(0, 1, 0).applyQuaternion(pose.quaternion);
  const text = new Vector3(0, 0, -1).applyQuaternion(pose.quaternion);
  assert.ok(face.dot(toCam) > 0.999, 'label faces the camera');
  assert.ok(text.dot(right) > 0.999, 'text reads left to right');
  assert.ok(pose.focus.length < 0.5, 'the camera closes in');
  // A short lane (phone band): the close-up stops where the whole top face still fits.
  const short = new LabelRig().update(at(1), LABEL_VIEW, 1, 0.39);
  assert.ok(Math.abs(short.focus.length - 0.39) < 1e-9, 'never tighter than the lane allows');
});

test('label barcode: Code 128 of the tracking ID, the same as the DOM label (JsBarcode)', () => {
  const Ctor = ((CODE128B as unknown as { default?: unknown }).default ?? CODE128B) as new (d: string, o: object) => { encode(): { data: string } };
  assert.equal(code128B(TRACKING_ID_EXAMPLE), new Ctor(TRACKING_ID_EXAMPLE, {}).encode().data);
  assert.throws(() => code128B('é'));
});

test('contact, FAQ, door: one state at a time, ride-ins in order, the still frame dimmed', () => {
  const view = { top: 72, bottom: 900 };
  assert.equal(riseIn(null, view, 0.4), 1, 'a hidden lane counts as risen');
  assert.equal(riseIn({ left: 0, top: 900, width: 300, height: 260 }, view, 0.4), 0, 'below the fold');
  assert.equal(riseIn({ left: 0, top: 300, width: 300, height: 260 }, view, 0.4), 1);
  assert.equal(gate(0.5), 0);
  assert.equal(gate(0.75), 1);
  const zero = { label: 0, park: 0, still: 0, door: 0 };

  // Parking beside the form.
  const arriving = latePhase({ ...zero, park: 1 }, 0, 0);
  assert.equal(arriving.bikeZ, -PARK_METRES);
  assert.equal(arriving.bikeOpacity, 0, 'rides in from out of view');
  const parked = latePhase({ ...zero, park: 1 }, 1, 0);
  assert.equal(parked.bikeZ, 0);
  assert.equal(parked.bikeOpacity, 1);
  assert.ok(parked.parked && parked.view === 'park' && parked.lid === 0);
  assert.ok(Math.abs(latePhase({ ...zero, still: 1 }, 1, 0).dim - STILL_DIM) < 1e-9, 'still frame dimmed');
  assert.equal(latePhase({ ...zero, still: 1 }, 1, 0).parked, false, 'no idle beside the FAQ');

  // At the door: rides in, stops, then the box opens.
  const door = (p: number) => latePhase({ ...zero, door: 1 }, 1, p);
  assert.equal(door(0).bikeZ, -DOOR_METRES);
  assert.equal(door(0.7).bikeZ, 0);
  assert.equal(door(0.7).lid, 0);
  assert.equal(door(1).lid, 1);
  assert.equal(door(1).view, 'door');

  // The view switches only where neither state is drawn.
  for (let x = 0; x <= 1.0001; x += 0.05) {
    const p = latePhase({ ...zero, still: 1 - x, door: x }, 1, 1);
    assert.equal(p.view === 'door' ? gate(1 - x) : gate(x), 0, 'the state out of view is not drawn');
  }
  assert.ok(PARK_VIEW.az !== DOOR_VIEW.az, 'park and door are seen from different sides');
});

test('parked idle: at most 5 s, only while running, frame gaps capped', () => {
  const clock = new IdleClock();
  assert.equal(clock.tick(0, true), 0);
  assert.equal(clock.tick(16, true), 0.016);
  assert.equal(clock.tick(10_000, false), 0.016, 'holds while a field has focus');
  assert.equal(clock.tick(20_000, true), 0.016, 'resumes without counting the pause');
  assert.ok(Math.abs(clock.tick(20_016, true) - 0.032) < 1e-9);
  for (let t = 20_032; t < 40_000; t += 16) clock.tick(t, true);
  assert.equal(clock.done, true);
  assert.equal(clock.tick(50_000, true), IDLE_SECONDS, 'stops for good');
  assert.equal(idleGlow(0), 0);
  assert.equal(idleGlow(IDLE_SECONDS), 0);
  assert.ok(idleGlow(1.25) > 0.9);
});
