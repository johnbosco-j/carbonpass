# Prompt for a browser-automation agent: fill the Devpost draft

Copy everything below the line into your browser agent. It assumes you are already signed in to Devpost in that browser as **johnbosco-j**.

---

You are filling in a hackathon submission draft on Devpost for the user, who is signed in. Work carefully and follow these rules:

**Rules**
1. **Never click the final "Submit" / "Submit project" button.** Save the draft at every step ("Save & continue", "Save"), then stop at the final review page and report.
2. Don't change account settings, team membership, or anything outside this project's submission.
3. Don't invent content. Use exactly the text below. If a field isn't listed, leave it empty and mention it in your report.
4. If a page asks you to accept terms or rules, stop and ask the user instead of accepting.
5. Upload files only from the absolute paths given. Don't open native file dialogs by clicking; use your file-upload capability on the file input.

**Start**
Go to https://devpost.com/submit-to/29114-ieee-climatechain-global-hackathon/manage/submissions
- If a project called **CarbonPass** already exists there, open it and click "Edit".
- Otherwise click to create a new project for this hackathon.

**Fields**

| Field | Value |
|---|---|
| Project name | `CarbonPass` |
| Elevator pitch / tagline | `Verified carbon passports for the EU border. AI prepares the evidence, an accredited verifier signs, and smart contracts make double counting of low-carbon tonnes impossible.` |
| Thumbnail image | `/Users/ishowbosco/Projects/IEEE HACKATHON/docs/screenshots/devpost-thumbnail.png` |
| Built with (add each as a separate tag) | solidity, openzeppelin, hardhat, ethereum, sepolia, erc-1155, next.js, typescript, tailwindcss, viem, gemini, zod, ml-dsa, post-quantum-cryptography, merkle-tree, sourcify, vercel |
| "Try it out" links | `https://carbonpass.vercel.app` and `https://github.com/johnbosco-j/carbonpass` |
| Video demo link | **leave empty for now** (the YouTube link is added later) |
| Image gallery (upload in this order) | `/Users/ishowbosco/Projects/IEEE HACKATHON/docs/screenshots/passport.png`, `/Users/ishowbosco/Projects/IEEE HACKATHON/docs/screenshots/shipments.png`, `/Users/ishowbosco/Projects/IEEE HACKATHON/docs/screenshots/verifier.png`, `/Users/ishowbosco/Projects/IEEE HACKATHON/docs/screenshots/home.png` |
| Submission file upload (if asked; max 35 MB) | `/Users/ishowbosco/Projects/IEEE HACKATHON/docs/CarbonPass-Dossier.pdf` |
| Track / category question (if asked) | `Carbon Markets & Emissions Transparency` |
| Code repository question (if asked) | `https://github.com/johnbosco-j/carbonpass` |

**"About the project" field.** It accepts Markdown. Paste exactly this:

```markdown
> **Track: Carbon Markets & Emissions Transparency.** CarbonPass uses blockchain-based verification, emissions tracking and smart contracts that prevent double counting, applied to the EU Carbon Border Adjustment Mechanism (CBAM). Its passports also work as digital product passports (Sustainable Supply Chains).

**Live demo:** https://carbonpass.vercel.app (Ethereum Sepolia testnet, no wallet needed) · **Code, contract addresses & docs:** https://github.com/johnbosco-j/carbonpass · **Dossier:** see the attached PDF

## Inspiration

On 1 January 2026, CBAM began charging for the carbon embedded in steel, aluminium, cement, fertilisers, hydrogen and electricity imported into the EU. Producers in countries like Türkiye and India must supply **verified** emissions data. If they can't, their customers pay EU default values plus a mark-up.

We worked through what that means for a mid-sized mill. Its data lives in invoices and spreadsheets sent by email. It can't prove it's cleaner than the default. Nothing stops its "low-carbon" tonnes being claimed twice. Then we found that Turkish exporters are already saying it publicly. About 70% of Türkiye's steel comes from electric arc furnaces, yet the EU default for Turkish hot-rolled steel is 2.43 tCO₂e/t. The Aegean exporters' association in İzmir says the defaults don't reflect their lower-carbon production and asks for verified plant-level data. With COP31 being hosted in Türkiye, this felt like the most concrete climate-transparency problem of the moment.

## What it does

- **Producer:** upload fuel and electricity invoices plus the production log. AI (Google Gemini) extracts each quantity with a verbatim citation to the source page. A CBAM calculator computes embedded emissions per tonne, and anomaly detection flags values that are implausible against the plant's own history.
- **Commit:** only a salted Merkle root and a report hash go on-chain, so plant data stays confidential.
- **Verifier:** an accredited verifier from the on-chain registry reviews the flags and signs with a **hybrid ECDSA + ML-DSA-65 (NIST FIPS 204, post-quantum)** signature. The contract then mints the batch as ERC-1155 verified tonnes.
- **Supply chain, on-chain:** precursors carry their own passports. The steel mill's 1,300 t of pig iron comes from a supplier's verified batch. At issuance the contract **consumes (burns) those precursor tonnes**, links them to the steel batch, and refuses a steel intensity lower than its own inputs' emissions (`UnderstatedPrecursors`). Embedded emissions propagate across companies, and precursor tonnes can never be claimed twice.
- **Ship & surrender:** tonnes move to EU importers with each shipment. Importers burn them when they file their CBAM declaration. The contract enforces **conservation**. Over-shipping, re-certifying a period, reusing a report, and self-verification all revert.
- **Passport:** a QR code opens a public page with the verified intensity, the verifier, the full on-chain history, a tamper check for evidence files, and the € saved versus default values from 2026 to 2034.
- **Impact dashboard:** live totals from the chain plus a scenario simulator to 2034. The key insight: on default values, cutting emissions is worth €0 at the border; on verified data it's worth more every year as CBAM phases in. Example: 5 mills save €224M/yr by 2034.

## How we built it

- **Smart contracts:** Solidity 0.8.28 + OpenZeppelin 5 (VerifierRegistry, CarbonPassport ERC-1155), tested with Hardhat, deployed on Sepolia and source-verified on Sourcify.
- **Evidence commitments:** an OpenZeppelin StandardMerkleTree with 32-byte salts per leaf. On-chain `verifyDisclosure` gives selective disclosure.
- **Post-quantum signatures:** ML-DSA-65 via @noble/post-quantum, with domain-separated messages. The full signature and public key are emitted in events, so anyone can verify them from chain data alone.
- **AI:** Google Gemini with JSON-schema structured output (values + verbatim citations + confidence), validated with Zod. Robust modified z-score and physical-bounds anomaly checks. A human confirms every value; the AI never touches the chain.
- **App:** Next.js + TypeScript + Tailwind + viem on Vercel, with a design system written as a DESIGN.md.

## Challenges we ran into

- **Public RPCs aren't consistent.** Free Sepolia endpoints are load-balanced, so a read right after a transaction can land on a node that hasn't seen it yet. We built read-your-writes handling: simulations pinned to the block of our last write, retries for lag-type errors, per-role nonce tracking, RPC fallback, and treating the receipt (not the prediction) as truth.
- **Post-quantum signatures are big:** 3,309 bytes per signature and 1,952 per public key. We store only hashes in contract storage and emit the full bytes in events.
- **Matching Merkle leaves across TypeScript and Solidity**, byte for byte, proven by a unit test.
- **Getting CBAM right:** for iron and steel only direct emissions plus precursors are chargeable, with country-specific default values and a mark-up schedule (10% in 2026, 30% from 2028).

## Accomplishments that we're proud of

- Double counting is **blocked by contract invariants**, not policy, across the supply chain too, and covered by 28 tests.
- The over-shipment rejection is a **real failed transaction on Sepolia** that anyone can inspect.
- **Post-quantum verifier attestations**, verifiable from public chain data.
- Plant data stays private, yet any single document can be proven unchanged. A one-figure edit to an invoice fails the tamper check.
- The whole flow runs live with no wallet needed.

## What we learned

- What a blockchain can and can't prove: it guarantees *who signed what, when*, and that verified tonnes are conserved. It can't make a meter reading true. That's why an accredited verifier and anomaly checks sit in front of it, and we say so openly.
- CBAM's real mechanics, and how verified data turns them into a growing financial incentive to decarbonise.
- Designing for crypto-agility: versioned signature contexts so the scheme can be rotated over long retention periods.

## What's next for CarbonPass

A pilot with 3–5 exporters in Türkiye and India alongside one accredited verifier, ahead of the first CBAM declarations due 30 Sep 2027. Feeding the same data to Türkiye's ETS pilot and India's CCTS. Cement and fertiliser passports, with renewable-electricity certificates retired into batches. Zero-knowledge proofs of correct calculation.

*Demo companies, installations and verifiers are fictional. Emission factors and default values are sourced in the repository (web/data/factors.json).*
```

**When done**
Stop on the final review page **without submitting**, then report:
- every field you filled
- every field you left empty, and why
- any errors or questions the form showed
- the draft's URL
