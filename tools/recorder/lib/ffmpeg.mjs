// Finds a working ffmpeg/ffprobe (used for capture, card clips and assembly).
//
// Homebrew upgrades sometimes leave ffmpeg linked against an x265 dylib version that is gone
// ("Library not loaded: .../libx265.216.dylib"). If plain `ffmpeg` fails, we retry with each installed
// x265 keg on DYLD_FALLBACK_LIBRARY_PATH. Nothing on the system is modified.
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

function kegLibDirs() {
  const dirs = [];
  for (const cellar of ["/opt/homebrew/Cellar", "/usr/local/Cellar"]) {
    const x265 = path.join(cellar, "x265");
    if (!fs.existsSync(x265)) continue;
    for (const v of fs.readdirSync(x265).sort().reverse()) dirs.push(path.join(x265, v, "lib"));
  }
  return dirs;
}

let cached;
export function findFfmpeg() {
  if (cached) return cached;
  const bins = [process.env.FFMPEG, "ffmpeg", "/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"].filter(Boolean);
  for (const bin of bins) {
    for (const lib of [null, ...kegLibDirs()]) {
      const env = lib ? { ...process.env, DYLD_FALLBACK_LIBRARY_PATH: lib } : { ...process.env };
      const r = spawnSync(bin, ["-hide_banner", "-version"], { env, encoding: "utf8" });
      if (r.status === 0) {
        const probe = process.env.FFPROBE ?? (bin.includes("/") ? path.join(path.dirname(bin), "ffprobe") : "ffprobe");
        cached = { ffmpeg: bin, ffprobe: probe, env, libDir: lib };
        return cached;
      }
    }
  }
  throw new Error("No working ffmpeg found. Install it (brew install ffmpeg) or set FFMPEG=/path/to/ffmpeg.");
}

/** Runs ffmpeg; rejects with the tail of stderr on failure. */
export function ffmpeg(args, { quiet = true } = {}) {
  const { ffmpeg: bin, env } = findFfmpeg();
  return new Promise((resolve, reject) => {
    const p = spawn(bin, ["-hide_banner", "-loglevel", quiet ? "error" : "info", "-y", ...args], { env, stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${args.join(" ")}\n${err.slice(-2000)}`))));
  });
}

export function probeDuration(file) {
  const { ffprobe, env } = findFfmpeg();
  const r = spawnSync(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file], { env, encoding: "utf8" });
  const d = Number(r.stdout.trim());
  if (!Number.isFinite(d)) throw new Error(`ffprobe failed on ${file}: ${r.stderr}`);
  return d;
}
