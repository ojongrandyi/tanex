// The TanEx bike + rider built from primitives (MOTION_3D_SPEC §4): a stand-in until the
// commissioned model arrives (design/3d-brief.md, tracker #117). It follows the brief's node
// names, pivots, scale and orientation exactly (§5.3, §5.5), so swapping in the glTF is one line in
// assets.ts and every animation keeps working. Metres, Y up, the bike faces +Z, origin on the
// ground between the tyre contact points. Colours: brief §4.2. No DOM, no WebGL: safe in tests.
import {
  BoxGeometry, CapsuleGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, Object3D, Quaternion,
  Shape, ShapeGeometry, SphereGeometry, TorusGeometry, Vector3, type BufferGeometry,
} from 'three';

/** Part colours from the 3D brief §4.2 (BRAND_GUIDE palette). */
export const BIKE_COLORS = {
  helmet: '#4A3128',
  speedLines: '#F48800',
  visor: '#1C120E',
  vest: '#38241D',
  waistBand: '#EDDFC4',
  polo: '#141010',
  trousers: '#1C120E',
  shoes: '#0F0A08',
  skin: '#6B4330',
  gloves: '#1C120E',
  topBox: '#F48800',
  mark: '#1C120E',
  body: '#2A1B16',
  fairing: '#38241D',
  engine: '#4A3128',
  seat: '#1C120E',
  tyres: '#1C120E',
  rims: '#BF9C8A',
  headlight: '#FFFCF7',
  indicators: '#FFB55C',
  screen: '#F5ECDB',
} as const;

/** Wheel radius at the tyre's outside, used to turn scroll distance into wheel spin. */
export const WHEEL_RADIUS = 0.305;

/** Every pivot the website animates (brief §5.3). */
export const BIKE_NODES = [
  'tanex_bike', 'bike_body', 'handlebar', 'front_wheel', 'phone_holder', 'phone_screen', 'rear_wheel',
  'rider', 'rider_torso', 'top_box', 'box_lid', 'parcel_socket',
] as const;

type V3 = readonly [number, number, number];

/**
 * Builds the bike. Points are given in bike space (rest pose, no rotations on pivots), so each
 * part is placed relative to its pivot by subtracting the pivot's position.
 */
