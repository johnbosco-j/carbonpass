// Cuts the raw app recording into segments (block-confirmation waits sped up and tagged), interleaves the card
// clips, concatenates everything into one H.264 mp4, and writes the SRT, VOICEOVER.md and a timeline log.
import fs from "node:fs";
import path from "node:path";
import { ffmpeg, probeDuration } from "./ffmpeg.mjs";
import { planNarration, waitSpeed, cutDuration, words, DEFAULTS } from "./timing.mjs";

export const FPS = 25;
export const ENCODE = ["-an", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-profile:v", "high", "-r", String(FPS), "-g", String(FPS * 2), "-video_track_timescale", "12800"];
const PAPER = "0xF6F4EE";
const FADE = 0.35;

/** Splits a recorded beat into 1× and sped-up segments (raw-recording times). */
export function beatSegments(beat, o = DEFAULTS) {
  const segs = [];
  let t = beat.start;
  const waits = (beat.waits ?? []).filter((w) => w.end > beat.start && w.start < beat.end).sort((a, b) => a.start - b.start);
  for (const w of waits) {
    const speed = waitSpeed(w.end - w.start, o);
    if (speed === 1) continue;
    const a = Math.max(t, w.start);
    if (a > t) segs.push({ a: t, b: a, speed: 1 });
    segs.push({ a, b: Math.min(beat.end, w.end), speed, wait: w });
    t = Math.min(beat.end, w.end);
  }
  if (beat.end > t) segs.push({ a: t, b: beat.end, speed: 1 });
  return segs.filter((s) => s.b - s.a > 0.04);
}

/** Resolves narration (string or ctx => string). */
export const narrationOf = (item, ctx) => (typeof item.narration === "function" ? item.narration(ctx ?? {}) : item.narration ?? "");

/** Durations for `fit` cards, sized so the narration running into them has room. */
export function fitCardDurations(timeline, rec, o = DEFAULTS) {
  const items = [];
  const out = {};
  for (const it of timeline) {
    let duration;
    if (it.kind === "card") {
      if (it.fit) {
        const { needs } = planNarration([...items, { id: it.id, duration: 0, narration: narrationOf(it, rec.ctx), lead: it.lead ?? 0.5 }], o);
        duration = Math.min(it.fit.max, Math.max(it.fit.min, needs[items.length] + 1.2));
      } else duration = it.duration;
      out[it.id] = +duration.toFixed(2);
    } else {
      const b = rec.beats.find((x) => x.id === it.id);
      duration = b ? cutDuration(b.start, b.end, b.waits, o) : 0;
    }
    items.push({ id: it.id, duration, narration: narrationOf(it, rec.ctx), lead: it.lead ?? 0.5 });
  }
  return out;
}

const pool = async (jobs, n) => {
  const results = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < jobs.length) {
        const k = i++;
        results[k] = await jobs[k]();
      }
    }),
  );
  return results;
};

