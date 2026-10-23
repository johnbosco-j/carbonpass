#!/usr/bin/env node
// Records the CarbonPass demo end to end as a captioned 1080p video, renders the title/explainer cards, and
// assembles docs/video/carbonpass-demo.mp4 + .srt + VOICEOVER.md. Only the voiceover is left to record.
//
//   node tools/recorder/record.mjs --base https://carbonpass.vercel.app
//   node tools/recorder/record.mjs --base http://localhost:3104 --headed
//   node tools/recorder/record.mjs --assemble-only          (re-cut the last recording, e.g. after editing cards)
//
// See tools/recorder/README.md.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { TIMELINE } from "./beats.mjs";
import { Director } from "./lib/director.mjs";
import { findFfmpeg } from "./lib/ffmpeg.mjs";
import { launch, recordedPage, browserPath, rel } from "./lib/capture.mjs";
import { renderCard, renderTag } from "./lib/cards.mjs";
import { assemble, fitCardDurations, narrationOf, ts } from "./lib/assemble.mjs";
import { DEFAULTS, cutDuration, planNarration } from "./lib/timing.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { values: a } = parseArgs({
  options: {
    base: { type: "string", default: process.env.DEMO_BASE ?? "http://localhost:3104" },
    out: { type: "string", default: path.join(ROOT, "docs/video") },
    work: { type: "string", default: path.join(HERE, "out") },
    name: { type: "string", default: "carbonpass-demo" },
    zoom: { type: "string", default: "1.25" },
    speed: { type: "string", default: String(DEFAULTS.speed) },
    "max-wait": { type: "string", default: String(DEFAULTS.maxWaitOut) },
    wps: { type: "string", default: String(DEFAULTS.wps) },
    pace: { type: "string", default: "1" },
    timeout: { type: "string", default: "240" },
    headed: { type: "boolean", default: false },
    "assemble-only": { type: "boolean", default: false },
    "record-only": { type: "boolean", default: false },
    "no-warmup": { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (a.help) {
  console.log(`Usage: node tools/recorder/record.mjs [--base URL] [options]

  --base URL         deployment to record (default http://localhost:3104, env DEMO_BASE)
  --out DIR          where the mp4/srt/VOICEOVER.md go (default docs/video)
  --zoom 1.25        page zoom; the viewport is 1920/zoom × 1080/zoom CSS px, captured at 1920×1080
  --speed 4          speed-up for transaction waits; --max-wait 4 caps any wait at 4 s in the cut
  --wps 2.6          narration pace (words/second) used to hold beats long enough for the voiceover
  --pace 1           multiplies deliberate reading pauses (0.5 for a quick dry run)
  --timeout 240      seconds to wait for any single confirmation
  --headed           show the browser while recording
  --record-only      record the app flow, skip cards and assembly
  --assemble-only    reuse the last recording (tools/recorder/out/recording.json)
  --no-warmup        skip pre-visiting pages (useful on a warm production deployment)`);
  process.exit(0);
}

const base = a.base.replace(/\/$/, "");
const work = path.resolve(a.work);
const outDir = path.resolve(a.out);
const zoom = Number(a.zoom);
const o = { ...DEFAULTS, speed: Number(a.speed), maxWaitOut: Number(a["max-wait"]), wps: Number(a.wps) };
const log = (...m) => console.log(...m);
fs.mkdirSync(work, { recursive: true });

// ------------------------------------------------------------------ preflight

async function preflight() {
  const res = await fetch(`${base}/api/state`, { cache: "no-store" }).catch((e) => {
    throw new Error(`Can't reach ${base}/api/state (${e.message}). Is the app running?`);
  });
  const state = await res.json();
  if (!res.ok) throw new Error(`${base}/api/state: ${state.error ?? res.status}`);
  const mine = state.batches.filter((b) => b.status !== "Rejected");
  const last = mine.length ? Math.max(...mine.map((b) => b.periodEnd)) : 0;
  const lastMonth = last ? new Date(last * 1000).toISOString().slice(0, 7) : "none";
  log(`  ${state.network} (chain ${state.chainId}), block #${state.latestBlock}, ${state.batches.length} batches, last certified month ${lastMonth}`);
  if (lastMonth !== "2026-06") log("  ⚠ The narration assumes July 2026 is the next free month (fresh deploy + seed). Recording anyway.");
  return state;
}

async function warmup(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  for (const p of ["/", "/producer", "/verifier", "/shipments", "/importer", "/passport", "/passport/1"]) {
    const t = Date.now();
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/state"), { timeout: 90_000 }).catch(() => {}),
      page.goto(base + p, { waitUntil: "load", timeout: 120_000 }),
    ]);
    log(`  warm ${p} (${((Date.now() - t) / 1000).toFixed(1)} s)`);
  }
  await ctx.close();
}

