// Builds docs/CarbonPass-Dossier.pdf (the Devpost file upload) from the docs/*.md files.
//   node scripts/build-dossier.mjs            (needs Brave or Chrome installed for headless PDF printing)
// Screenshots in docs/screenshots/*.png are embedded when present (node scripts/screenshots.mjs).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { marked } from "marked";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = path.join(ROOT, "docs");
const OUT_HTML = path.join(DOCS, "dossier.html");
const OUT_PDF = path.join(DOCS, "CarbonPass-Dossier.pdf");
const BROWSERS = [
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];

const SECTIONS = [
  ["PROBLEM.md", "1"],
  ["ARCHITECTURE.md", "2"],
  ["SECURITY.md", "3"],
  ["IMPACT.md", "4"],
  ["ROADMAP.md", "5"],
];

const SHOTS = [
  ["passport.png", "Public passport (Sepolia batch): verified intensity, QR, verifier stamp, commitments"],
  ["shipments.png", "Conservation gauge: every verified tonne is with the producer, an importer, or burned"],
  ["verifier.png", "Verifier: evidence matches on-chain commitments; hybrid ECDSA + ML-DSA-65 sign-off"],
  ["home.png", "Landing page with live chain statistics"],
];

const renderer = new marked.Renderer();
const baseCode = renderer.code.bind(renderer);
renderer.code = (token) => (token.lang === "mermaid" ? `<pre class="mermaid">${token.text}</pre>` : baseCode(token));
marked.use({ renderer, gfm: true });

const sections = SECTIONS.map(([file, n]) => {
  const md = fs.readFileSync(path.join(DOCS, file), "utf8");
  return `<section class="doc" id="s${n}">${marked.parse(md)}</section>`;
}).join("\n");

const shots = SHOTS.filter(([f]) => fs.existsSync(path.join(DOCS, "screenshots", f)))
  .map(([f, cap]) => `<figure><img src="screenshots/${f}" alt="${cap}"/><figcaption>${cap}</figcaption></figure>`)
  .join("\n");

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<title>CarbonPass: Technical & Impact Dossier</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Serif:wght@600&display=swap" rel="stylesheet"/>
<style>
  @page { size: A4; margin: 16mm 15mm; }
  :root { --ink:#10203a; --muted:#4a5568; --rule:#d9d4c7; --molten:#e8590c; --sunken:#eeeae0; --verified:#1f7a4d; }
  body { font-family: "IBM Plex Sans", system-ui, sans-serif; color: var(--ink); font-size: 10pt; line-height: 1.5; margin: 0; }
  h1, h2 { font-family: "IBM Plex Serif", Georgia, serif; }
  h1 { font-size: 20pt; margin: 0 0 6pt; border-bottom: 2px solid var(--ink); padding-bottom: 4pt; }
  h2 { font-size: 13pt; margin: 16pt 0 6pt; }
  h3 { font-size: 11pt; margin: 12pt 0 4pt; }
  p, li { orphans: 3; widows: 3; }
  code { font-family: "IBM Plex Mono", monospace; font-size: 8.5pt; background: var(--sunken); padding: 0 3px; border-radius: 2px; }
  pre { background: var(--sunken); padding: 8pt; border-radius: 3px; overflow: hidden; white-space: pre-wrap; font-size: 8pt; break-inside: avoid; }
  pre code { background: none; padding: 0; }
  pre.mermaid { background: #fff; text-align: center; border: 1px solid var(--rule); }
  table { border-collapse: collapse; width: 100%; margin: 6pt 0 10pt; font-size: 8.8pt; break-inside: auto; }
  th, td { border-bottom: 1px solid var(--rule); padding: 4pt 5pt; text-align: left; vertical-align: top; }
  th { font-size: 7.5pt; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
  tr { break-inside: avoid; }
  blockquote { border-left: 3px solid var(--molten); margin: 8pt 0; padding: 2pt 10pt; color: var(--muted); }
  a { color: var(--ink); }
  .doc { break-before: page; }
  .cover { height: 255mm; display: flex; flex-direction: column; justify-content: space-between; }
  .cover .label { font-size: 8pt; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
  .cover h1 { font-size: 40pt; border: 0; margin: 10pt 0 4pt; }
  .cover .tag { font-size: 14pt; max-width: 150mm; }
  .cover .track { display: inline-block; margin-top: 14pt; padding: 4pt 10pt; border: 1px solid var(--molten); color: var(--molten); font-weight: 600; font-size: 9pt; }
  .cover table td:first-child { width: 42mm; color: var(--muted); }
  .toc li { margin: 2pt 0; }
  figure { margin: 0 0 10pt; break-inside: avoid; }
  figure img { width: 100%; border: 1px solid var(--rule); border-radius: 3px; }
  figcaption { font-size: 8pt; color: var(--muted); margin-top: 3pt; }
  .shots { break-before: page; }
</style></head>
<body>
<section class="cover">
  <div>
    <div class="label">IEEE ClimateChain Global Hackathon 2026 · Technical &amp; Impact Dossier</div>
    <h1>CarbonPass</h1>
    <div class="tag">Verified embedded-emissions passports for the EU Carbon Border Adjustment Mechanism, so clean producers stop paying for dirty defaults.</div>
    <div class="track">Track: Carbon Markets &amp; Emissions Transparency</div>
  </div>
  <div>
    <table>
      <tr><td>Live demo</td><td>https://carbonpass.vercel.app (Ethereum Sepolia testnet)</td></tr>
      <tr><td>Source code</td><td>https://github.com/johnbosco-j/carbonpass</td></tr>
      <tr><td>CarbonPassport</td><td><code>0xCd046Af6Ecbf5fe411949a4710A07ca25B6f63Ff</code> (Sepolia, source verified on Sourcify)</td></tr>
      <tr><td>VerifierRegistry</td><td><code>0x4F3b0C41339bd213AbBF73741deB7A368d4b7804</code></td></tr>
      <tr><td>Stack</td><td>Solidity / OpenZeppelin (ERC-1155), Hardhat, Next.js, viem, Google Gemini, ML-DSA-65 (FIPS 204), Merkle commitments</td></tr>
    </table>
    <ol class="toc">
      <li>Problem statement &amp; solution overview</li>
      <li>Architecture diagram &amp; technical specification</li>
      <li>Security &amp; data-integrity assessment</li>
      <li>Climate impact assessment &amp; carbon-reduction projections</li>
      <li>Implementation, adoption strategy &amp; scalability roadmap</li>
      <li>Screenshots</li>
    </ol>
    <p style="font-size:8pt;color:var(--muted)">Prototype on a public testnet. Companies, installations and verifiers in the demo are fictional. Emission factors and default values marked illustrative are placeholders, not official figures.</p>
  </div>
</section>
${sections}
${shots ? `<section class="shots"><h1>6. Screenshots</h1>${shots}</section>` : ""}
<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs";
  mermaid.initialize({ startOnLoad: true, theme: "neutral", securityLevel: "strict" });
</script>
</body></html>`;

fs.writeFileSync(OUT_HTML, html);
const browser = BROWSERS.find((b) => fs.existsSync(b));
if (!browser) {
  console.log(`Wrote ${OUT_HTML}. No Chromium browser found: open it and print to PDF manually.`);
  process.exit(0);
}
execFileSync(
  browser,
  ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--virtual-time-budget=20000", `--print-to-pdf=${OUT_PDF}`, `file://${OUT_HTML}`],
  { stdio: "ignore" },
);
console.log(`Wrote ${path.relative(ROOT, OUT_PDF)} (${(fs.statSync(OUT_PDF).size / 1024).toFixed(0)} KB)`);
