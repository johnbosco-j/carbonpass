# Demo recorder

Records the whole CarbonPass demo as a captioned 1080p video with title and explainer cards, so the only thing left to do by hand is the voiceover.

```bash
node tools/recorder/record.mjs --base https://carbonpass.vercel.app
```

It produces, in `docs/video/`:

| File | What it is |
|---|---|
| `carbonpass-demo.mp4` | H.264 1920×1080, 25 fps, no audio. About 3:15 locally and about 3:30 on Sepolia |
| `carbonpass-demo.srt` | The narration as subtitles, timed to the cut (upload it to YouTube as captions) |
| `VOICEOVER.md` | The narration from `docs/DEMO_SCRIPT.md`, re-timed to the cut: start and end time, what's on screen, what to say. It also has the mux command |
| `carbonpass-demo.timeline.json` | The cut list: every segment's raw and cut times, speed-ups, and each beat's raw timestamps |

Then record the voice while the video plays, and run:

```bash
node tools/recorder/mux.mjs path/to/voiceover.m4a
```

That writes `docs/video/carbonpass-demo-vo.mp4`. Add `--offset 0.4` to delay the voice, or `--offset -0.4` to advance it.

## Setup

- Node 20 or newer, plus Brave at `/Applications/Brave Browser.app`. Chrome or Chromium also work; set `BROWSER_PATH` to point at another one. Playwright is used through `playwright-core`, so no browser gets downloaded.
- ffmpeg on the PATH (`brew install ffmpeg`). If Homebrew left ffmpeg linked against a missing x265 dylib (`Library not loaded: …libx265.216.dylib`), the recorder retries with each installed x265 keg on `DYLD_FALLBACK_LIBRARY_PATH`. Nothing on the system is changed. You can also set `FFMPEG=/path/to/ffmpeg`.
- Internet access, because the cards load IBM Plex from Google Fonts.
- This folder is a standalone package and is **not** part of the pnpm workspace:

```bash
cd tools/recorder && pnpm install --ignore-workspace
```

## Recording against Sepolia (the final cut)

1. Start from a fresh deployment, so July 2026 is the next free month and the numbers match the narration: `bash scripts/fresh-demo.sh`. That deploys, seeds April to June, and redeploys the site. Each recording uses up that month: a second run would certify August, and the producer page would show "sandbox: reusing the July 2026 sample evidence". The preflight step warns when the last certified month isn't June 2026.
2. Run `node tools/recorder/record.mjs --base https://carbonpass.vercel.app`. A run takes about 6–8 minutes with Sepolia's 10–25 s confirmations: about 5 minutes of recording, then cards and encoding. Add `--headed` to watch the browser.
3. Watch `docs/video/carbonpass-demo.mp4`, then record the voice using `VOICEOVER.md`.

If a confirmation is very slow, the default `--timeout 240` (seconds per confirmation) still covers it. Every wait is sped up in the cut and capped at `--max-wait` seconds, so a slow block costs nothing on screen.

## How it works

- **Capture.** `lib/screencast.mjs` records the page over the Chrome DevTools screencast and writes a constant 25 fps stream. Each output frame shows the latest browser frame received before that frame's time, so video time equals the recorder's clock. Playwright's `recordVideo` isn't used. It writes at least one frame per screencast frame, so smooth scrolls (about 60 browser frames a second) play slower than real time. In testing, a 137 s session came out 147.5 s long, which breaks the beat timestamps the cut is made from.
- **Zoom.** The viewport is 1536×864 CSS px with `deviceScaleFactor` 1.25, captured at 1920×1080. That's a crisp 125% zoom, which reads better on YouTube than 100%. Change it with `--zoom 1.1`.
- **Overlay.** `lib/overlay.js` is injected into every page. It adds a lower-third caption (ink plate with a molten step number, IBM Plex, per `design.md`), an animated cursor with a highlight halo and click ripple, emphasis rings, and a ghost "file" for the tamper-check drop. It lives in a closed shadow root with `pointer-events: none`, so it never matches a selector or swallows a click. It also hides the Next.js dev badge and adds 220 px of space below the page, so the last buttons can scroll clear of the caption.
- **Pacing.** Pauses are deliberate (`d.read(ms)`), and every wait is on UI state: buttons, badges, toast text. There are no fixed sleeps for the chain. After each beat, the recorder holds on its last frame until that beat's narration fits at about 155 wpm (`--wps 2.6`). Narration may spill into the next item only by that item's `lead` seconds.
- **Waits.** `d.tx(button, until)` logs the time between the click and the confirmation. In the cut, waits longer than 1.5 s play at 4× (or faster, so none lasts over `--max-wait` 4 s). They carry a small tag: "waiting for block confirmation · 4×", "AI reading the documents" for live Gemini extraction, or "reading chain data" for the post-quantum check.
- **Cards.** `cards/*.html` are 1920×1080 pages (title, problem, why blockchain, architecture, roadmap/outro). They are captured the same way with staggered fade-ups and a dip to paper at each end. The app footage dips to paper around them too. To preview a card, open it in a browser; it loops. The outro card is sized to fit its narration (8–14 s).
- **Re-cut without re-recording.** `--assemble-only` reuses `out/recording.json` and the raw capture. Use it after changing cards, `--speed`, `--max-wait` or `--wps`.

