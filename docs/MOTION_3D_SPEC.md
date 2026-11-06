# Motion & 3D Specification: "The Journey" (GSAP + Three.js)

> Part of the TanEx plan (`docs/TANEX_PLAN.md`). Tracker phase **H**, built on the final layout from phase E.
> **Decisions (owner):** 2026-11-06 GSAP + Three.js for the landing page; **2026-11-06 (revision)** the 3D is not
> limited to the hero: the **whole homepage is one scroll-driven journey** in which a TanEx delivery bike carries the
> visitor down the page, in the manner of Apple and Nike product pages: simple, precise, professional.

**Goal.** As the visitor scrolls, a TanEx bike rides down the page and *is* the story: it leaves a door in Buea,
rides past the services, delivers across town, hands bigger loads to a truck, sends the parcel to the world by
plane, and ends at the recipient's door: **From Your Door to the World**, told by scrolling. It must feel calm and
expensive: few elements, exact timing, generous space, bold type, nothing that slows the page or hides content.

---

## 1. Principles

1. **Content first.** Every section is real HTML text that reads perfectly with motion off, JavaScript slow or WebGL
   unavailable. The 3D layer is decoration that explains; it never carries information alone.
2. **One stage, one hero object.** A single WebGL canvas (the *Stage*) sits fixed behind the homepage content for
   the whole scroll. The **bike** is the main object; the globe, truck and plane appear only in their chapters.
   One renderer, one context, one render loop.
3. **Scroll is the timeline.** Every 3D movement is scrubbed by scroll (GSAP ScrollTrigger, `scrub: 0.8`), so it is
   exactly reversible and never plays on its own, except a subtle idle (wheel spin, breathing light) that stops after
   5 s.
4. **Apple/Nike grammar:** pinned chapters with large headlines; text that reveals line by line beside an object that
   turns to show detail; strong contrast between full-bleed dark chapters and calm cream chapters; one idea per
   screen; precise easing; no gimmicks (no particles, bounce, glitch or neon).
5. **Transform and opacity only** for DOM motion; 3D is driven by uniform/transform updates, never by re-creating
   geometry during scroll.
6. **Respect the user:** `prefers-reduced-motion`, Save-Data, no WebGL or low-end device → no Stage, no pinning, no
   scrub, no smooth scroll; each chapter shows its **static poster** (a rendered frame) instead.
7. **Pause what can't be seen:** the render loop runs only while the Stage is visible and the tab is active, and
   renders only when something changed (scroll, resize, idle tween).

## 2. Performance budget (acceptance criteria)

| Metric (mobile, mid-range Android, 4G) | Target |
|---|---|
| Lighthouse Performance (Home) | ≥ 85 |
| Lighthouse Accessibility | ≥ 95 |
| LCP | ≤ 2.5 s. The LCP element is the hero headline or the hero poster, **never the canvas** |
| CLS | ≤ 0.05 (Stage is `position: fixed`, posters have fixed boxes) |
| INP | ≤ 200 ms (no long tasks during scroll; scene setup chunked with `requestIdleCallback`) |
| Main public JS (gzip, excluding motion, 3D, console, courier, editor chunks) | ≤ 250 KB |
| Motion chunk: GSAP core + ScrollTrigger + used plugins + DOM choreography (gzip) | ≤ 70 KB, after first paint |
| 3D chunk: three (tree-shaken) + Stage + all chapter scenes (gzip) | ≤ 220 KB, on idle after LCP, capable devices only |
| 3D assets: bike, truck, plane, box (glTF + meshopt/Draco) + textures (KTX2 or small WebP) | ≤ 450 KB total, streamed by chapter (bike first) |
| Frame time | ≤ 8 ms per frame on a mid-range phone; 60 fps target; DPR capped at 1.5 (1.25 on mobile) |
| Memory | No growth after 10 route changes; Stage fully disposed when leaving Home |

If a budget fails, simplify the scene (fewer arcs, lower DPR, cheaper materials, poster on mobile for that chapter).
Do not trade away LCP or INP.

## 3. Dependencies

| Package | Why | Notes |
|---|---|---|
| `gsap` | Timelines, ScrollTrigger, SplitText, MotionPathPlugin, DrawSVGPlugin, CustomEase | Free for commercial use, plugins included. Register only those used. |
| `three` | The Stage | Vanilla Three.js, no React wrapper: GSAP drives it directly. Import from `three` and `three/examples/jsm/...` only what's used (GLTFLoader, MeshoptDecoder/DRACOLoader, KTX2Loader if used). |
| `lenis` | Smooth inertial scroll synced to ScrollTrigger | Desktop only; off for touch and reduced motion; maps/modals `data-lenis-prevent`. |

## 4. The models

