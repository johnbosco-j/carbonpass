// The storyboard: every card and app beat in order, with captions, narration and selectors.
// This is the only file to edit when the UI is restyled. Selectors use roles and visible text (see lib/director.mjs).
//
// Item fields
//   kind: "card" | "app"
//   id, n, label      ids and the caption's step number / label
//   screen            what's on screen (goes into VOICEOVER.md); string or (ctx) => string
//   narration         string, or (ctx) => string; read by the voiceover artist
//   params            cards only: (ctx) => values shown on the card (e.g. the verified intensity just recorded)
//   lead              seconds the previous narration may run into this item (default 0.5)
//   chapter           starts a YouTube chapter here (items without one continue the previous chapter)
//   card: file        HTML in cards/, duration (seconds) or fit: { min, max } to size it to its narration
//   app:  run(d, ctx) async function using the Director API

/** The toast for a transaction whose title matches `title`, once its text matches `status`. */
const toast = (title, status) => (p) =>
  p
    .getByRole("log", { name: "Transactions" })
    .getByRole("article")
    .or(p.locator('[aria-live="polite"] > div')) // builds before the toasts had roles
    .filter({ hasText: title })
    .filter({ hasText: status })
    .last();
const navLink = (name) => (p) => p.getByRole("navigation").getByRole("link", { name });

async function clickNav(d, name, path) {
  if (await d.exists(navLink(name), 2000)) await d.click(navLink(name));
  else await d.goto(path);
}

async function scrollToFirst(d, specs, opts) {
  for (const s of specs) if (await d.exists(s, 800)) return d.scrollTo(s, opts);
  return d.scrollBy(500);
}

async function dismissToasts(d) {
  for (let i = 0; i < 6; i++) {
    const b = d.page.getByRole("button", { name: "Dismiss" });
    if (!(await b.count())) return;
    await d.click(b.first(), { pause: 120 });
    await d.read(250);
  }
}

/** A metric block (label + value): <Metric> is a group named by its label (older builds: the label's parent). */
const metric = (label) => (p) => p.getByRole("group", { name: label, exact: true }).or(p.getByText(label, { exact: true }).locator("xpath=..")).first();

/** "€46,720" → "about 47,000 euros"; "€2,257,600" → "2.3 million euros". */
function spokenEur(text, fallback) {
  const n = Number(String(text ?? "").replace(/[^\d.]/g, ""));
  if (!n) return fallback;
  return n >= 1e6 ? `${(n / 1e6).toFixed(1)} million euros` : `about ${Math.round(n / 1000).toLocaleString("en-US")},000 euros`;
}
const num = (text) => String(text ?? "").match(/\d[\d,]*(?:\.\d+)?/)?.[0] ?? null;

/** Scrolls a pinned scroll story to progress p (0–1) of its track. */
async function scrollStory(d, spec, p, ms = 2600) {
  const r = await d.loc(spec).evaluate((el) => ({ top: el.getBoundingClientRect().top + scrollY, h: el.offsetHeight }));
  const v = await d.viewport();
  await d.scrollToY(r.top + p * Math.max(1, r.h - v.h), ms);
}

/** Reads the value printed under a metric label, e.g. "€46,720". */
async function metricValue(d, label) {
  try {
    // innerText applies the label's text-transform, so take the value line rather than stripping the label.
    const lines = (await metric(label)(d.page).innerText()).split("\n").map((l) => l.trim()).filter(Boolean);
    return lines.length > 1 ? lines.at(-1) : null;
  } catch {
    return null;
  }
}

