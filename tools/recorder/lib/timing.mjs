// Shared timing model: how waits are sped up in the cut, and where each narration cue lands.
// The recorder uses it live (to hold a beat until its narration fits); the assembler uses it for the final cut.

export const DEFAULTS = {
  wps: 2.6, // narration speed, words per second (~155 wpm)
  cueGap: 0.35, // silence between narration cues, seconds
  speed: 4, // speed-up for block-confirmation waits
  maxWaitOut: 4, // a wait never lasts longer than this in the cut (speed rises above `speed` if needed)
  minWait: 1.5, // waits shorter than this play at 1×
};

export const words = (text) => (text ? text.trim().split(/\s+/).filter(Boolean).length : 0);
export const speakSeconds = (text, wps = DEFAULTS.wps) => words(text) / wps;

/** Speed factor for a wait of `dur` seconds (1 = untouched). */
export function waitSpeed(dur, o = DEFAULTS) {
  if (dur < o.minWait) return 1;
  return Math.max(o.speed, dur / o.maxWaitOut);
}

/** Cut duration of a recorded span [start, end] containing the given waits. */
export function cutDuration(start, end, waits = [], o = DEFAULTS) {
  let d = end - start;
  for (const w of waits) {
    const a = Math.max(start, w.start), b = Math.min(end, w.end);
    if (b <= a) continue;
    d -= (b - a) * (1 - 1 / waitSpeed(w.end - w.start, o));
  }
  return d;
}

/** Maps a raw recording time inside a beat to cut time relative to the beat's cut start. */
export function rawToCut(t, start, waits = [], o = DEFAULTS) {
  return cutDuration(start, Math.max(start, t), waits, o);
}

/**
 * Lays narration cues over a sequence of items with known cut durations.
 * items: [{ id, duration, narration, lead }] where `lead` is how many seconds the previous narration may run
 * into this item. Returns cues with start/end and each item's start; `needs[i]` is how long item i must last so
 * that its narration (and any spill from earlier items) ends within the next item's lead.
 */
export function planNarration(items, o = DEFAULTS) {
  const cues = [];
  const needs = [];
  let t = 0;
  let narrEnd = 0;
  items.forEach((it, i) => {
    const start = t;
    const s = Math.max(start, narrEnd > 0 ? narrEnd + o.cueGap : 0);
    const e = it.narration ? s + speakSeconds(it.narration, o.wps) : s;
    if (it.narration) cues.push({ id: it.id, start: s, end: e, text: it.narration });
    narrEnd = Math.max(narrEnd, e);
    const lead = items[i + 1]?.lead ?? 0;
    needs[i] = Math.max(0, narrEnd - lead - start);
    t = start + it.duration;
  });
  return { cues, needs, total: t };
}
