// The globe of chapter 0 (MOTION_3D_SPEC §4, §6): a cream sphere, chocolate dotted continents
// with Cameroon lit in orange, orange arcs from the Douala gateway to some of the trade hubs the
// site already lists (src/data/gateways.ts), and the paper plane. Everything is drawn with small
// custom shaders that share two cut-outs used by the dive into Buea:
// - a screen-space circle (the "porthole") that keeps the growing globe inside its lane, so it
//   never spreads under the hero text;
// - an opening around Buea that widens until the globe is gone, revealing the street behind.
// Globe space: radius 1, centred on the origin, latitude/longitude with longitude 0 facing +Z.
import {
  BufferGeometry, CatmullRomCurve3, Color, DoubleSide, Float32BufferAttribute, Group, Mesh, Points,
  ShaderMaterial, SphereGeometry, TubeGeometry, Vector2, Vector3, type Side,
} from 'three';
import { GATEWAYS, HUB_CODE, TANEX_LOCATIONS } from '../../data/gateways';
import { CAMEROON_DOTS, DOT_COUNT, LAND_BITS } from './globeDots';
import { paperPlaneGeometry } from './paperPlane';

/** Buea, the head office (gateways.ts BUE): where the dive lands. */
export const BUEA = { lat: 4.153, lon: 9.241 } as const;
/** Hubs the intro draws arcs to (a few of the site's listed gateways, spread over the regions). */
export const ARC_HUBS = ['CDG', 'IST', 'DXB', 'CAN', 'JFK', 'JNB'] as const;
/** The hub the paper plane flies to during the intro. */
export const PLANE_HUB = 'CDG';

const COLORS = {
  sea: '#F5ECDB', // Cream 200
  shade: '#D9C2B5', // Chocolate 200
  land: '#7B5545', // Chocolate 500
  lit: '#F48800', // Orange 500
  plane: '#F48800',
} as const;

const DEG = Math.PI / 180;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** Unit vector for a latitude/longitude in degrees (longitude 0 faces +Z). */
export function latLonDir(lat: number, lon: number, out = new Vector3()): Vector3 {
  const la = lat * DEG;
  const lo = lon * DEG;
  return out.set(Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo));
}

/** Point `i` of the Fibonacci lattice used by scripts/build-globe-dots.mjs. */
export function latticePoint(i: number, out = new Vector3()): Vector3 {
  const y = 1 - (2 * i + 1) / DOT_COUNT;
  const r = Math.sqrt(1 - y * y);
  return out.set(Math.cos(GOLDEN * i) * r, y, Math.sin(GOLDEN * i) * r);
}

/** Indices of the land points. */
export function landIndices(): number[] {
  const bytes = Uint8Array.from(atob(LAND_BITS), (c) => c.charCodeAt(0));
  const out: number[] = [];
  for (let i = 0; i < DOT_COUNT; i++) if (bytes[i >> 3] & (1 << (i & 7))) out.push(i);
  return out;
}

export interface GlobeUniforms {
  /** Screen circle in drawing-buffer pixels (x, y from bottom-left, radius); radius ≤ 0 = off. */
  uMask: { value: Vector3 };
  uMaskSoft: { value: number };
  /** Centre of the opening (world space, unit). */
  uHoleDir: { value: Vector3 };
  /** Opening angle and soft edge, radians. An angle below −soft means closed. */
  uHole: { value: Vector2 };
  uOpacity: { value: number };
  uArcOpacity: { value: number };
  /** Drawing-buffer pixels per world unit at distance 1 (dot sizes). */
  uPxPerUnit: { value: number };
}

export interface GlobeRig {
  group: Group;
  uniforms: GlobeUniforms;
  /** Arc meshes with their hub and tube segment counts (drawn progressively). */
  arcs: { code: string; mesh: Mesh; segments: number; radial: number }[];
  plane: Mesh;
  /** The plane's route (the arc to PLANE_HUB, slightly higher). */
  planePath: CatmullRomCurve3;
}

// Shared GLSL: the porthole and the opening. `dir` is the fragment's direction from the globe
// centre in world space (the globe sits on the world origin).
const CUTOUT = /* glsl */ `
uniform vec3 uMask;
uniform float uMaskSoft;
uniform vec3 uHoleDir;
uniform vec2 uHole;
uniform float uOpacity;
float cutout(vec3 dir) {
  float a = 1.0;
  if (uMask.z > 0.0) {
    float d = distance(gl_FragCoord.xy, uMask.xy);
    a *= 1.0 - smoothstep(uMask.z - uMaskSoft, uMask.z, d);
  }
  float ang = acos(clamp(dot(normalize(dir), uHoleDir), -1.0, 1.0));
  a *= smoothstep(uHole.x - uHole.y, uHole.x + uHole.y, ang);
  return a * uOpacity;
}
`;