// ------------------------------------------------------------------ app recording

async function recordApp(browser) {
  const viewport = { width: Math.round(1920 / zoom), height: Math.round(1080 / zoom) };
  const video = path.join(work, "raw", "app.mkv");
  fs.rmSync(path.dirname(video), { recursive: true, force: true });
  const rec = await recordedPage(browser, { file: video, viewport, deviceScaleFactor: zoom, initScript: path.join(HERE, "lib/overlay.js") });
  const d = new Director(rec.page, { base, log, timeoutMs: Number(a.timeout) * 1000, pace: Number(a.pace) });
  d.t0 = rec.tOpen;
  const consoleLog = [];
  rec.page.on("console", (m) => m.type() === "error" && consoleLog.push(`[${d.now().toFixed(1)}] ${m.text()}`));
  rec.page.on("pageerror", (e) => consoleLog.push(`[${d.now().toFixed(1)}] pageerror ${e.message}`));

  const beats = [];
  const items = [];
  let failed = null;
  for (const [i, it] of TIMELINE.entries()) {
    const lead = it.lead ?? 0.5;
    if (it.kind === "card") {
      items.push({ id: it.id, duration: it.duration ?? it.fit?.min ?? 8, narration: narrationOf(it, d.ctx), lead });
      continue;
    }
    d.beat = it;
    d.waits = [];
    const start = d.now();
    d.mark("beat-start");
    try {
      await it.run(d, d.ctx);
    } catch (e) {
      failed = e;
      const shot = path.join(work, `error-${it.id}.png`);
      await rec.page.screenshot({ path: shot }).catch(() => {});
      log(`  ✗ ${it.id}: ${e.message}\n    screenshot: ${rel(ROOT, shot)}`);
      beats.push({ id: it.id, start, end: d.now(), waits: d.waits, failed: true });
      break;
    }
    // Hold on the beat's last frame until its narration (plus any spill from earlier items) fits.
    const narration = narrationOf(it, d.ctx);
    const next = TIMELINE[i + 1];
    const cur = cutDuration(start, d.now(), d.waits, o);
    const { needs } = planNarration([...items, { id: it.id, duration: cur, narration, lead }, ...(next ? [{ id: "next", duration: 0, narration: "", lead: next.lead ?? 0.5 }] : [])], o);
    const hold = needs[items.length] + 0.6 - cur;
    if (hold > 0) await sleep(hold * 1000);
    const end = d.now();
    d.mark("beat-end");
    beats.push({ id: it.id, start: +start.toFixed(3), end: +end.toFixed(3), waits: d.waits.map((w) => ({ ...w, start: +w.start.toFixed(3), end: +w.end.toFixed(3) })) });
    const cutD = cutDuration(start, end, d.waits, o);
    items.push({ id: it.id, duration: cutD, narration, lead });
    const waits = d.waits.map((w) => `${w.label} ${(w.end - w.start).toFixed(1)} s`).join(", ");
    log(`  ✓ ${it.id.padEnd(18)} raw ${(end - start).toFixed(1).padStart(5)} s → cut ${cutD.toFixed(1).padStart(5)} s${hold > 0 ? ` (held ${hold.toFixed(1)} s for narration)` : ""}${waits ? ` · ${waits}` : ""}`);
  }
  const fin = await rec.finish();
  const recording = { base, zoom, recordedAt: new Date().toISOString(), video, duration: fin.duration, offset: fin.offset, beats, ctx: d.ctx, events: d.events, consoleErrors: consoleLog };
  fs.writeFileSync(path.join(work, "recording.json"), JSON.stringify(recording, null, 2));
  if (consoleLog.length) fs.writeFileSync(path.join(work, "console-errors.log"), consoleLog.join("\n") + "\n");
  log(`  raw video ${rel(ROOT, video)} (${fin.duration.toFixed(1)} s, ${fin.frames} frames, clock drift ${fin.offset.toFixed(2)} s)`);
  if (failed) throw new Error(`Recording stopped at beat "${d.beat.id}". Fix the selector in tools/recorder/beats.mjs (see README) and re-run.`);
  return recording;
}