export const TIMELINE = [
  // ------------------------------------------------------------------ opening
  {
    kind: "card",
    id: "title",
    chapter: "The problem: clean steel priced like dirty steel",
    file: "title.html",
    duration: 7,
    screen: "Title card: CarbonPass, verified carbon passports for the EU border",
    narration:
      "Since January 2026, steel entering the EU carries a carbon price. But the proof of how clean it is still travels by email, in spreadsheets.",
  },
  {
    kind: "card",
    id: "problem",
    file: "problem.html",
    duration: 10,
    lead: 3,
    screen: (ctx) => `Problem card: EU default 2.43 vs verified ${ctx.verified ?? "0.337"} tCO₂e/t; ~70% of Turkish steel is EAF`,
    params: (ctx) => ({ verified: ctx.verified }),
    narration:
      "Without verified data, the importer pays the EU default: 2.43 tonnes of CO₂ per tonne of Turkish hot-rolled steel, plus a mark-up. Yet 70% of Turkish steel comes from electric arc furnaces, far cleaner than that.",
  },
  {
    kind: "app",
    id: "landing",
    chapter: "CarbonPass in four steps",
    n: "00",
    label: "CarbonPass",
    lead: 8,
    screen: "Landing page: the pinned 3D story (carbon price → default vs verified → double counting → Run the demo)",
    narration: "A clean mill is priced like a dirty one, so there's no reward for cutting emissions. And nothing stops the same low-carbon tonnes being sold twice.",
    async run(d) {
      await d.goto("/", { waitFor: { role: "heading", level: 1 } });
      const story = { role: "region", name: /story in four steps/i };
      await d.read(1200);
      await d.caption("Verified carbon passports for CBAM steel: AI-prepared evidence, an accredited signature, tonnes that can't be counted twice.");
      if (await d.exists(story, 2000)) {
        // Stops follow web/components/hero/timeline.ts. Each one is where that step has finished animating:
        // numbers at 0.45 (the verified count-down ends at T.keepTo; earlier it shows an intermediate value),
        // contract at 0.70 (after the ship at 0.64 and the revert at 0.66), CTA at 0.96 (focusing the CTA scrolls
        // the story to 1 when it's more than 0.08 away, which would move the button mid-click).
        await d.read(3000);
        for (const [p, ms] of [[0.45, 3800], [0.7, 3800], [0.96, 2200]]) {
          await scrollStory(d, story, p);
          await d.read(ms);
        }
      } else {
        await d.read(4500);
        await scrollToFirst(d, [{ text: /^The problem$/i }, { text: /problem/i }], { at: 0.05 });
        await d.read(4500);
        await scrollToFirst(d, [{ text: /^How it works$/i }], { at: 0.05 });
        await d.read(3500);
      }
    },
  },

  // ------------------------------------------------------------------ producer
  {
    kind: "app",
    id: "producer-evidence",
    chapter: "Producer: AI extraction with page citations",
    n: "01",
    label: "Producer · evidence",
    screen: "Producer: load the 4 sample PDFs → AI extraction table with page citations → confirm all",
    narration: (ctx) =>
      `Here's Anatolia Green Steel, a fictional electric-arc mill in İzmir. Its compliance officer loads the month's gas and electricity invoices, production report and meter log. The AI extraction step${
        ctx.extractMode === "gemini" ? "" : ", here with recorded sample output,"
      } pulls out every quantity and links each one to the page it came from. She confirms each value. The AI never writes anything on-chain.`,
    async run(d, ctx) {
      const cta = { role: "link", name: /run the demo/i };
      const heading = { role: "heading", level: 1, name: /Anatolia/i };
      if (await d.exists(cta, 1500)) await d.click(cta);
      if (!(await d.exists(heading, 10_000))) await clickNav(d, /Producer/, "/producer");
      await d.waitFor(heading);
      await d.caption("Anatolia Green Steel (<b>fictional</b>), an EAF mill in İzmir, certifies one month of hot-rolled coil.");
      await d.read(2200);
      await d.click({ role: "button", name: /Load sample evidence/i });
      await d.waitFor({ text: "production_log_2026-07.pdf" });
      await d.caption("The month's invoices, production report and meter log. Each file is hashed (SHA-256) in the browser.");
      await d.read(2400);
      await d.tx({ role: "button", name: /Extract with AI/i }, { role: "button", name: /Confirm all/i }, { label: "AI extraction", kind: "ai" });
      ctx.extractMode = (await d.exists({ text: /Live extraction by Gemini/ }, 500)) ? "gemini" : "sample";
      await d.scrollTo((p) => p.getByRole("columnheader", { name: /^quantity$/i }).or(p.getByText(/^Quantity$/i)).first(), { at: 0 });
      await d.caption(
        ctx.extractMode === "gemini"
          ? "Gemini returns structured quantities, each with a <b>verbatim quote and page</b>. Nothing counts until a human confirms it."
          : "AI extraction (recorded sample output): every quantity with a <b>verbatim quote and page</b>. Nothing counts until a human confirms it.",
      );
      await d.read(1500);
      await d.ring((p) => p.getByRole("columnheader", { name: /^source$/i }).or(p.getByText(/^Source$/i)).first(), 1600, 6);
      await d.read(1600);
      await d.click({ role: "button", name: /Confirm all/i });
      await d.caption("Human in the loop: values are confirmed by the compliance officer. <b>The AI never writes on-chain.</b>");
      await d.read(2600);
    },
  },
  {
    kind: "app",
    id: "producer-calc",
    chapter: "Precursor passport, CBAM calculation, anomaly check",
    n: "02",
    label: "Producer · calculation & checks",
    screen: (ctx) =>
      `${ctx.pigIronT ? "Precursor passport card (supplier's pig iron) → " : ""}Calculate → ${ctx.verified ?? "0.337"} tCO₂e/t, anomaly callout (amber) for one value`,
    narration: (ctx) =>
      `${
        ctx.pigIronT
          ? `The mill's ${ctx.pigIronT} tonnes of pig iron come with their own verified passport from the supplier, so the calculator reads that ${ctx.pigIronVerified} straight from the chain instead of the ${ctx.pigIronDefault} default. Those tonnes are burned when this batch is verified, so no other product can claim them. The result: `
          : "The CBAM calculator gives "
      }${ctx.verified ?? "0.337"} tonnes of CO₂ per tonne of steel. Our anomaly check compares it with the plant's own 12-month history and flags one value for the verifier to review.`,
    async run(d, ctx) {
      // Precursor passport (supplier's verified pig iron), if this build has it.
      const use = { role: "checkbox", name: /supplier.s verified intensity/i };
      // The page ticks it only when the mill still holds the pig-iron tonnes (fresh deploy + seed); otherwise the
      // batch uses the EU default and the narration below drops the precursor sentence.
      if ((await d.exists(use, 1500)) && (await d.loc(use).isChecked())) {
        const text = await d.loc(use).evaluate((el) => (el.closest("label") ?? el.parentElement).textContent ?? "");
        const verified = await d.page.getByText(/^verified [\d.]+ tCO₂e\/t$/).first().textContent().catch(() => null);
        ctx.pigIronT = text.match(/for ([\d,]+) t of pig iron/)?.[1] ?? null;
        ctx.pigIronDefault = text.match(/EU default \(\s*([\d.]+)/)?.[1] ?? null;
        ctx.pigIronVerified = verified ? Number(num(verified)).toFixed(2) : null;
        if (!(ctx.pigIronT && ctx.pigIronDefault && ctx.pigIronVerified)) ctx.pigIronT = null;
        await d.scrollTo({ text: /^Precursor passport$/i }, { at: 0.15 });
        await d.caption(
          ctx.pigIronT
            ? `Precursor passport: ${ctx.pigIronT} t of the supplier's pig iron at a verified <b>${ctx.pigIronVerified}</b> tCO₂e/t instead of the ${ctx.pigIronDefault} default. Burned when this batch is issued.`
            : "Precursor passport: the supplier's verified pig iron replaces the EU default, and is burned when this batch is issued.",
        );
        await d.ring((p) => p.getByText(/Use the supplier.s verified intensity/i).first(), 2600, 8);
        await d.read(2000);
      }
      await d.click({ role: "button", name: /^Calculate$/i });
      const see = metric("Direct incl. precursors (chargeable for steel)");
      await d.waitFor(see);
      ctx.verified = num(await metricValue(d, "Direct incl. precursors (chargeable for steel)")) ?? ctx.verified;
      await d.scrollTo(see, { at: 0.1 });
      await d.caption(`CBAM specific embedded emissions: <b>${ctx.verified ?? "?"} tCO₂e/t</b>, against an EU default of 2.43 for Turkish hot-rolled steel.`);
      await d.ring(see, 2200, 10);
      await d.read(1600);
      await d.scrollTo({ text: /^review$/i }, { at: 0.25 });
      await d.caption("Anomaly check against the plant's own 12-month history: one value is <b>flagged for the verifier</b>. Flags route, they don't block.");
      await d.read(4200);
    },
  },
  {
    kind: "app",
    id: "producer-submit",
    n: "03",
    label: "Producer · commit",
    screen: "Merkle root + report hash → Submit → tx toast → pending",
    narration: "Submitting commits only a salted Merkle root and a report hash to the chain. Competitors see nothing about the process.",
    async run(d, ctx) {
      await d.scrollTo({ role: "heading", level: 2, name: /Commit & submit/i }, { at: 0 });
      await d.caption("Only a <b>salted Merkle root</b> and a <b>report hash</b> go on-chain. The evidence itself stays private.");
      await d.read(2200);
      await d.tx({ role: "button", name: /^Submit .* for verification$/i }, { role: "link", name: /Continue as verifier/i }, { label: "submit batch" });
      await d.caption("Batch submitted: <b>pending verification</b>.");
      await d.read(1600);
    },
  },

  // ------------------------------------------------------------------ verifier
  {
    kind: "app",
    id: "verifier",
    chapter: "Verifier: post-quantum signature, 10,000 t minted",
    n: "04",
    label: "Verifier · sign & issue",
    screen: "Verifier: integrity badges ✓ → acknowledge the flag → Sign (ECDSA + ML-DSA) → stamp, 10,000 t issued",
    narration:
      "An accredited verifier, registered on-chain, checks the evidence against those commitments, reviews the flag, and signs twice: with an Ethereum key, and with ML-DSA, a NIST post-quantum signature, because these records must stay valid for years. The contract then mints 10,000 verified tonnes.",
    async run(d, ctx) {
      await d.click({ role: "link", name: /Continue as verifier/i });
      await d.waitFor({ text: /✓ report hash matches chain/ });
      ctx.batchId = Number(new URL(d.page.url()).searchParams.get("batch")) || ctx.batchId;
      await d.caption("EuroVerify (<b>fictional</b>), an accredited verifier registered on-chain with a post-quantum key.");
      await d.read(2000);
      await d.scrollTo({ role: "heading", level: 2, name: /Evidence review/i }, { at: 0 });
      await d.caption("Integrity: the shared evidence matches the on-chain <b>report hash</b> and <b>Merkle root</b>.");
      await d.ring({ text: /✓ Merkle root matches chain/ }, 1800, 6);
      await d.read(1000);
      await d.scrollTo({ role: "checkbox", name: /I reviewed the supporting evidence/i }, { at: 0.55 });
      await d.caption("The flagged value has to be reviewed and acknowledged before signing is possible.");
      await d.read(2000);
      await d.click({ role: "checkbox", name: /I reviewed the supporting evidence/i });
      await d.read(900);
      await d.tx({ role: "button", name: /Sign \(ECDSA/i }, { text: /verified tonnes issued/ }, { label: "attest + mint" });
      await d.scrollTo({ role: "img", name: /Verified stamp/i }, { at: 0.45 });
      await d.caption("Hybrid signature, ECDSA + <b>ML-DSA-65</b> (NIST FIPS 204). The contract mints <b>10,000 verified tonnes</b> (ERC-1155).");
      await d.read(4200);
    },
  },

  // ------------------------------------------------------------------ shipments
  {
    kind: "app",
    id: "shipments",
    chapter: "Shipping, and a double-count rejected on-chain",
    n: "05",
    label: "Shipments",
    screen: "Ship 6,000 t → Hamburg, 4,000 t → Rotterdam; the gauge drains to 0",
    narration: "The mill ships 6,000 tonnes to an importer in Hamburg, and 4,000 to one in Rotterdam.",
    async run(d) {
      await d.click({ role: "link", name: /Ship tonnes to importers/i });
      await d.waitFor({ text: "Invariant" });
      await d.scrollTo({ role: "heading", level: 2, name: /t verified at/i }, { at: 0 });
      await d.caption("Verified tonnes travel with the goods. The gauge reads live balances from the contract.");
      await d.read(1600);
      await d.click({ role: "radio", name: /Hamburg/i });
      await d.click({ role: "button", name: "6,000", exact: true });
      await d.tx({ role: "button", name: /^Ship 6,000 t$/i }, toast(/Hamburg/, /Confirmed in block/), { label: "ship 6,000 t → Hamburg" });
      await d.caption("<b>6,000 t</b> to Hanse Stahlhandel, Hamburg (fictional), with a customs reference.");
      await d.read(1800);
      await d.click({ role: "radio", name: /Rotterdam/i });
      await d.click({ role: "button", name: "4,000", exact: true });
      await d.tx({ role: "button", name: /^Ship 4,000 t$/i }, toast(/Rotterdam/, /Confirmed in block/), { label: "ship 4,000 t → Rotterdam" });
      await d.caption("<b>4,000 t</b> to Rijnmond Metals, Rotterdam (fictional). Nothing left with the producer.");
      await d.read(2000);
    },
  },
  {
    kind: "app",
    id: "overship",
    n: "06",
    label: "Shipments · double-count attempt",
    screen: "Try 2,000 t more → red revert toast (ERC1155InsufficientBalance) + gauge shake",
    narration:
      "Now watch: if it tries to sell 2,000 more 'verified' tonnes, the smart contract rejects it. Double counting isn't discouraged here. It's impossible.",
    async run(d) {
      await d.caption("Now the mill tries to sell <b>2,000 t more</b> than was verified…");
      await d.click({ role: "radio", name: /Hamburg/i });
      await d.click({ role: "button", name: "2,000", exact: true });
      await d.read(600);
      await d.tx({ role: "button", name: /^Ship 2,000 t$/i }, toast(/Rejected by contract/, /Double counting blocked/), { label: "over-ship 2,000 t (reverts)" });
      await d.caption("Rejected on-chain: <code>ERC1155InsufficientBalance</code>. Double counting isn't discouraged. <b>It's impossible.</b>");
      await d.read(4500);
      await dismissToasts(d);
    },
  },

  // ------------------------------------------------------------------ importer
  {
    kind: "app",
    id: "importer",
    chapter: "Importer surrenders at the CBAM declaration",
    n: "07",
    label: "Importer · CBAM declaration",
    screen: "Importer (Hamburg) holds 6,000 t → Surrender for declaration → burned",
    narration: "When the Hamburg importer files its CBAM declaration, it surrenders those tonnes. They're burned, so they can never be reused.",
    async run(d) {
      await clickNav(d, /Importer/, "/importer");
      await d.waitFor({ role: "heading", level: 1, name: /Hanse Stahlhandel/i });
      await d.caption("Hanse Stahlhandel (<b>fictional</b>), an EU importer, holds the verified tonnes.");
      await d.scrollTo({ role: "button", name: /Surrender for declaration/i }, { at: 0.4 });
      await d.read(1800);
      await d.tx({ role: "button", name: /Surrender for declaration/i }, { text: "6,000 t burned" }, { label: "surrender (burn)" });
      await d.caption("Surrendered at CBAM declaration: the tonnes are <b>burned</b> and can never back a second claim.");
      await d.scrollTo({ text: "6,000 t burned" }, { at: 0.4 });
      await d.read(2400);
    },
  },

  // ------------------------------------------------------------------ passport
  {
    kind: "app",
    id: "passport-pq",
    chapter: "Public passport: signature, supply chain, € saved, tamper check",
    n: "08",
    label: "Public passport",
    screen: "Passport card + QR → Verify signature → ✓ Valid, ML-DSA-65, 3,309 B",
    narration:
      "Anyone can open the passport from the QR code on the shipping documents. It shows who verified the batch, checks the post-quantum signature using chain data alone, and traces the pig iron back to its own passport.",
    async run(d, ctx) {
      await d.goto(`/passport/${ctx.batchId}`, { waitFor: { text: "CBAM carbon passport" } });
      await d.caption("The public passport: what the QR code on the shipping documents opens. No wallet needed.");
      await d.read(2600);
      await d.tx({ role: "button", name: /Verify signature/i }, { text: "✓ Valid" }, { label: "verify ML-DSA signature", kind: "read" });
      await d.caption("ML-DSA-65 signature checked from chain data alone: <b>3,309-byte</b> signature, registered verifier key.");
      await d.ring({ text: "✓ Valid" }, 2200, 6);
      await d.read(1800);
    },
  },
  {
    kind: "app",
    id: "passport-cost",
    n: "09",
    label: "Public passport · value",
    screen: (ctx) =>
      `Supply chain (pig-iron passport consumed), conservation gauge, then cost model: ${ctx.saving26 ?? "€46,720"} saved in 2026, ${ctx.saving34 ?? "€2.26M"} in 2034`,
    narration: (ctx) =>
      `${
        ctx.pigIronT
          ? `The pig iron in this steel came with its own verified passport. Those ${ctx.pigIronT} tonnes were consumed on-chain, so no other mill can ever claim them. And against`
          : "Against"
      } the EU default for Turkish hot-rolled steel, this one month's output saves ${spokenEur(ctx.saving26, "about 47,000 euros")} this year, rising to ${spokenEur(
        ctx.saving34,
        "2.3 million euros",
      )} a year when CBAM is fully phased in.`,
    async run(d, ctx) {
      const chain = { role: "heading", level: 2, name: /supply chain/i };
      if (await d.exists(chain, 1000)) {
        await d.scrollTo(chain, { at: 0 });
        await d.caption(
          `Supply chain, on-chain: <b>${ctx.pigIronT ?? "1,300"} t of verified pig iron</b> (its own passport) consumed into this batch and burned, so no other mill can claim it.`,
        );
        await d.read(3400);
      }
      await d.scrollTo({ role: "heading", level: 2, name: /Conservation of verified tonnes/i }, { at: 0 });
      await d.caption("Conservation, enforced by the contract: supply + surrendered = issued tonnes.");
      await d.read(2200);
      await d.scrollTo({ text: "Saving in 2026 vs default values" }, { at: 0.05 });
      const y26 = (await metricValue(d, "Saving in 2026 vs default values")) ?? "";
      const y34 = (await metricValue(d, "Saving in 2034 (full CBAM)")) ?? "";
      ctx.saving26 = y26 || null;
      ctx.saving34 = y34 || null;
      await d.caption(
        y26 && y34
          ? `Versus EU default values: <b>${y26}</b> saved in 2026 on this one month's output, <b>${y34}</b> a year by 2034.`
          : "Versus EU default values: the saving on this one month's output, 2026 → 2034.",
      );
      await d.ring(metric("Saving in 2026 vs default values"), 2400, 10);
      await d.read(3200);
    },
  },
  {
    kind: "app",
    id: "passport-tamper",
    n: "10",
    label: "Public passport · tamper check",
    screen: "Ledger timeline; drop the original invoice → ✓ Unchanged; drop the tampered copy → ✗ Altered",
    narration: "Here's the full trail, block by block. The original invoice matches. Change a single figure in it, and the check fails.",
    async run(d) {
      await d.scrollTo({ text: "Drop an evidence file to check it" }, { at: 0.2 });
      await d.caption("The full trail, block by block, from the precursor to the surrender. Now a tamper check with the <b>original invoice</b>.");
      await d.read(1500);
      const target = { text: /Drop an evidence file to check it|Checking…/ };
      const name = "electricity_invoice_2026-07.pdf";
      await d.dropFile({ url: `/samples/${name}`, name, tag: "original", tone: "orig", target });
      await d.waitFor({ text: "✓ Unchanged" }, { timeout: 30_000 });
      await d.caption("<b>✓ Unchanged</b>: hashed in the browser, Merkle inclusion proven against the on-chain root.");
      await d.read(2600);
      await d.dropFile({ url: `/samples/tampered/${name}`, name, tag: "one figure changed", tone: "tamp", target });
      await d.waitFor({ text: "✗ Altered" }, { timeout: 30_000 });
      await d.caption("<b>✗ Altered</b>: change one figure and it is no longer the document the verifier signed off.");
      await d.read(3600);
      await d.hideCaption();
      await d.read(400);
    },
  },

  // ------------------------------------------------------------------ closing
  {
    kind: "card",
    id: "why",
    chapter: "Why blockchain, architecture, roadmap",
    file: "why.html",
    duration: 8,
    lead: 1,
    screen: "Why blockchain: four reasons",
    narration: "Why blockchain? Producer, verifier and importer are in different countries, and the core risk is a double-spend.",
  },
  {
    kind: "card",
    id: "architecture",
    file: "architecture.html",
    duration: 8,
    lead: 1,
    screen: "Architecture: evidence → AI + human → calculator & checks → verifier → contracts → public passport",
    narration: "Under the hood: AI with a human in the loop, a post-quantum verifier signature, and a contract that conserves every tonne.",
  },
  {
    kind: "card",
    id: "outro",
    file: "outro.html",
    fit: { min: 8, max: 14 },
    lead: 1.5,
    screen: "Roadmap & outro: pilots in Türkiye and India, cement & fertiliser, COP31; links",
    narration:
      "Next: pilots with exporters in Türkiye and India, the same data feeding Türkiye's ETS and India's carbon market, then cement and fertiliser. CarbonPass, for the Carbon Markets and Emissions Transparency track.",
  },
];