const SPHERE_VERT = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormalV;
varying vec3 vViewPos;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormalV = normalize(normalMatrix * normal);
  vec4 mv = viewMatrix * world;
  vViewPos = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

const SPHERE_FRAG = /* glsl */ `
uniform vec3 uSea;
uniform vec3 uShade;
varying vec3 vWorld;
varying vec3 vNormalV;
varying vec3 vViewPos;
${CUTOUT}
void main() {
  float a = cutout(vWorld);
  if (a < 0.003) discard;
  vec3 n = normalize(vNormalV);
  float light = max(dot(n, normalize(vec3(-0.45, 0.55, 0.7))), 0.0);
  float facing = max(dot(n, normalize(-vViewPos)), 0.0);
  vec3 col = mix(uShade, uSea, 0.62 + 0.38 * light);
  col = mix(uShade, col, 0.7 + 0.3 * facing);
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}
`;

const DOTS_VERT = /* glsl */ `
attribute vec3 aColor;
attribute float aSize;
attribute float aRing;
uniform float uPxPerUnit;
varying vec3 vColor;
varying vec3 vWorld;
varying float vFacing;
varying float vRing;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vec4 mv = viewMatrix * world;
  vec3 n = normalize(normalMatrix * normalize(position));
  vFacing = dot(n, normalize(-mv.xyz));
  vColor = aColor;
  vRing = aRing;
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aSize * uPxPerUnit / -mv.z, 1.0, 96.0);
}
`;

const DOTS_FRAG = /* glsl */ `
varying vec3 vColor;
varying vec3 vWorld;
varying float vFacing;
varying float vRing;
${CUTOUT}
void main() {
  if (vFacing <= 0.0) discard;
  float r = length(gl_PointCoord - 0.5);
  float aa = max(fwidth(r), 0.02);
  float shape = 1.0 - smoothstep(0.5 - aa, 0.5, r);
  if (vRing > 0.5) shape *= smoothstep(0.36 - aa, 0.36, r);
  float a = shape * smoothstep(0.0, 0.28, vFacing) * cutout(vWorld);
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor, a);
  #include <colorspace_fragment>
}
`;

