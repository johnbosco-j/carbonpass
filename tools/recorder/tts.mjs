#!/usr/bin/env node
// Draft voiceover with macOS text-to-speech (`say`), timed to the cut, for when there's no time to record a voice:
//   node tools/recorder/tts.mjs [--voice Daniel] [--rate 172] [--video docs/video/carbonpass-demo.mp4]
// Reads the narration cues from carbonpass-demo.timeline.json (written by record.mjs), synthesises each cue, speeds
// a cue up if it would run into the next one, places it at its timestamp, and writes:
//   docs/video/carbonpass-demo-tts.m4a   the narration track
//   docs/video/carbonpass-demo-tts.mp4   the video with it (video stream copied)
// A human voice is better; this is the fallback. Try voices with `say -v '?'` (Daniel, Samantha, Rishi, Moira…).
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { ffmpeg, probeDuration } from "./lib/ffmpeg.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const { values: a } = parseArgs({
  options: {
    video: { type: "string", default: path.join(ROOT, "docs/video/carbonpass-demo.mp4") },
    voice: { type: "string", default: "Daniel" },
    rate: { type: "string", default: "172" }, // words per minute
    "max-rate": { type: "string", default: "215" },
    work: { type: "string", default: path.join(HERE, "out", "tts") },
  },
});
if (process.platform !== "darwin") throw new Error("tts.mjs uses macOS `say`.");

const video = path.resolve(a.video);
const timeline = JSON.parse(fs.readFileSync(video.replace(/\.mp4$/, ".timeline.json"), "utf8"));
if (!timeline.cues?.length) throw new Error("No narration cues in the timeline. Re-run record.mjs (or --assemble-only) to regenerate it.");
const total = probeDuration(video);
const work = path.resolve(a.work);
fs.rmSync(work, { recursive: true, force: true });
fs.mkdirSync(work, { recursive: true });

/** Rewrites symbols and acronyms the way a narrator would say them. */
function speakable(text) {
  return text
    .replace(/tCO₂e\/t/g, "tonnes of C O 2 per tonne")
    .replace(/CO₂/g, "C O 2")
    .replace(/ML-DSA-65/g, "M L D S A 65")
    .replace(/ML-DSA/g, "M L D S A")
    .replace(/ERC-1155/g, "E R C 1155")
    .replace(/\bCBAM\b/g, "C-bam")
    .replace(/\bETS\b/g, "E T S")
    .replace(/\bECDSA\b/g, "E C D S A")
    .replace(/Türkiye/g, "Turkiye")
    .replace(/İzmir/g, "Izmir")
    .replace(/['‘’"“”]/g, "");
}

const cues = [...timeline.cues].sort((x, y) => x.start - y.start);
const rows = [];
for (const [i, c] of cues.entries()) {
  const slot = (cues[i + 1]?.start ?? total) - c.start - 0.2;
  const file = path.join(work, `cue_${String(i).padStart(2, "0")}.aiff`);
  let rate = Number(a.rate);
  let dur = 0;
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = spawnSync("say", ["-v", a.voice, "-r", String(rate), "-o", file, "--", speakable(c.text)], { encoding: "utf8" });
    if (r.status !== 0) throw new Error(`say failed (voice "${a.voice}"?): ${r.stderr}`);
    dur = probeDuration(file);
    if (dur <= slot || rate >= Number(a["max-rate"])) break;
    rate = Math.min(Number(a["max-rate"]), Math.ceil((rate * dur) / slot * 1.03));
  }
  rows.push({ i, file, start: c.start, slot, dur, rate, overrun: Math.max(0, dur - slot) });
}

// Mix: every cue delayed to its start, summed, padded/trimmed to the video, loudness-normalised.
const inputs = rows.flatMap((r) => ["-i", r.file]);
const delayed = rows.map((r, k) => `[${k}:a]aresample=48000,aformat=channel_layouts=mono,adelay=${Math.round(r.start * 1000)}[a${k}]`).join(";");
const mix = `${rows.map((_, k) => `[a${k}]`).join("")}amix=inputs=${rows.length}:normalize=0,apad,atrim=0:${total.toFixed(3)},loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[out]`;
const base = video.replace(/\.mp4$/, "");
const track = `${base}-tts.m4a`;
await ffmpeg([...inputs, "-filter_complex", `${delayed};${mix}`, "-map", "[out]", "-c:a", "aac", "-b:a", "160k", track]);
await ffmpeg(["-i", video, "-i", track, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "copy", "-shortest", "-movflags", "+faststart", `${base}-tts.mp4`]);

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
for (const r of rows) console.log(`  ${fmt(r.start)}  ${r.dur.toFixed(1).padStart(5)} s of ${r.slot.toFixed(1).padStart(5)} s  @${r.rate} wpm${r.overrun > 0.05 ? `  ⚠ runs ${r.overrun.toFixed(1)} s into the next cue` : ""}`);
console.log(`wrote ${path.relative(process.cwd(), `${base}-tts.mp4`)} (${probeDuration(`${base}-tts.mp4`).toFixed(1)} s, voice ${a.voice})`);