export async function assemble({ timeline, rec, cardClips, tagFor, workDir, outDir, name = "carbonpass-demo", o = DEFAULTS, log = console.log }) {
  const segDir = path.join(workDir, "segments");
  fs.rmSync(segDir, { recursive: true, force: true });
  fs.mkdirSync(segDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  // 1. Plan segments in timeline order.
  const plan = [];
  timeline.forEach((it, idx) => {
    if (it.kind === "card") {
      plan.push({ item: it.id, kind: "card", file: cardClips[it.id] });
      return;
    }
    const beat = rec.beats.find((b) => b.id === it.id);
    if (!beat) throw new Error(`No recording for beat "${it.id}". Re-record or remove it from beats.mjs.`);
    const segs = beatSegments(beat, o);
    const prevCard = timeline[idx - 1]?.kind === "card";
    const nextCard = !timeline[idx + 1] || timeline[idx + 1].kind === "card";
    segs.forEach((s, j) => plan.push({ item: it.id, kind: "app", ...s, fadeIn: prevCard && j === 0, fadeOut: nextCard && j === segs.length - 1 }));
  });

  // 2. Encode app segments (cards are already encoded with the same settings).
  const tags = new Map();
  for (const p of plan) if (p.wait) tags.set(p, await tagFor({ kind: p.wait.kind ?? "chain", speed: p.speed }));
  const jobs = plan.map((p, i) => async () => {
    if (p.kind === "card") return p.file;
    const out = path.join(segDir, `seg_${String(i).padStart(3, "0")}_${p.item}.mp4`);
    const dur = Math.max(1 / FPS, Math.round(((p.b - p.a) / p.speed) * FPS) / FPS);
    const from = Math.max(0, p.a + rec.offset);
    let v = `[0:v]setpts=(PTS-STARTPTS)/${p.speed.toFixed(4)},fps=${FPS},format=yuv420p`;
    const inputs = ["-ss", from.toFixed(3), "-t", (p.b - p.a).toFixed(3), "-i", rec.video];
    let graph;
    if (tags.has(p)) {
      inputs.push("-loop", "1", "-framerate", String(FPS), "-t", dur.toFixed(3), "-i", tags.get(p));
      const f = Math.min(0.2, dur / 4);
      graph = `${v}[v];[1:v]format=rgba,fade=t=in:st=0:d=${f}:alpha=1,fade=t=out:st=${(dur - f).toFixed(3)}:d=${f}:alpha=1[t];[v][t]overlay=x=(W-w)/2:y=118:shortest=1`;
    } else graph = v;
    if (p.fadeIn) graph += `,fade=t=in:st=0:d=${FADE}:color=${PAPER}`;
    if (p.fadeOut) graph += `,fade=t=out:st=${Math.max(0, dur - FADE).toFixed(3)}:d=${FADE}:color=${PAPER}`;
    await ffmpeg([...inputs, "-filter_complex", `${graph}[o]`, "-map", "[o]", "-t", dur.toFixed(3), ...ENCODE, out]);
    return out;
  });
  log(`  encoding ${jobs.length} segments…`);
  const files = await pool(jobs, 4);

  // 3. Concatenate.
  const list = path.join(workDir, "concat.txt");
  fs.writeFileSync(list, files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n") + "\n");
  const mp4 = path.join(outDir, `${name}.mp4`);
  await ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", mp4]);

  // 4. Exact cut times from the encoded segments.
  const durations = files.map((f) => probeDuration(f));
  const items = [];
  const cut = [];
  let t = 0;
  plan.forEach((p, i) => {
    const d = durations[i];
    let it = items.find((x) => x.id === p.item);
    if (!it) {
      const def = timeline.find((x) => x.id === p.item);
      it = { id: p.item, kind: def.kind, start: t, duration: 0, narration: narrationOf(def, rec.ctx), lead: def.lead ?? 0.5, screen: def.screen ?? "" };
      items.push(it);
    }
    it.duration += d;
    cut.push({ item: p.item, kind: p.kind, rawStart: p.a ?? null, rawEnd: p.b ?? null, speed: p.speed ?? 1, wait: p.wait?.label ?? null, cutStart: +t.toFixed(3), cutEnd: +(t + d).toFixed(3) });
    t += d;
  });
  const total = probeDuration(mp4);
  const { cues } = planNarration(items, o);

  // 5. Docs.
  fs.writeFileSync(path.join(outDir, `${name}.srt`), toSrt(cues));
  fs.writeFileSync(path.join(outDir, "VOICEOVER.md"), voiceover({ items, cues, total, name, o }));
  fs.writeFileSync(
    path.join(outDir, `${name}.timeline.json`),
    JSON.stringify(
      {
        generated: new Date().toISOString(),
        base: rec.base,
        total: +total.toFixed(2),
        items: items.map(({ narration, ...x }) => ({ ...x, start: +x.start.toFixed(2), duration: +x.duration.toFixed(2) })),
        segments: cut,
        rawBeats: rec.beats,
      },
      null,
      2,
    ) + "\n",
  );
  return { mp4, total, items, cues, size: fs.statSync(mp4).size };
}

// ------------------------------------------------------------------ text outputs

export const ts = (s, ms = true) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const p = (x, n = 2) => String(x).padStart(n, "0");
  return ms ? `${p(h)}:${p(m)}:${p(Math.floor(sec))},${p(Math.round((sec % 1) * 1000) % 1000, 3)}` : `${m}:${p(Math.floor(sec))}`;
};

/** Splits cue text into subtitle-sized chunks (≤ 2 lines of ~42 chars), timed by word share. */
function chunks(text) {
  const out = [];
  for (const sentence of text.match(/[^.!?]+[.!?]+["')]*|[^.!?]+$/g) ?? [text]) {
    let s = sentence.trim();
    while (s.length > 84) {
      let cut = s.lastIndexOf(", ", 84);
      if (cut < 30) cut = s.lastIndexOf(" ", 84);
      out.push(s.slice(0, cut + 1).trim());
      s = s.slice(cut + 1).trim();
    }
    if (s) out.push(s);
  }
  return out;
}

const wrap = (s) => {
  if (s.length <= 42) return s;
  const mid = s.length / 2;
  let best = -1;
  for (let i = 0; i < s.length; i++) if (s[i] === " " && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  return best > 0 ? `${s.slice(0, best)}\n${s.slice(best + 1)}` : s;
};

export function toSrt(cues) {
  let n = 1;
  const lines = [];
  for (const c of cues) {
    const parts = chunks(c.text);
    const total = parts.reduce((a, p) => a + words(p), 0);
    let t = c.start;
    for (const p of parts) {
      const d = ((c.end - c.start) * words(p)) / total;
      lines.push(`${n++}\n${ts(t)} --> ${ts(t + d)}\n${wrap(p)}\n`);
      t += d;
    }
  }
  return lines.join("\n");
}

function voiceover({ items, cues, total, name, o }) {
  const rows = cues.map((c) => {
    const it = items.find((x) => x.id === c.id);
    return `| **${ts(c.start, false)}** – ${ts(c.end, false)} | ${it?.screen ?? ""} | ${c.text} |`;
  });
  const wordsTotal = cues.reduce((a, c) => a + words(c.text), 0);
  const plan = items.map((it) => `| ${ts(it.start, false)} | ${ts(it.start + it.duration, false)} | ${it.kind} | \`${it.id}\` | ${it.screen} |`);
  return `# Voiceover script: ${name}.mp4

Generated by \`tools/recorder\` (\`node tools/recorder/record.mjs\`). Re-run it after a new recording; this file is re-timed to the cut every time.

- Video length: **${ts(total, false)}** (${total.toFixed(1)} s), no audio track.
- Narration: ${wordsTotal} words at about ${Math.round(o.wps * 60)} words per minute. Start each block at its timestamp; the end time is when you should be done. Short silences between blocks are fine.
- The burned-in captions summarise each step, so the voice can be conversational rather than read word for word.
- \`${name}.srt\` holds the same narration as subtitles (upload it to YouTube as captions).

## Script

| Start – end | On screen | Say |
|---|---|---|
${rows.join("\n")}

## Recording tips

1. Play \`docs/video/${name}.mp4\` in QuickTime or VLC with the SRT loaded (VLC: Subtitle → Add Subtitle File) and read along once as a rehearsal.
2. Record the voice in one take while the video plays (QuickTime → File → New Audio Recording, or Audacity). Leave about one second of silence at the very start, then trim it so speech starts at 0:00.
3. Mux it (below). Keep the video exactly as is; the audio is padded with silence to the video's length.

## Mux the voiceover

\`\`\`bash
node tools/recorder/mux.mjs path/to/voiceover.m4a
\`\`\`

That writes \`docs/video/${name}-vo.mp4\`. The equivalent raw ffmpeg command:

\`\`\`bash
ffmpeg -i docs/video/${name}.mp4 -i path/to/voiceover.m4a -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -af apad -shortest -movflags +faststart docs/video/${name}-vo.mp4
\`\`\`

If ffmpeg fails with \`Library not loaded: …libx265…dylib\` (a broken Homebrew upgrade), prefix it with \`DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/Cellar/x265/4.2/lib\` or just use \`mux.mjs\`, which does that for you.

## Cut list

| Start | End | Kind | Item | On screen |
|---|---|---|---|---|
${plan.join("\n")}
`;
}
