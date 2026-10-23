#!/usr/bin/env node
// Lays a recorded voiceover over the silent demo video.
//   node tools/recorder/mux.mjs path/to/voiceover.m4a [--video docs/video/carbonpass-demo.mp4] [--out docs/video/carbonpass-demo-vo.mp4]
// The audio is padded with silence (or cut) to the video's length; the video stream is copied untouched.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { ffmpeg, probeDuration } from "./lib/ffmpeg.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    video: { type: "string", default: path.join(ROOT, "docs/video/carbonpass-demo.mp4") },
    out: { type: "string" },
    offset: { type: "string", default: "0" }, // seconds to delay (positive) or advance (negative) the voice
  },
});
const voice = positionals[0];
if (!voice) {
  console.error("Usage: node tools/recorder/mux.mjs path/to/voiceover.(m4a|wav|mp3) [--offset 0.5]");
  process.exit(1);
}
const out = values.out ?? values.video.replace(/\.mp4$/, "-vo.mp4");
const off = Number(values.offset);
const audioIn = off >= 0 ? ["-i", voice] : ["-ss", String(-off), "-i", voice];
const filter = off > 0 ? `adelay=${Math.round(off * 1000)}:all=1,apad` : "apad";
await ffmpeg(["-i", values.video, ...audioIn, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-af", filter, "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out]);
console.log(`wrote ${path.relative(process.cwd(), out)} (${probeDuration(out).toFixed(1)} s, video ${probeDuration(values.video).toFixed(1)} s)`);
