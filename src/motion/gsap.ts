// Lazy loader for GSAP (MOTION_3D_SPEC §5). The first call downloads the motion chunk and
// registers the plugins once; later calls reuse it.
import type { GsapKit } from './gsapKit';

export type { GsapKit };

let kit: GsapKit | null = null;
let pending: Promise<GsapKit> | null = null;

export function loadGsap(): Promise<GsapKit> {
  if (kit) return Promise.resolve(kit);
  if (!pending) {
    pending = import('./gsapKit')
      .then((m) => {
        kit = m.createKit();
        return kit;
      })
      .catch((err) => {
        pending = null;
        throw err;
      });
  }
  return pending;
}

/** GSAP if it has already been loaded, without triggering a download. */
export function loadedGsap(): GsapKit | null {
  return kit;
}
