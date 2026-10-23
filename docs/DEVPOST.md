# Devpost submission text (draft, finalise on Sunday)

**Project name:** CarbonPass

**Tagline (max 200 chars):** Verified carbon passports for the EU border. AI prepares the evidence, an accredited verifier signs, and smart contracts make double counting of low-carbon tonnes impossible.

**Built with:** solidity, openzeppelin, hardhat, ethereum, sepolia, erc-1155, next.js, typescript, tailwindcss, viem, claude, anthropic-api, ml-dsa, post-quantum-cryptography, merkle-tree, vercel

**File upload:** `CarbonPass-Dossier.pdf`. It contains the problem statement, architecture & technical spec, security & data-integrity assessment, climate impact assessment, and adoption & scalability roadmap.

---

## About the project

> **Track: Carbon Markets & Emissions Transparency.** CarbonPass uses blockchain-based verification, emissions tracking and smart contracts that prevent double counting, applied to the EU Carbon Border Adjustment Mechanism (CBAM). Its passports also work as digital product passports (Sustainable Supply Chains).

### Inspiration

On 1 January 2026, CBAM began charging for the carbon embedded in steel, aluminium, cement, fertilisers, hydrogen and electricity imported into the EU. Producers in countries like Türkiye and India must supply **verified** emissions data. If they can't, their customers pay EU default values plus a markup.

We worked through what that means for a mid-sized mill. Its data lives in invoices and spreadsheets sent by email. It can't prove it's cleaner than the default. Nothing stops its "low-carbon" tonnes being claimed twice. With COP31 being hosted in Türkiye, a CBAM-exposed exporter, this felt like the most concrete climate-transparency problem of the moment.

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
- **AI:** the Claude API with a strict JSON schema for document extraction (values + citations + confidence). Robust modified z-score and physical-bounds checks for anomalies. A human confirms every value.
- **App:** Next.js + TypeScript + Tailwind + viem. The design system is written as a DESIGN.md and prototyped in Claude Design.

### Challenges we ran into

_TBD: fill in from the real build (e.g. making Merkle leaves identical across TypeScript and Solidity; keeping the demo flow reliable on a public testnet)._

### Accomplishments that we're proud of

_TBD: e.g. double counting is provably blocked by contract invariants, not policy; post-quantum attestations; the whole flow fits in a 3-minute demo._

### What we learned

_TBD: e.g. CBAM details (only direct emissions are chargeable for steel); what blockchain can and can't prove about real-world data._

### What's next for CarbonPass

A pilot with 3–5 exporters in Türkiye and India alongside one accredited verifier, ahead of the first CBAM declarations due 30 Sep 2027. Feeding the same data to Türkiye's ETS pilot and India's CCTS. Cement and fertiliser passports, with renewable-electricity certificates retired into batches. Precursor chaining across supply chains. Zero-knowledge proofs of correct calculation.

---

## Links

- GitHub: _TBD_
- Live demo: _TBD_
- Video: _TBD_
- Contracts (Sepolia): _TBD_