| Model | Look | Source |
|---|---|---|
| **TanEx bike + rider** | Clean low-poly, matte materials: a commuter motorbike as used for in-town delivery in Cameroon; rider in the **brown TanEx vest** with helmet; **orange top box** with the paper-plane mark; rounded, friendly, not cartoonish | **Commissioned 3D asset** (recommended, see tracker #117): Blender → glTF, ≤ 8k triangles, 1 material atlas, pivots: wheels, handlebar, rider torso, box lid. **Fallback until delivered:** a stylised bike assembled from Three.js primitives (tori, capsules, boxes) in the same palette so the Journey ships on time |
| **Truck** | Same style, light box truck with orange stripe and wordmark | Commissioned with the bike, or primitives |
| **Paper plane** | The logo mark in 3D, folded geometry | Built in code (≈ 10 triangles) |
| **Parcel box** | Cardboard with a TanEx label (barcode texture `TX7K2M9P`) | Built in code + one texture |
| **Globe** | Cream sphere, chocolate dotted continents, orange arcs | Built in code + ≤ 25 KB dots file |

Materials: `MeshStandardMaterial`, one hemisphere light + one directional light with baked-looking soft shadow
(a blurred shadow plane, not real-time shadow maps). Colours only from BRAND_GUIDE §4. Tone: warm, matte, premium.

## 5. Architecture (`src/motion/`)

| File | Purpose |
|---|---|
| `capabilities.ts` | `canAnimate()` (no reduced motion / Save-Data) and `canUseStage()` (WebGL2, `deviceMemory ≥ 4` when reported, `hardwareConcurrency ≥ 4`, not a known low-power GPU, viewport ≥ 360 px) |
| `gsap.ts` | Lazy loader; registers plugins once |
| `useGsapContext.ts` | `gsap.context()` scoped to a ref; reverted on unmount |
| `stage/Stage.ts` | One renderer + scene + camera; `mount(canvas)`, `setChapter(id, progress)`, `resize()`, `pause()`, `dispose()`; renders on demand |
| `stage/assets.ts` | Loads models/textures by chapter with priorities; bike first; shows the poster until a chapter's assets are ready |
| `stage/chapters/*.ts` | One file per chapter (§6): `enter()`, `update(progress)`, `leave()`; pure functions of progress (reversible) |
| `stage/camera.ts` | Camera rails: each chapter defines keyframes (position, target, FOV) interpolated with CatmullRom curves |
| `JourneyController.tsx` | Builds the ScrollTriggers from section refs, maps scroll → chapter + progress, drives Stage and DOM timelines, owns the route rail |
| `RouteRail.tsx` | The vertical route line with the small bike icon (§7), also the chapter navigation |
| `posters/` | Static WebP/AVIF frame per chapter (rendered from the Stage with a script) for fallback and pre-load |
| `SmoothScroll.tsx`, `useReveal.ts`, `motion.css` | Lenis provider, batch reveals for inner pages, reduced-motion overrides |

The **page layout reserves a "lane"** for the bike: on desktop the 3D lane alternates sides (content left / lane
right, then swaps) so text never sits under the bike; on mobile the bike appears in a band between text blocks.
This is designed in C.1 and built in E.1. Text blocks get a solid or strongly-tinted backdrop where they overlap
the Stage, so contrast never depends on the 3D frame.

## 6. The Journey: chapters (homepage sections from CONTENT §2)

Durations are in viewport heights of scroll (vh). "Pinned" means the section sticks while its timeline scrubs.
Desktop first; mobile adaptations in §8.

| # | Section | Pin | What the visitor sees as they scroll |
|---|---|---|---|
| 0 | **Hero** (§2.1) | no (100 vh) | First paint: headline + track field over the hero poster. The Stage fades in on idle: the cream globe slowly turning, Cameroon lit, orange arcs drawing to world hubs, the paper plane gliding. On first scroll the camera **dives toward Buea**: the globe fills the frame, cross-fades to a street at a **front door**, and the **bike pulls up** in front of it. "From your door…" |
| 1 | **Services** (§2.2) | 250 vh | The bike rides **down a winding road that runs through the section**, in the lane. As it passes each of the six service cards, the card lights up (reveal + icon animation) and the bike's shadow sweeps across it. Air: the plane crosses overhead. Maritime: the road passes a quay. Rail: a train passes on a parallel track. Road: a truck overtakes. Warehousing: shelves slide by. Local delivery: the bike turns to camera. Progress dots show 1–6. |
| 2 | **Bike delivery** (§2.3) | 200 vh | Apple-style product moment on a **dark chocolate** chapter: the bike stops centre-stage; the camera **orbits** slowly (side → three-quarter → rear box); the **top box opens** to show the parcel; text lines reveal beside it: *Picked up · On the way · Delivered*, each step synced to a beat (box closes, wheels turn, rider glances at the phone holder where a small map with a moving dot appears). Ends with the bike riding out of frame. |
| 3 | **Truck delivery** (§2.4) | 150 vh | Cream chapter: the bike **hands the parcel to a TanEx truck** (box lifted across), the camera pulls back to a stylised road with pins **Limbe · Buea · Douala**; the truck drives the route as you scroll, pins checking off. |
| 4 | **Global network** (§2.5) | 150 vh then releases | The camera **rises from the road to orbit**: the globe returns, the parcel boards the **paper plane** at Douala, which flies an arc to a world hub while the other lanes draw. Then the interactive Leaflet network map (real, usable) slides in below the Stage as a normal section. |
| 5 | **Smart labels** (§2.6) | 120 vh | The **parcel box** fills the frame and rotates to its label; the barcode bars draw, a scan beam passes, and the tracking ID `TX7K2M9P` types in beside it; the three capability tiles reveal. |
| 6 | **Get in touch** (§2.7) | no | The Stage calms: the bike rides back in and **parks** in the lane with an idle wheel, beside the form. Nothing moves while the visitor types (the loop stops on focus). |
| 7 | **FAQ** (§2.8) and **Blog** (§2.9) | no | Stage dimmed to a still frame (or hidden on mobile); light DOM reveals only. Reading comes first. |
| 8 | **Footer** | no | The bike rides the last metres and **stops at a front door**; the box opens: "Delivered." The footer's paper-plane mark draws its speed lines. The journey has come full circle: door to world, and back to a door. |

Copy for chapter beats and the route rail: CONTENT §2.10 / CONTENT_FR §2.10.

**Timing rules.** Each pinned chapter: 15% "arrive", 70% "story", 15% "leave", so chapters hand over without
dead scroll. Headlines use SplitText line reveals (masked, 0.6 s, stagger 0.08). Camera moves use one custom ease
(`CustomEase "journey"` ≈ `0.65, 0, 0.35, 1`). Never more than one camera move and one text reveal at a time.

## 7. The route rail (always-on guide)

A thin vertical route line on the right edge (desktop) with the **small bike icon** travelling down it as the page
scrolls, and a dot per chapter (Door · Services · In town · City to city · World · Label · Contact · Delivered).
- It's the light version of the Journey: it works even when the Stage is off (reduced motion shows it static with
  the current chapter highlighted).
