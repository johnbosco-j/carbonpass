// Renders the HTML cards in cards/ to 1080p clips, and the "waiting" tags to transparent PNGs.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { recordedPage } from "./capture.mjs";
import { ffmpeg } from "./ffmpeg.mjs";
import { ENCODE } from "./assemble.mjs";

const CARDS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "cards");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function renderCard(browser, card, workDir) {
  const raw = path.join(workDir, "raw-cards", `${card.id}.mkv`);
  const out = path.join(workDir, "cards", `${card.id}.mp4`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const rec = await recordedPage(browser, { file: raw, viewport: { width: 1920, height: 1080 } });
  const hash = new URLSearchParams({ d: String(card.duration), ...Object.fromEntries(Object.entries(card.params ?? {}).filter(([, v]) => v != null)) });
  await rec.page.goto(`${pathToFileURL(path.join(CARDS, card.file)).href}#${hash}`, { waitUntil: "load" });
  await rec.page.evaluate(() => window.cardReady);
  await sleep(300);
  const start = (performance.now() - rec.tOpen) / 1000;
  await rec.page.evaluate(() => window.play());
  await sleep(card.duration * 1000 + 400);
  const { file } = await rec.finish();
  await ffmpeg(["-ss", start.toFixed(3), "-i", file, "-t", card.duration.toFixed(3), "-vf", "fps=25,format=yuv420p", ...ENCODE, out]);
  fs.rmSync(file, { force: true });
  return out;
}

const TAG_TEXT = {
  chain: "waiting for block confirmation",
  ai: "AI reading the documents",
  read: "reading chain data",
};

/** A small ink pill with a fast-forward glyph, e.g. "▶▶ waiting for block confirmation · 4×". */
export async function renderTag(browser, { kind, speed }, workDir) {
  const label = `${TAG_TEXT[kind] ?? TAG_TEXT.chain} · ${speed >= 9.95 ? Math.round(speed) : speed.toFixed(speed % 1 < 0.05 ? 0 : 1)}×`;
  const file = path.join(workDir, "tags", `${label.replace(/[^a-z0-9]+/gi, "-")}.png`);
  if (fs.existsSync(file)) return file;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 200 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.setContent(`<!doctype html><html><head>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans:wght@500;600&display=block">
    <style>html,body{margin:0;background:transparent}
    .tag{display:inline-flex;align-items:center;gap:14px;padding:11px 22px 11px 18px;border-radius:999px;background:rgba(16,32,58,.94);
      color:#F6F4EE;font:500 21px/1 "IBM Plex Sans",system-ui,sans-serif;box-shadow:0 6px 18px rgba(16,32,58,.22)}
    .ff{display:inline-flex}.ff i{width:0;height:0;border-top:8px solid transparent;border-bottom:8px solid transparent;border-left:11px solid #FF7A2F}
    .x{font-family:"IBM Plex Mono",monospace;color:#A3A9B5}</style></head>
    <body><div class="wrap" style="display:inline-block;padding:14px 16px 20px"><span class="tag"><span class="ff"><i></i><i></i></span><span>${label.replace(/ · ([\d.]+×)$/, ' <span class="x">· $1</span>')}</span></span></div></body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.locator(".wrap").screenshot({ path: file, omitBackground: true });
  await ctx.close();
  return file;
}
