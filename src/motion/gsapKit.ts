// The motion chunk's GSAP part (MOTION_3D_SPEC §3): core + only the plugins in use. Never
// imported statically from the main bundle; `gsap.ts` loads it after first paint.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { CustomEase } from 'gsap/CustomEase';

export interface GsapKit {
  gsap: typeof gsap;
  ScrollTrigger: typeof ScrollTrigger;
  SplitText: typeof SplitText;
}

let registered = false;

export function createKit(): GsapKit {
  if (!registered) {
    gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);
    // The Journey's one camera ease (§6 timing rules).
    CustomEase.create('journey', '0.65,0,0.35,1');
    // Phones: the address bar showing/hiding must not re-measure every trigger.
    ScrollTrigger.config({ ignoreMobileResize: true });
    registered = true;
  }
  return { gsap, ScrollTrigger, SplitText };
}