- Dots are real links (`<nav aria-label="Page sections">`) that scroll to the chapter; keyboard-focusable.
- Mobile: a slim top progress bar with the bike icon instead.

## 8. Mobile and fallbacks

| Situation | Behaviour |
|---|---|
| Capable phone (canUseStage) | Same chapters, shorter pins (≈ 60% of desktop vh), simpler camera paths, DPR 1.25, no orbit in chapter 2 (three fixed angles cross-faded), the Services road becomes a vertical lane between cards |
| Low-end phone / no WebGL | No Stage. Each chapter shows its **poster** with light DOM reveals; the route rail/progress bar still runs. The SVG versions of the bike and truck scenes (2D, GSAP) are used for chapters 2–3 |
| Reduced motion / Save-Data | Posters only, no pinning, no scrub, reveals ≤ 200 ms fades, rail static |
| WebGL context lost | Swap to posters instantly, keep scrolling smooth |
| Leaving Home | Stage disposed (geometries, materials, textures, renderer), ScrollTriggers killed |

## 9. Other pages

Not the Journey. Page heroes: headline line reveal + subtle parallax (≤ 40 px). Content: batch reveals. A small
static bike on the route rail is shared site-wide as a scroll-progress indicator on long pages (Services, Help,
blog articles). Track Result: stepper fill; local jobs interpolate the courier marker between polls (1 s).
Console and courier app: no decorative motion; feedback transitions only (≤ 200 ms). Route changes: 200 ms fade.

## 10. Accessibility

- The Stage canvas is `aria-hidden="true"`, `pointer-events: none`; every message is in the DOM in reading order.
- Pinned chapters never trap focus; skip links work; the route rail gives keyboard chapter navigation.
- A visible **Pause motion** control (hero and route rail) stops the Stage idle and switches to scroll-only updates;
  the preference is remembered (`tx_motion_paused`).
- No flashes above 3 per second; no autoplay longer than 5 s (WCAG 2.2.2).

## 11. QA checklist (phase H)

Lighthouse mobile ×3 median on Home meets §2 · scroll down and back up: every chapter is exactly reversible ·
fast fling scroll never shows a blank or broken frame · chapters line up at 375 / 768 / 1440 / 1920 px and on
window resize · reduced motion, Save-Data, no-WebGL and context-loss paths · no memory growth after 10 route changes ·
60 fps at 4× CPU slowdown in DevTools · Safari iOS, Chrome Android (mid-range), Samsung Internet, Firefox ·
text contrast over the Stage ≥ 4.5:1 in every frame.
