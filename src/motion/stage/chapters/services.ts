// Chapter 1 · Services (MOTION_3D_SPEC §6; tracker #144): the bike rides a road through the
// section. Beside the intro the road runs under the bike (its dashes scroll by the distance
// ridden). While the chapter is pinned, a road band between the card rows is the bike's lane: the
// road stays put on the band and the bike rides across it, left to right, passing each column of
// cards as that card lights up (journey.ts beats). The paper plane crosses for Air; at the end
// the bike turns towards the visitor for Local delivery. Pure functions of the Journey state.
import {
  CanvasTexture, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry,
  RepeatWrapping, SRGBColorSpace,
} from 'three';
import type { LaneRect } from '../lanes';
import { clamp01, lerp, smooth, span } from '../ease';
import { paperPlaneGeometry } from '../paperPlane';

/** Story part of a pinned chapter (journey.ts: 15% arrive, 70% story, 15% leave). */
const ARRIVE = 0.15;
const STORY = 0.7;
/** Road: width and length (m), dash period (m). */
const ROAD_WIDTH = 2.4;
const ROAD_LENGTH = 44;
const DASH_PERIOD = 3;
/** Visible road length beside the intro (m), where the road must stay inside the lane. */
const LANE_ROAD_LENGTH = 5;
/** Width of the bike's frame on the band, as a multiple of the band's height. */
const BAND_FRAME = 2.2;
const COLORS = {
  road: '#EDE1DA', // Chocolate 50
  dash: '#F48800', // Orange 500
  plane: '#F48800',
} as const;

/** Progress of the ride across the band (0 at the left end, 1 at the right). */
export function rideProgress(chapter: number, progress: number): number {
  if (chapter < 1) return 0;
  if (chapter > 1) return 1;
  return clamp01((progress - ARRIVE) / STORY);
}

/** The part of the band the bike is framed in at ride progress `p`. */
export function bandFrame(band: LaneRect, p: number): LaneRect {
  const width = Math.min(band.width, band.height * BAND_FRAME);
  return { left: band.left + p * (band.width - width), top: band.top, width, height: band.height };
}

export interface ServicesPose {
  /** Distance ridden (m): scrolls the road's dashes beside the intro. */
  distance: number;
  /** How much the band is the bike's lane (0–1). */
  band: number;
  /** How much any Services lane is the bike's lane (0–1). */
  presence: number;
  /** Ride progress across the band (0–1). */
  ride: number;
  /** Metres from the band's centre to the bike, signed (keeps the road on the band). */
  along: number;
  /** Journey travel (the road waits until the bike has left the door). */
  travel: number;
}

export interface ServicesOutput {
  /** Bike heading (rad, about Y): turns towards the visitor at the end of the band. */
  yaw: number;
}

export class ServicesScene {
  /** Road and plane: added to the main scene by the Stage. */
  readonly group = new Group();
  private readonly road: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private readonly plane: Mesh;
  private readonly planeMaterial: MeshStandardMaterial;

  constructor() {
    this.group.name = 'tanex_services';
    const map = roadTexture();
    map.wrapT = RepeatWrapping;
    map.repeat.set(1, ROAD_LENGTH / DASH_PERIOD);
    const road = new Mesh(
      new PlaneGeometry(ROAD_WIDTH, ROAD_LENGTH).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({ map, alphaMap: endsTexture(), transparent: true, depthWrite: false, toneMapped: false }),
    );
    road.position.y = 0.002;
    road.renderOrder = -2;
    this.road = road;
    this.group.add(road);

    this.planeMaterial = new MeshStandardMaterial({ color: new Color(COLORS.plane), roughness: 0.7, side: DoubleSide, transparent: true });
    this.plane = new Mesh(paperPlaneGeometry(), this.planeMaterial);
    this.plane.scale.setScalar(0.8);
    this.plane.name = 'air_plane';
    this.group.add(this.plane);
    this.group.visible = false;
  }

  update(pose: ServicesPose): ServicesOutput {
    const { band, presence, ride, along, distance, travel } = pose;
    // Only once the bike has left the door and Services is its main lane (never over the hero).
    const shown = smooth((presence - 0.3) / 0.4) * span(travel, 0.85, 1);
    this.group.visible = shown > 0.002;
    if (!this.group.visible) return { yaw: 0 };

    // Beside the intro the road is a short stretch that travels with the bike (dashes scroll by
    // the distance ridden), kept inside the lane; on the band it is long and stays on the band.
    const fixed = smooth(band);
    const shift = -fixed * along;
    this.road.position.z = shift;
    this.road.material.map!.offset.y = (-(1 - fixed) * distance) / DASH_PERIOD;
    const ends = this.road.material.alphaMap!;
    const visibleLength = lerp(LANE_ROAD_LENGTH, ROAD_LENGTH, fixed);
    ends.repeat.y = ROAD_LENGTH / visibleLength;
    ends.offset.y = 0.5 - 0.5 * ends.repeat.y;
    this.road.material.opacity = shown;

    // Air (the first card): the paper plane crosses above the road early in the ride.
    const flight = clamp01(ride / 0.2);
    const planeOn = fixed * span(ride, 0, 0.03) * (1 - span(ride, 0.17, 0.2));
    this.plane.visible = planeOn > 0.01;
    if (this.plane.visible) {
      this.plane.position.set(1.4, lerp(1.2, 1.4, Math.sin(flight * Math.PI)), shift + lerp(-9, 9, flight));
      // Banked towards the camera so its wings read, levelling out as it goes.
      this.plane.rotation.set(-0.1, 0, lerp(0.7, 0.4, flight));
      this.planeMaterial.opacity = planeOn;
    }

    // Local delivery (the last card): the bike turns towards the visitor.
    return { yaw: -0.75 * span(ride, 0.84, 1) * fixed };
  }
}

/** Road surface across its width: soft shoulders and the orange centre dash (one dash period). */
function roadTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  if (g) {
    const shoulder = g.createLinearGradient(0, 0, 64, 0);
    shoulder.addColorStop(0, 'rgba(237, 225, 218, 0)');
    shoulder.addColorStop(0.12, 'rgba(237, 225, 218, 1)');
    shoulder.addColorStop(0.88, 'rgba(237, 225, 218, 1)');
    shoulder.addColorStop(1, 'rgba(237, 225, 218, 0)');
    g.fillStyle = shoulder;
    g.fillRect(0, 0, 64, 128);
    g.fillStyle = COLORS.dash;
    g.fillRect(30, 0, 4, 58);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Alpha along the road's length: fades out at both ends. */
function endsTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 128;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, '#000');
    grad.addColorStop(0.3, '#fff');
    grad.addColorStop(0.7, '#fff');
    grad.addColorStop(1, '#000');
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 128);
  }
  return new CanvasTexture(c);
}