## Editing the storyboard

Everything that touches the UI is in **`beats.mjs`**: the order of cards and beats, captions, narration, and selectors. Beats only use the `Director` API (`lib/director.mjs`):

```js
await d.click({ role: "button", name: /load sample evidence/i });
await d.tx({ role: "button", name: /^ship 6,000 t$/i }, toast(/Hamburg/, /Confirmed in block/), { label: "ship 6,000 t → Hamburg" });
await d.scrollTo({ role: "heading", level: 2, name: /tamper check/i }, { at: 0.2 });
await d.caption("Rejected on-chain: <code>ERC1155InsufficientBalance</code>.");
await d.read(2500);
```

Selectors are roles and visible text only. A spec is `"text"`, `/regex/`, `{ role, name, level }`, `{ text }`, `{ label }`, or `(page) => locator`. Buttons and labels are uppercased with CSS, and Playwright matches the transformed text, so use case-insensitive regexes for names. If a beat fails, the run stops with the beat name and saves a screenshot to `out/error-<beat>.png`. Fix the selector and run again.

## Developing against a local chain

The recorder uses ports 8547 and 3104, so it doesn't clash with `pnpm chain` and `pnpm dev`.

```bash
(cd contracts && DEMO_NODE=true npx hardhat node --port 8547)
(cd web && NETWORK=localhost RPC_URL=http://127.0.0.1:8547 GEMINI_API_KEY= npx next dev --port 3104)
bash tools/recorder/dev/local-stack.sh                  # deploy + seed + snapshot
node tools/recorder/record.mjs --base http://localhost:3104
```

`dev/hardhat.local.config.ts` wraps `contracts/hardhat.config.ts`, so `--network localhost` follows `RPC_URL` without editing the tracked config. Deploying rewrites the `localhost` entry of `web/lib/chain/deployments.json`; don't commit that change. To record again from the same seeded state, run `node tools/recorder/dev/chain-snapshot.mjs restore` (it reverts, then mines past the old head), then **restart `next dev`**. The server caches account nonces and would otherwise send stale ones. `--pace 0.4 --record-only --timeout 30` gives a quick selector check.

## Notes for the main session (selectors and app hooks)

These work today but are the most likely to break in the restyle. Small, stable hooks in `web/` would make them sturdier:

1. **Tx toasts** are found as `[aria-live="polite"] > div` filtered by text (the toast title, then "Confirmed in block" or "Rejected by contract"). This is the only attribute selector the recorder uses. Better: `role="status"` on each toast, with the title in its accessible name.
2. **Table headers** (`<th>`) come out as `cell`, not `columnheader`, so the extraction table is found by its header text "Quantity". Adding `scope="col"` would make `getByRole("columnheader")` work.
3. **Metric values** (€ saved in 2026 and 2034) are read from the parent of the metric's label text (`xpath=..`). If `Metric` changes structure, the caption falls back to a version without numbers. Better: a `role="group"` with `aria-label` set to the label.
4. **Tamper check**: the drop zone is found by "Drop an evidence file to check it", and the file is delivered as a synthetic `drop` event with a real `File` fetched from `/samples/…`. Keep `onDrop` on that zone and keep the text, or update `beats.mjs`.
5. **Landing**: the beat scrolls to "The problem" and then "How it works" if those labels exist; otherwise it scrolls down 500 px. After the hero redesign, check the landing beat's scroll stops and caption.
6. **Producer**: if the precursor-consumption step adds a control (a confirm or a picker), add a `d.click(…)` for it in the `producer-evidence` or `producer-calc` beat.
7. **Top-bar nav** links are found inside `role="navigation"` by name (Producer, Importer). If they're missing, the beat falls back to `page.goto`.
