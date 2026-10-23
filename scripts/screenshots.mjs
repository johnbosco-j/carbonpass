// Captures screenshots of the live site into docs/screenshots (for the dossier and the Devpost gallery).
//   node scripts/screenshots.mjs [baseUrl] [batchId]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs/screenshots");
const base = process.argv[2] ?? "https://carbonpass.vercel.app";
const batch = process.argv[3] ?? "4";
const browser = [
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].find((b) => fs.existsSync(b));
if (!browser) throw new Error("No Chromium browser found");

const pages = [
  ["home.png", "/", 1440, 1500],
  ["passport.png", `/passport/${batch}`, 1440, 1000],
  ["shipments.png", `/shipments?batch=${batch}`, 1440, 1000],
  ["verifier.png", `/verifier?batch=${batch}`, 1440, 1100],
];
fs.mkdirSync(OUT, { recursive: true });
for (const [file, route, w, h] of pages) {
  execFileSync(
    browser,
    ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-prefers-reduced-motion", `--window-size=${w},${h}`, "--virtual-time-budget=15000", `--screenshot=${path.join(OUT, file)}`, base + route],
    { stdio: "ignore" },
  );
  console.log(`${file} ← ${route}`);
}
