// Fading a model in and out (MOTION_3D_SPEC §2). Blended transparency is expensive here: with the
// bike's 29 materials always transparent the frame CPU time tripled (measured in H.4), and the
// truck fading in by blending cost p95 ≈ 10 ms. So a model's materials stay opaque, and only while
// it is partly faded they use a dithered fade (three.js `alphaHash`): still drawn in the opaque
// pass with depth, no sorting, no blending. Three.js compiles a separate shader for that mode; the
// Stage compiles both up front (`setTransparent` around its compile pass), so switching never
// compiles during a scroll.
import type { Material } from 'three';

export class Fade {
  private readonly materials: Material[];
  private opacity = 1;
  private dithered = false;

  constructor(materials: Iterable<Material>) {
    this.materials = [...materials];
  }

  /** Opacity 0–1: opaque at 1, dithered below. */
  set(opacity: number): void {
    if (opacity === this.opacity) return;
    this.opacity = opacity;
    this.setTransparent(opacity < 0.999);
    this.materials.forEach((m) => (m.opacity = opacity));
  }

  /** Switches the materials to the dithered (fadeable) mode or back; the Stage also uses it to compile both. */
  setTransparent(on: boolean): void {
    if (on === this.dithered) return;
    this.dithered = on;
    this.materials.forEach((m) => {
      m.alphaHash = on;
      m.needsUpdate = true;
    });
  }

  /** Back to the mode the current opacity needs (after compiling both). */
  restore(): void {
    this.setTransparent(this.opacity < 0.999);
  }
}
