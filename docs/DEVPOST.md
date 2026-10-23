# Devpost submission text (draft, finalise on Sunday)

**Project name:** CarbonPass

**Tagline (max 200 chars):** Verified carbon passports for the EU border. AI prepares the evidence, an accredited verifier signs, and smart contracts make double counting of low-carbon tonnes impossible.

**Built with:** solidity, openzeppelin, hardhat, ethereum, sepolia, erc-1155, next.js, typescript, tailwindcss, viem, gemini, google-genai, zod, ml-dsa, post-quantum-cryptography, merkle-tree, sourcify, vercel

**File upload:** `CarbonPass-Dossier.pdf`. It contains the problem statement, architecture & technical spec, security & data-integrity assessment, climate impact assessment, and adoption & scalability roadmap.

---

## About the project

> **Track: Carbon Markets & Emissions Transparency.** CarbonPass uses blockchain-based verification, emissions tracking and smart contracts that prevent double counting, applied to the EU Carbon Border Adjustment Mechanism (CBAM). Its passports also work as digital product passports (Sustainable Supply Chains).

### Inspiration

On 1 January 2026, CBAM began charging for the carbon embedded in steel, aluminium, cement, fertilisers, hydrogen and electricity imported into the EU. Producers in countries like Türkiye and India must supply **verified** emissions data. If they can't, their customers pay EU default values plus a markup.

We worked through what that means for a mid-sized mill. Its data lives in invoices and spreadsheets sent by email. It can't prove it's cleaner than the default. Nothing stops its "low-carbon" tonnes being claimed twice. Then we found that Turkish exporters are already saying it publicly. About 70% of Türkiye's steel comes from electric arc furnaces, yet the EU default for Turkish hot-rolled steel is 2.43 tCO₂e/t. The Aegean exporters' association in İzmir says the defaults don't reflect their lower-carbon production and asks for verified plant-level data. With COP31 being hosted in Türkiye, this felt like the most concrete climate-transparency problem of the moment.

### What it does

- **Producer:** upload fuel and electricity invoices plus the production log. AI extracts each quantity with a citation to the source page. A CBAM calculator computes embedded emissions per tonne, and anomaly detection flags values that are implausible against the plant's own history.
- **Commit:** only a salted Merkle root and a report hash go on-chain, so plant data stays confidential.
- **Verifier:** an accredited verifier (from the on-chain registry) reviews the flags and signs with a **hybrid ECDSA + ML-DSA (post-quantum)** signature. The contract then mints the batch as ERC-1155 verified tonnes.
- **Ship & surrender:** tonnes move to EU importers with each shipment. Importers burn them when they file their CBAM declaration. The contract enforces **conservation**. Over-shipping, re-certifying a period, reusing a report, and self-verification all revert.
- **Passport:** a QR code opens a public page with the verified intensity, the verifier, the full on-chain history, a tamper check for evidence files, and the € saved versus default values from 2026 to 2034.

### How we built it

- **Smart contracts:** Solidity 0.8.28 + OpenZeppelin 5 (`VerifierRegistry`, `CarbonPassport` ERC-1155), tested with Hardhat, deployed on Sepolia.
- **Evidence commitments:** an OpenZeppelin `StandardMerkleTree` with 32-byte salts per leaf. On-chain `verifyDisclosure` gives selective disclosure.
- **Post-quantum signatures:** ML-DSA-65 (NIST FIPS 204) via `@noble/post-quantum`, with domain-separated messages and the PQ public-key hash registered on-chain.
- **AI:** Google Gemini (`gemini-3.5-flash-lite`, free tier) with a JSON-schema structured output for document extraction (values + verbatim citations + confidence), validated with Zod. Robust modified z-score and physical-bounds checks for anomalies. A human confirms every value. The AI never touches the chain.
- **App:** Next.js + TypeScript + Tailwind + viem on Vercel. The design system is written as a DESIGN.md (Google Labs format) and refined in Claude Design.

### Challenges we ran into

- **Public RPCs aren't consistent.** Free Sepolia endpoints are load-balanced, so right after a transaction a read can land on a node that hasn't seen it yet. We got "batch doesn't exist" errors and even false "insufficient balance" predictions. We built read-your-writes handling: simulations pinned to the block of our last write, short retries for lag-type errors, per-role nonce tracking, and treating the receipt (not the prediction) as truth.
- **Post-quantum signatures are big.** An ML-DSA-65 signature is 3,309 bytes and the public key is 1,952 bytes. We store only their hashes in contract storage and emit the full bytes in events. That keeps storage cheap while staying verifiable from chain data alone.
- **Matching Merkle leaves across TypeScript and Solidity.** Leaves are double-hashed `(string, string, string, bytes32)` tuples, so the browser, the server and `verifyDisclosure` must agree byte for byte. A unit test proves the contract accepts the TypeScript-built proofs.
- **Getting CBAM right.** For iron and steel, only direct emissions (plus precursors) are chargeable; indirect emissions count for cement and fertilisers. We modelled that rule, and pig iron as a precursor, instead of a single "carbon number".

### Accomplishments that we're proud of

- Double counting is **blocked by contract invariants**, not by policy: tonnes are conserved, periods can't overlap, reports can't be reused, producers can't self-verify, and surrendered tonnes are burned. All of it is covered by 16 tests.
- The over-shipment rejection is a **real failed transaction on Sepolia** that anyone can inspect on Etherscan.
- **Post-quantum (NIST FIPS 204) verifier attestations** that anyone can verify from public chain data.
- Plant data stays private (salted Merkle commitments), yet any single document can be proven unchanged. The tampered-invoice demo shows a one-figure edit failing.
- The whole flow runs live at carbonpass.vercel.app with no wallet needed, and fits in a 3½-minute video.

### What we learned

- What a blockchain can and can't prove: it guarantees *who signed what, when*, and that verified tonnes are conserved. It can't make a meter reading true. That's why an accredited verifier and anomaly checks sit in front of it, and why we say so openly.
- CBAM's real mechanics: the phase-in factor (2.5% in 2026 rising to 100% in 2034), default-value markups, the sector-specific scope of chargeable emissions, and how those turn verified data into a growing financial incentive to decarbonise.
- Designing for **crypto-agility**: versioned signature contexts so the scheme can be rotated over long retention periods.

### What's next for CarbonPass

A pilot with 3–5 exporters in Türkiye and India alongside one accredited verifier, ahead of the first CBAM declarations due 30 Sep 2027. Feeding the same data to Türkiye's ETS pilot and India's CCTS. Cement and fertiliser passports, with renewable-electricity certificates retired into batches. Precursor chaining across supply chains. Zero-knowledge proofs of correct calculation.

---

## Links

- GitHub: https://github.com/johnbosco-j/carbonpass
- Live demo: https://carbonpass.vercel.app
- Video: _TBD (YouTube)_
- Contracts (Sepolia): CarbonPassport https://sepolia.etherscan.io/address/0xCd046Af6Ecbf5fe411949a4710A07ca25B6f63Ff · VerifierRegistry https://sepolia.etherscan.io/address/0x4F3b0C41339bd213AbBF73741deB7A368d4b7804
