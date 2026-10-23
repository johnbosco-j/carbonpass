// Recording helpers: a page with Playwright recordVideo, plus the offset that maps our clock onto video time.
import fs from "node:fs";
import path from "node:path";
import { probeDuration } from "./ffmpeg.mjs";

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
 * Opens a recorded page. `finish()` closes it and returns the video path and `offset`, such that
 * videoTime = (performance.now() - tOpen) / 1000 + offset.
 */
export async function recordedPage(browser, { dir, viewport, deviceScaleFactor = 1, size = { width: 1920, height: 1080 }, initScript }) {
  fs.mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor,
    recordVideo: { dir, size },
    colorScheme: "light",
    reducedMotion: "no-preference",
    locale: "en-US",
    acceptDownloads: false,
  });
  if (initScript) await context.addInitScript({ path: initScript });
  const page = await context.newPage();
  const tOpen = performance.now();
  return {
    context,
    page,
    tOpen,
    async finish() {
      const tClose = performance.now();
      const video = page.video();
      await context.close();
      const file = await video.path();
      const duration = probeDuration(file);
      return { file, duration, offset: duration - (tClose - tOpen) / 1000 };
    },
  };
}

export const rel = (root, p) => path.relative(root, p) || ".";