const FLAT_VERT = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormalW;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FLAT_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uLit;
uniform float uArcOpacity;
varying vec3 vWorld;
varying vec3 vNormalW;
${CUTOUT}
void main() {
  float a = cutout(vWorld) * uArcOpacity;
  if (a < 0.01) discard;
  vec3 n = normalize(vNormalW) * (gl_FrontFacing ? 1.0 : -1.0);
  float light = mix(1.0, 0.72 + 0.28 * max(dot(n, normalize(vec3(-0.3, 0.8, 0.5))), 0.0), uLit);
  gl_FragColor = vec4(uColor * light, a);
  #include <colorspace_fragment>
}
`;

function createUniforms(): GlobeUniforms {
  return {
    uMask: { value: new Vector3(0, 0, 0) },
    uMaskSoft: { value: 1.5 },
    uHoleDir: { value: latLonDir(BUEA.lat, BUEA.lon) },
    uHole: { value: new Vector2(-1, 0.14) },
    uOpacity: { value: 1 },
    uArcOpacity: { value: 1 },
    uPxPerUnit: { value: 1000 },
  };
}

/** Great-circle arc from `a` to `b` (unit vectors), lifted in the middle. */
function arcCurve(a: Vector3, b: Vector3, lift: number): CatmullRomCurve3 {
  const angle = a.angleTo(b);
  const height = 0.02 + 0.13 * (angle / Math.PI);
  const points: Vector3[] = [];
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // Slerp on the unit sphere.
    const s = Math.sin(angle);
    const p = s < 1e-6
      ? a.clone()
      : a.clone().multiplyScalar(Math.sin((1 - t) * angle) / s).add(b.clone().multiplyScalar(Math.sin(t * angle) / s));
    points.push(p.normalize().multiplyScalar(1.004 + lift + height * Math.sin(Math.PI * t)));
  }
  return new CatmullRomCurve3(points, false, 'centripetal');
}

export interface GlobeOptions {
  /** Hubs the arcs from Douala go to (default: ARC_HUBS, the hero intro). */
  hubs?: readonly string[];
  /** The hub the plane's route goes to (default: PLANE_HUB). */
  planeHub?: string;
}

/** An unlit-looking flat colour that obeys the globe's porthole, opening and opacity (arcs, plane, parcel). */
export function flatMaterial(
  uniforms: GlobeUniforms, color: string, lit: number, extra: { side?: Side; arcOpacity?: { value: number } } = {},
): ShaderMaterial {
  const shared = uniforms as unknown as Record<string, { value: unknown }>;
  return new ShaderMaterial({
    uniforms: { ...shared, uColor: { value: new Color(color) }, uLit: { value: lit }, ...(extra.arcOpacity ? { uArcOpacity: extra.arcOpacity } : {}) },
    vertexShader: FLAT_VERT,
    fragmentShader: FLAT_FRAG,
    transparent: true,
    ...(extra.side !== undefined ? { side: extra.side } : {}),
  });
}

export function buildGlobe({ hubs = ARC_HUBS, planeHub = PLANE_HUB }: GlobeOptions = {}): GlobeRig {
  const uniforms = createUniforms();
  const group = new Group();
  group.name = 'tanex_globe';
  const shared = uniforms as unknown as Record<string, { value: unknown }>;

  const sphere = new Mesh(
    new SphereGeometry(1, 72, 48),
    new ShaderMaterial({
      uniforms: { ...shared, uSea: { value: new Color(COLORS.sea) }, uShade: { value: new Color(COLORS.shade) } },
      vertexShader: SPHERE_VERT,
      fragmentShader: SPHERE_FRAG,
      transparent: true,
    }),
  );
  sphere.renderOrder = 0;
  group.add(sphere);

  // Dots: land (chocolate), Cameroon (orange), and the Buea marker (dot + ring).
  const land = landIndices();
  const lit = new Set(CAMEROON_DOTS);
  const landColor = new Color(COLORS.land);
  const litColor = new Color(COLORS.lit);
  const positions: number[] = [];
  const colors: number[] = [];
  const sizes: number[] = [];
  const rings: number[] = [];
  const p = new Vector3();
  for (const i of land) {
    latticePoint(i, p).multiplyScalar(1.002);
    positions.push(p.x, p.y, p.z);
    const c = lit.has(i) ? litColor : landColor;
    colors.push(c.r, c.g, c.b);
    sizes.push(0.0125);
    rings.push(0);
  }
  latLonDir(BUEA.lat, BUEA.lon, p).multiplyScalar(1.004);
  positions.push(p.x, p.y, p.z, p.x, p.y, p.z);
  colors.push(litColor.r, litColor.g, litColor.b, litColor.r, litColor.g, litColor.b);
  sizes.push(0.03, 0.075);
  rings.push(0, 1);
  const dotsGeometry = new BufferGeometry();
  dotsGeometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  dotsGeometry.setAttribute('aColor', new Float32BufferAttribute(colors, 3));
  dotsGeometry.setAttribute('aSize', new Float32BufferAttribute(sizes, 1));
  dotsGeometry.setAttribute('aRing', new Float32BufferAttribute(rings, 1));
  const dots = new Points(
    dotsGeometry,
    new ShaderMaterial({ uniforms: shared, vertexShader: DOTS_VERT, fragmentShader: DOTS_FRAG, transparent: true, depthWrite: false }),
  );
  dots.renderOrder = 2;
  group.add(dots);

  // Arcs from the Douala gateway, drawn as thin tubes.
  const hub = [...TANEX_LOCATIONS, ...GATEWAYS].find((g) => g.code === HUB_CODE);
  const from = latLonDir(hub?.lat ?? 4.0061, hub?.lng ?? 9.7195);
  const arcMaterial = flatMaterial(uniforms, COLORS.lit, 0);
  arcMaterial.depthWrite = false;
  const arcs: GlobeRig['arcs'] = [];
  let planePath: CatmullRomCurve3 | null = null;
  for (const code of hubs) {
    const g = GATEWAYS.find((x) => x.code === code);
    if (!g) continue;
    const to = latLonDir(g.lat, g.lng);
    const segments = 64;
    const radial = 5;
    const mesh = new Mesh(new TubeGeometry(arcCurve(from, to, 0), segments, 0.0042, radial, false), arcMaterial);
    mesh.renderOrder = 1;
    mesh.name = `arc_${code}`;
    group.add(mesh);
    arcs.push({ code, mesh, segments, radial });
    if (code === planeHub) planePath = arcCurve(from, to, 0.035);
  }

  const plane = new Mesh(paperPlaneGeometry(), flatMaterial(uniforms, COLORS.plane, 1, { side: DoubleSide }));
  plane.name = 'paper_plane';
  plane.scale.setScalar(0.075);
  plane.renderOrder = 3;
  group.add(plane);

  return { group, uniforms, arcs, plane, planePath: planePath ?? arcCurve(from, latLonDir(49, 2.5), 0.035) };
}
