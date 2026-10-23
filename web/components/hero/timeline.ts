/** Scroll timeline shared by the DOM beats and the 3D scene. `p` is pinned-scroll progress, 0 → 1. */

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** 0 → 1 as p goes from a to b */
export const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
export const smooth = (t: number) => t * t * (3 - 2 * t);
export const easeOut = (t: number) => 1 - (1 - t) ** 3;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The four beats of the story, as windows of scroll progress. */
export const BEATS = [
  { id: "price", start: 0, end: 0.22 },
  { id: "numbers", start: 0.26, end: 0.48 },
  { id: "contract", start: 0.53, end: 0.75 },
  { id: "cta", start: 0.8, end: 1 },
] as const;

/** Key moments, in progress units. */
export const T = {
  coilFrom: 0.02,
  coilTo: 0.46,
  keepFrom: 0.3,
  keepTo: 0.45,
  cardFrom: 0.47,
  cardTo: 0.6,
  condenseFrom: 0.5,
  condenseTo: 0.66,
  stampFrom: 0.655,
  stampTo: 0.69,
  revertAt: 0.66,
} as const;

/** Opacity / offset for a beat window: fades in over `fade`, out over `fade`. The first and last beats stay put at the ends. */
export function beatVisibility(p: number, i: number, fade = 0.035) {
  const b = BEATS[i];
  const inT = i === 0 ? 1 : smooth(seg(p, b.start - fade, b.start + fade));
  const outT = i === BEATS.length - 1 ? 0 : smooth(seg(p, b.end - fade, b.end + fade));
  return { opacity: inT * (1 - outT), shift: (1 - inT) * 28 - outT * 28 };
}

export function activeBeat(p: number) {
  let idx = 0;
  BEATS.forEach((b, i) => {
    if (p >= b.start - 0.02) idx = i;
  });
  return idx;
}
