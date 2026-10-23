# Demo video script (target 3:30, hard max 4:30)

Devpost asks for 3–5 min and the IEEE page says 3 min, so about 3:30 satisfies both.
Record at 1920×1080 in the browser with the zoom at 110%. Hide the bookmarks bar. Use a voiceover (record the narration separately if that's easier, then lay it over the screen capture).

| Time | Screen | Narration (say roughly this) |
|---|---|---|
| **0:00–0:15** | Title card: "CarbonPass: verified carbon passports for the EU border" | "Since January 2026, every tonne of steel entering the EU carries a carbon price. But the proof of how clean that steel is still travels by email, in spreadsheets." |
| **0:15–0:45** | Landing page: problem panel | "Under CBAM, a mill in Türkiye or India must hand over verified emissions data. Otherwise its customer pays the EU's default values, plus a 10% markup. So a clean mill is priced like a dirty one, and there's no reward for cutting emissions. And nothing stops the same low-carbon tonnes being sold twice." |
| **0:45–1:20** | Producer: upload 3 sample docs → extraction table fills in, with citations | "Here's Anatolia Green Steel, a fictional EAF mill. Its compliance officer drops in the gas invoice, the electricity bill and the production log. AI extracts every quantity and links each one to the page it came from. She confirms each value. The AI never writes anything on-chain." |
| **1:20–1:40** | Calculation + anomaly callout | "The CBAM calculator gives 0.356 tonnes of CO₂ per tonne of steel. Our anomaly check compares it with the plant's own 12-month history and flags one value for the verifier to review." |
| **1:40–1:55** | Submit → tx toast → hash chip | "Submitting commits only a salted Merkle root and a report hash to the chain. Competitors see nothing about the process." |
| **1:55–2:20** | Verifier: review flags → sign → **stamp animation** | "An accredited verifier, registered on-chain, reviews the flag and signs twice: with an Ethereum key, and with ML-DSA, a NIST post-quantum signature. That's because these records must stay valid for years. The contract then mints 10,000 verified tonnes." |
| **2:20–2:50** | Shipments: ship 6,000 t to Hamburg and 4,000 t to Rotterdam → gauge drains → try 2,000 t more → **revert shake + red toast** | "The mill ships 6,000 tonnes to one importer and 4,000 to another. Now watch: if it tries to sell 2,000 more 'verified' tonnes, the smart contract rejects it. Double counting isn't discouraged here. It's impossible." |
| **2:50–3:15** | Passport page via QR: intensity, verifier, timeline, **€ saved**. Drop a tampered PDF → **mismatch** | "The importer scans the QR code on the shipping documents. It shows who verified the batch, the full trail, and €32,000 saved this year versus default values for this one month, rising to €1.3 million when CBAM is fully phased in. Change a single byte in the evidence file, and the check fails." |
| **3:15–3:25** | Importer: surrender → burn | "When the importer files its CBAM declaration, it surrenders those tonnes, so they can never be reused." |
| **3:25–3:45** | Architecture slide + roadmap slide | "Why blockchain? Because producer, verifier and importer are in different countries, and the core risk is a double-spend. Next: pilots with exporters in Türkiye and India, the same data feeding Türkiye's ETS and India's carbon market, and cement and fertiliser passports. CarbonPass, for the Carbon Markets and Emissions Transparency track." |

## Recording checklist

- [ ] Fresh demo state: redeploy + `pnpm seed` so July 2026 is the next free month and the numbers match the narration.
- [ ] Wallet / tx toasts confirm quickly (testnet). If Sepolia is slow, record on a local node and show the Sepolia explorer for one real tx.
- [ ] Pre-fill everything; no typing on camera except where it's the point.
- [ ] Rehearse once out loud with a timer.
- [ ] Upload to YouTube (public or unlisted). Check it plays in a private window.
- [ ] Put the same link in the README.

## Backup plan

If the live flow breaks on recording day, record it against the local Hardhat node. Everything is identical except the explorer links. Say so in the video description.
