// Recording helpers: launching Brave (or another Chromium) and opening a page captured at 1080p.
import fs from "node:fs";
import path from "node:path";
import { probeDuration } from "./ffmpeg.mjs";
import { startScreencast } from "./screencast.mjs";

export const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";

export function browserPath() {
  const candidates = [
    process.env.BROWSER_PATH,
    BRAVE,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ].filter(Boolean);
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) throw new Error("No Chromium-based browser found. Set BROWSER_PATH.");
  return found;
}

export async function launch(chromium, { headed = false } = {}) {
  return chromium.launch({
    executablePath: browserPath(),
    headless: !headed,
    args: ["--hide-scrollbars", "--force-color-profile=srgb", "--disable-features=Translate,MediaRouter", "--no-first-run", "--no-default-browser-check"],
  });
}

/**
 * Opens a page captured at a constant 25 fps (lib/screencast.mjs). `finish()` closes it and returns the video
 * path; video time t corresponds to (performance.now() - tOpen) / 1000 = t (offset is ~0 by construction and is
 * reported as a sanity check).
 */
export async function recordedPage(browser, { file, viewport, deviceScaleFactor = 1, size = { width: 1920, height: 1080 }, initScript }) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const context = await browser.newContext({ viewport, deviceScaleFactor, colorScheme: "light", reducedMotion: "no-preference", locale: "en-US" });
  if (initScript) await context.addInitScript({ path: initScript });
  const page = await context.newPage();
  const sc = await startScreencast(page, { file, width: size.width, height: size.height });
  return {
    context,
    page,
    tOpen: sc.t0,
    async finish() {
      const r = await sc.stop();
      await context.close();
      const duration = probeDuration(file);
      return { file, duration, offset: duration - r.wall, frames: r.frames };
    },
  };
}

export const rel = (root, p) => path.relative(root, p) || ".";
