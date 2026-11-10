// The Journey's DOM choreography (MOTION_3D_SPEC §6): chapter ScrollTriggers, pins, the
// progress the Stage (H.2) and the route rail read, chapter beats and headline line reveals.
// Loaded lazily with GSAP; every function here is a pure function of scroll position, so
// scrolling back up undoes exactly what scrolling down did.
import type { GsapKit } from './gsapKit';
import type { JourneyState, JourneyStore } from './JourneyController';

/** Pin length per chapter in viewport heights (§6). Chapters not listed aren't pinned. */
export const PIN_VH: Readonly<Record<number, number>> = { 1: 250, 2: 200, 3: 150, 4: 150, 5: 120 };
/** Phones get shorter pins (§8: ≈ 60% of desktop). */
const PHONE_MAX = 760;
const PHONE_FACTOR = 0.6;
/** Each pinned chapter: 15% arrive, 70% story, 15% leave (§6 timing rules). */
const ARRIVE = 0.15;
const LEAVE = 0.15;

/**
 * DOM beats inside pinned chapters, written as `data-beat` on the section (CSS styles them):
 * Services lights the card the bike is passing (1–6, none outside the story); In town moves the
 * Picked up / On the way / Delivered chip (1–3, kept before and after the story).
 */
const BEATS: Readonly<Record<number, { count: number; hold: boolean }>> = {
  1: { count: 6, hold: false },
  2: { count: 3, hold: true },
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function headerOffset(): number {
  const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tx-header-h'));
  return Number.isFinite(value) ? value : 72;
}

function beatOf(progress: number, { count, hold }: { count: number; hold: boolean }): string | null {
  const inStory = progress > ARRIVE && progress < 1 - LEAVE;
  if (!inStory && !hold) return null;
  const story = clamp01((progress - ARRIVE) / (1 - ARRIVE - LEAVE));
  return String(Math.min(count, Math.floor(story * count) + 1));
}

function setBeat(section: HTMLElement, value: string | null): void {
  if (value === null) {
    if (section.dataset.beat !== undefined) delete section.dataset.beat;
  } else if (section.dataset.beat !== value) {
    section.dataset.beat = value;
  }
}

/**
 * Builds one ScrollTrigger per chapter (`[data-chapter]` sections of `root`) and keeps `store`
 * up to date with { chapter, progress, travel }. With `pin`, chapters listed in PIN_VH are pinned
 * for their length. The element marked `data-pin` inside a chapter is what holds (its content,
 * without the section's padding; World: the map below it scrolls normally), else the section.
 * When it fits below the sticky header it holds centred in that space; when it's taller it holds
 * from its bottom, so a tall chapter is read in full before it holds.
 */
export function setupJourney(
  { ScrollTrigger }: GsapKit,
  root: HTMLElement,
  store: JourneyStore,
  { pin }: { pin: boolean },
): () => void {
  const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-chapter]'))
    .sort((a, b) => Number(a.dataset.chapter) - Number(b.dataset.chapter));
  if (!sections.length) return () => {};
  const chapters = sections.map((s) => Number(s.dataset.chapter));
  const isPhone = () => window.innerWidth <= PHONE_MAX;

  // Pins first, top to bottom, so every trigger below is measured with the spacers above it.
  const pins = sections.map((section, i) => {
    const vh = pin ? PIN_VH[chapters[i]] : undefined;
    if (!vh) return null;
    const target = section.querySelector<HTMLElement>('[data-pin]') ?? section;
    const room = () => window.innerHeight - headerOffset();
    const start = () => {
      const spare = room() - target.offsetHeight;
      return spare >= 0 ? `top ${Math.round(headerOffset() + spare / 2)}px` : 'bottom bottom';
    };
    return ScrollTrigger.create({
      trigger: target,
      pin: target,
      pinSpacing: true,
      invalidateOnRefresh: true,
      start,
      end: () => `+=${Math.round(((window.innerHeight * vh) / 100) * (isPhone() ? PHONE_FACTOR : 1))}`,
    });
  });

  // Where each chapter begins: its top crossing 40% of the viewport (same line the static rail uses).
  const marks = sections.map((section) =>
    ScrollTrigger.create({ trigger: section, start: 'top 40%', end: 'bottom 40%', invalidateOnRefresh: true }),
  );

  // Progress straight from the scroll position and the measured start/end: never a trigger's own
  // `progress`, which may not have been updated yet this frame (that would differ by direction).
  const progressAt = (st: { start: number; end: number }, y: number) =>
    st.end > st.start ? clamp01((y - st.start) / (st.end - st.start)) : y >= st.start ? 1 : 0;

  const update = () => {
    const y = marks[0].scroll();
    const max = ScrollTrigger.maxScroll(window);
    // Chapters that can't reach the 40% line (end of the page) begin at the bottom instead.
    const starts = marks.map((m, i) => (i === 0 ? 0 : Math.min(m.start, max)));
    let i = 0;
    for (let k = 1; k < starts.length; k++) if (y >= starts[k]) i = k;
    const next = starts[i + 1];
    const frac = next !== undefined && next > starts[i] ? clamp01((y - starts[i]) / (next - starts[i])) : 0;
    const travel = i + 1 < chapters.length ? chapters[i] + frac * (chapters[i + 1] - chapters[i]) : chapters[i];
    const own = pins[i] ?? marks[i];
    const state: JourneyState = { live: true, chapter: chapters[i], progress: progressAt(own, y), travel };
    store.set(state);
    pins.forEach((p, k) => {
      const beats = BEATS[chapters[k]];
      if (p && beats) setBeat(sections[k], beatOf(progressAt(p, y), beats));
    });
  };

  // One page-long trigger drives the updates; refreshed last so it measures the final page height.
  ScrollTrigger.create({ start: 0, end: 'max', refreshPriority: -1, onUpdate: update, onRefresh: update });
  ScrollTrigger.sort();
  ScrollTrigger.refresh();
  update();

  return () => {
    sections.forEach((s) => setBeat(s, null));
    store.reset();
  };
}

/**
 * Chapter headlines reveal line by line (§6: masked, 0.6 s, stagger 0.08) when they enter, and
 * hide again when scrolled back above. Only headlines still below the fold are split, so nothing
 * on screen blinks; SplitText re-splits on resize and after fonts load, and keeps an aria-label
 * with the full text on the heading.
 */
export function setupHeadlines({ gsap, ScrollTrigger, SplitText }: GsapKit, root: HTMLElement): void {
  const fold = window.innerHeight;
  root.querySelectorAll<HTMLElement>('[data-chapter] h2').forEach((heading) => {
    if (heading.getBoundingClientRect().top < fold) return;
    SplitText.create(heading, {
      type: 'lines',
      mask: 'lines',
      linesClass: 'tx-split-line',
      autoSplit: true,
      onSplit: (self) =>
        gsap.from(self.lines, {
          yPercent: 110,
          duration: 0.6,
          stagger: 0.08,
          ease: 'power3.out',
          scrollTrigger: { trigger: heading, start: 'top 85%', toggleActions: 'play none none reverse' },
        }),
    });
  });
  ScrollTrigger.sort();
  ScrollTrigger.refresh();
}