export function buildPrimitiveBike(): Group {
  const materials = new Map<string, MeshStandardMaterial>();
  const mat = (hex: string, name?: string) => {
    const key = name ?? hex;
    let m = materials.get(key);
    if (!m) {
      m = new MeshStandardMaterial({ color: hex, roughness: 0.88, metalness: 0, flatShading: true });
      if (name) m.name = name;
      materials.set(key, m);
    }
    return m;
  };
  const origin = new WeakMap<Object3D, Vector3>();
  const worldOf = (o: Object3D) => origin.get(o) ?? new Vector3();

  const pivot = (name: string, parent: Object3D | null, at: V3): Group => {
    const g = new Group();
    g.name = name;
    const p = new Vector3(...at);
    origin.set(g, p);
    if (parent) {
      g.position.copy(p).sub(worldOf(parent));
      parent.add(g);
    }
    return g;
  };
  const put = (parent: Object3D, geo: BufferGeometry, color: string, at: V3, rot: V3 = [0, 0, 0], name?: string) => {
    const m = new Mesh(geo, mat(color));
    m.position.set(...at).sub(worldOf(parent));
    m.rotation.set(...rot);
    if (name) m.name = name;
    parent.add(m);
    return m;
  };
  /** A capsule between two points (limbs, tubes). */
  const limb = (parent: Object3D, from: V3, to: V3, radius: number, color: string) => {
    const a = new Vector3(...from);
    const b = new Vector3(...to);
    const dir = b.clone().sub(a);
    const length = Math.max(0.001, dir.length() - 2 * radius);
    const m = new Mesh(new CapsuleGeometry(radius, length, 2, 7), mat(color));
    m.position.copy(a).add(b).multiplyScalar(0.5).sub(worldOf(parent));
    m.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize()));
    parent.add(m);
    return m;
  };
  /** A cylinder whose axis runs along X (bars, axles, wheel rims). */
  const axleX = (r: number, len: number, seg = 10) => new CylinderGeometry(r, r, len, seg).rotateZ(Math.PI / 2);
  const wheel = (name: string, parent: Object3D, at: V3) => {
    const w = pivot(name, parent, at);
    put(w, new TorusGeometry(0.24, 0.065, 6, 20).rotateY(Math.PI / 2), BIKE_COLORS.tyres, at);
    put(w, axleX(0.17, 0.05, 14), BIKE_COLORS.rims, at);
    put(w, axleX(0.05, 0.16), BIKE_COLORS.body, at);
    // Two crossed spokes so the spin reads at a glance.
    put(w, new BoxGeometry(0.03, 0.34, 0.035), BIKE_COLORS.body, [at[0], at[1], at[2]]);
    put(w, new BoxGeometry(0.03, 0.035, 0.34), BIKE_COLORS.body, [at[0], at[1], at[2]]);
    return w;
  };

  const bike = pivot('tanex_bike', null, [0, 0, 0]);

  // ---- bike_body: frame, engine, seat, rack, rear suspension (static) ----
  const body = pivot('bike_body', bike, [0, 0, 0]);
  limb(body, [0, 0.92, 0.48], [0, 0.6, -0.12], 0.045, BIKE_COLORS.body);
  put(body, new CapsuleGeometry(0.13, 0.32, 3, 8).rotateX(Math.PI / 2), BIKE_COLORS.body, [0, 0.8, 0.2]);
  put(body, new BoxGeometry(0.26, 0.26, 0.36), BIKE_COLORS.engine, [0, 0.45, 0.06]);
  put(body, new BoxGeometry(0.2, 0.12, 0.14), BIKE_COLORS.engine, [0, 0.6, 0.18], [0.3, 0, 0]);
  put(body, new BoxGeometry(0.27, 0.08, 0.62), BIKE_COLORS.seat, [0, 0.8, -0.24]);
  put(body, new BoxGeometry(0.24, 0.17, 0.5), BIKE_COLORS.body, [0, 0.67, -0.32]);
  put(body, new BoxGeometry(0.36, 0.03, 0.4), BIKE_COLORS.body, [0, 0.86, -0.68]);
  put(body, new BoxGeometry(0.13, 0.03, 0.36), BIKE_COLORS.body, [0, 0.62, -0.74], [-0.25, 0, 0]);
  put(body, new BoxGeometry(0.1, 0.05, 0.03), BIKE_COLORS.indicators, [0, 0.76, -0.89]);
  for (const x of [-0.09, 0.09]) limb(body, [x, 0.45, -0.04], [x, 0.3, -0.62], 0.03, BIKE_COLORS.body);
  for (const x of [-0.12, 0.12]) limb(body, [x, 0.32, -0.54], [x, 0.72, -0.44], 0.022, BIKE_COLORS.engine);
  put(body, new CylinderGeometry(0.036, 0.03, 0.56, 8).rotateX(Math.PI / 2), BIKE_COLORS.engine, [0.16, 0.36, -0.3], [0.12, 0, 0]);
  for (const x of [-0.19, 0.19]) put(body, axleX(0.02, 0.1, 6), BIKE_COLORS.seat, [x, 0.4, 0.06]);

  // ---- handlebar: steering, fork, front wheel, fairing, phone holder ----
  const bars = pivot('handlebar', bike, [0, 0.92, 0.48]);
  for (const x of [-0.07, 0.07]) limb(bars, [x, 0.9, 0.49], [x, 0.3, 0.63], 0.026, BIKE_COLORS.body);
  limb(bars, [0, 0.92, 0.48], [0, 1.06, 0.44], 0.03, BIKE_COLORS.body);
  put(bars, axleX(0.018, 0.62, 6), BIKE_COLORS.body, [0, 1.07, 0.44]);
  for (const x of [-0.3, 0.3]) put(bars, axleX(0.026, 0.11, 6), BIKE_COLORS.seat, [x, 1.07, 0.44]);
  put(bars, new BoxGeometry(0.3, 0.3, 0.12), BIKE_COLORS.fairing, [0, 0.86, 0.56], [-0.25, 0, 0]);
  put(bars, new SphereGeometry(0.065, 10, 6), BIKE_COLORS.headlight, [0, 0.88, 0.63]);
  for (const x of [-0.13, 0.13]) put(bars, new SphereGeometry(0.026, 6, 4), BIKE_COLORS.indicators, [x, 0.93, 0.6]);
  put(bars, new BoxGeometry(0.1, 0.03, 0.36), BIKE_COLORS.body, [0, 0.58, 0.67], [0.15, 0, 0]);
  for (const x of [-0.25, 0.25]) {
    limb(bars, [x, 1.07, 0.44], [x * 1.2, 1.24, 0.42], 0.01, BIKE_COLORS.seat);
    put(bars, new BoxGeometry(0.08, 0.05, 0.02), BIKE_COLORS.seat, [x * 1.2, 1.27, 0.42]);
  }
  wheel('front_wheel', bars, [0, 0.3, 0.63]);
  const holder = pivot('phone_holder', bars, [0, 1.13, 0.42]);
  put(holder, new BoxGeometry(0.09, 0.15, 0.014), BIKE_COLORS.seat, [0, 1.13, 0.42], [-0.5, 0, 0]);
  const screen = new Mesh(new BoxGeometry(0.075, 0.125, 0.004), mat(BIKE_COLORS.screen, 'screen'));
  screen.name = 'phone_screen';
  // Faces the rider (−Z), tilted back like the phone.
  screen.position.set(0, 1.13 + 0.004, 0.42 - 0.008).sub(worldOf(holder));
  screen.rotation.set(-0.5, 0, 0);
  holder.add(screen);

  wheel('rear_wheel', bike, [0, 0.3, -0.62]);

  // ---- rider: hips, legs, feet (static) ----
  const rider = pivot('rider', bike, [0, 0.88, -0.22]);
  put(rider, new BoxGeometry(0.3, 0.14, 0.22), BIKE_COLORS.trousers, [0, 0.9, -0.24]);
  for (const s of [-1, 1]) {
    limb(rider, [s * 0.11, 0.9, -0.2], [s * 0.17, 0.79, 0.15], 0.066, BIKE_COLORS.trousers);
    limb(rider, [s * 0.17, 0.79, 0.15], [s * 0.18, 0.45, 0.06], 0.056, BIKE_COLORS.trousers);
    put(rider, new BoxGeometry(0.09, 0.07, 0.2), BIKE_COLORS.shoes, [s * 0.18, 0.42, 0.1]);
  }

  // ---- rider_torso: torso, vest, arms, neck, helmet (turns at the waist) ----
  const torso = pivot('rider_torso', rider, [0, 0.95, -0.22]);
  limb(torso, [0, 0.98, -0.22], [0, 1.38, -0.12], 0.165, BIKE_COLORS.vest);
  put(torso, new CylinderGeometry(0.172, 0.172, 0.05, 12), BIKE_COLORS.waistBand, [0, 1.02, -0.215], [0.24, 0, 0]);
  for (const s of [-1, 1]) {
    const shoulder: V3 = [s * 0.2, 1.42, -0.12];
    const mid: V3 = [s * 0.225, 1.33, -0.02];
    const elbow: V3 = [s * 0.25, 1.24, 0.12];
    const grip: V3 = [s * 0.3, 1.08, 0.42];
    limb(torso, shoulder, mid, 0.062, BIKE_COLORS.polo);
    limb(torso, mid, elbow, 0.05, BIKE_COLORS.skin);
    limb(torso, elbow, grip, 0.044, BIKE_COLORS.skin);
    put(torso, new SphereGeometry(0.05, 8, 6), BIKE_COLORS.gloves, grip);
  }
  limb(torso, [0, 1.45, -0.1], [0, 1.53, -0.07], 0.05, BIKE_COLORS.skin);
  put(torso, new SphereGeometry(0.15, 14, 10), BIKE_COLORS.helmet, [0, 1.62, -0.05]);
  put(torso, new SphereGeometry(0.153, 12, 6, Math.PI / 2 - 0.85, 1.7, 1.15, 0.6), BIKE_COLORS.visor, [0, 1.62, -0.05]);
  for (const s of [-1, 1]) {
    [0.09, 0.07, 0.045].forEach((len, i) => {
      put(torso, new BoxGeometry(0.012, 0.014, len), BIKE_COLORS.speedLines, [s * 0.148, 1.66 - i * 0.03, -0.1 - len / 2 + 0.04]);
    });
  }

  // ---- top_box: box body, lid on the rear hinge, parcel socket ----
  const box = pivot('top_box', bike, [0, 0.875, -0.68]);
  put(box, new BoxGeometry(0.45, 0.35, 0.4), BIKE_COLORS.topBox, [0, 1.05, -0.68]);
  put(box, new BoxGeometry(0.41, 0.006, 0.36), BIKE_COLORS.visor, [0, 1.227, -0.68]);
  const mark = markGeometry(0.17);
  put(box, mark, BIKE_COLORS.mark, [0.2265, 1.06, -0.68], [0, Math.PI / 2, 0]);
  put(box, mark, BIKE_COLORS.mark, [-0.2265, 1.06, -0.68], [0, -Math.PI / 2, 0]);
  put(box, mark, BIKE_COLORS.mark, [0, 1.06, -0.8815], [0, Math.PI, 0]);
  const lid = pivot('box_lid', box, [0, 1.225, -0.88]);
  put(lid, new BoxGeometry(0.47, 0.05, 0.42), BIKE_COLORS.topBox, [0, 1.25, -0.67]);
  const socket = new Object3D();
  socket.name = 'parcel_socket';
  socket.position.set(0, 0.02, 0);
  box.add(socket);

  return bike;
}

/** The TanEx paper-plane mark as a flat decal (one colour), pointing forward. */
function markGeometry(size: number): ShapeGeometry {
  const s = new Shape();
  s.moveTo(-0.5, -0.12);
  s.lineTo(0.5, 0.22);
  s.lineTo(-0.18, 0.06);
  s.lineTo(-0.3, 0.3);
  s.lineTo(-0.36, 0.02);
  s.closePath();
  return new ShapeGeometry(s).scale(size, size, size);
}

/** Total triangle count of an object tree (budget: ≤ 8,000 for the bike, brief §5.1). */
export function triangleCount(root: Object3D): number {
  let n = 0;
  root.traverse((o) => {
    const g = (o as Mesh).geometry as BufferGeometry | undefined;
    if (!g) return;
    n += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  return Math.round(n);
}