// ------------------------------------------------------------------ cards

async function renderCards(browser, rec) {
  const durations = fitCardDurations(TIMELINE, rec, o);
  const manifestFile = path.join(work, "cards", "manifest.json");
  const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, "utf8")) : {};
  const clips = {};
  for (const c of TIMELINE.filter((x) => x.kind === "card")) {
    const duration = durations[c.id];
    const src = fs.readFileSync(path.join(HERE, "cards", c.file), "utf8") + fs.readFileSync(path.join(HERE, "cards", "card.css"), "utf8");
    const key = `${duration}|${src.length}|${hash(src)}`;
    const file = path.join(work, "cards", `${c.id}.mp4`);
    if (manifest[c.id] === key && fs.existsSync(file)) {
      clips[c.id] = file;
      log(`  = ${c.id} (${duration} s, cached)`);
      continue;
    }
    clips[c.id] = await renderCard(browser, { ...c, duration }, work);
    manifest[c.id] = key;
    log(`  ✓ ${c.id} (${duration} s)`);
  }
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
  return clips;
}

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
}

// ------------------------------------------------------------------ main

const t0 = Date.now();
const ff = findFfmpeg();
log(`CarbonPass demo recorder → ${base}`);
log(`  browser ${browserPath()}`);
log(`  ffmpeg ${ff.ffmpeg}${ff.libDir ? ` (x265 fallback: ${ff.libDir})` : ""}`);
const { chromium } = await import("playwright-core");
const browser = await launch(chromium, { headed: a.headed });
try {
  let rec;
  if (a["assemble-only"]) {
    rec = JSON.parse(fs.readFileSync(path.join(work, "recording.json"), "utf8"));
    log(`Reusing recording of ${rec.base} from ${rec.recordedAt}`);
  } else {
    log("Preflight");
    await preflight();
    if (!a["no-warmup"]) {
      log("Warm-up");
      await warmup(browser);
    }
    log(`Recording the app flow (viewport ${Math.round(1920 / zoom)}×${Math.round(1080 / zoom)} @${zoom}x → 1920×1080)`);
    rec = await recordApp(browser);
  }
  if (!a["record-only"]) {
    log("Cards");
    const clips = await renderCards(browser, rec);
    log("Assembly");
    const res = await assemble({ timeline: TIMELINE, rec, cardClips: clips, tagFor: (t) => renderTag(browser, t, work), workDir: work, outDir, name: a.name, o, log });
    log(`\nDone in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    log(`  ${rel(ROOT, res.mp4)}  ${ts(res.total, false)}  ${(res.size / 1e6).toFixed(1)} MB`);
    log(`  ${rel(ROOT, path.join(outDir, `${a.name}.srt`))}`);
    log(`  ${rel(ROOT, path.join(outDir, "VOICEOVER.md"))}`);
    log(`  ${rel(ROOT, path.join(outDir, `${a.name}.timeline.json`))}`);
  }
} finally {
  await browser.close();
}
