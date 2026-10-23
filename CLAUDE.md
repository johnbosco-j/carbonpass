# CarbonPass: context for Claude sessions

Hackathon entry for the **IEEE ClimateChain Global Hackathon 2026** (Devpost).
**Hard deadline: Sun 25 Oct 2026, 19:30 IST (14:00 UTC).** Feature freeze: Sat 24 Oct 23:59 IST.
Track: **Carbon Markets & Emissions Transparency**.

## What we're building

CBAM embedded-emissions passports. A producer's evidence is AI-extracted and checked for anomalies. An accredited verifier signs it (ECDSA + ML-DSA). An ERC-1155 batch of verified tonnes is minted; it can be shipped to importers and burned at CBAM declaration. Conservation rules stop double counting. A public passport page shows the proof and the cost saved versus default values.

## Priorities (in order)

1. The **one demo flow** works end to end: upload → extract → submit → verify and sign → mint → ship A/B → over-ship reverts → passport → surrender.
2. Submission deliverables (video, PDF dossier, README, Devpost text) come before new features.
3. Polish only after 1 and 2. Check `docs/PLAN.md` for time left before adding scope.

## Stack

- `contracts/`: Hardhat 2, Solidity 0.8.28 (cancun, viaIR), OpenZeppelin 5, ethers v6, mocha/chai. Networks: `hardhat`, `localhost`, `sepolia`. Deploy writes `web/lib/chain/deployments.json` + typed `abi.ts`.
- `web/`: Next.js (App Router, TypeScript), Tailwind, viem. Server API routes sign txs with demo role keys from env. Gemini (`@google/genai`, Interactions API) for extraction, with labelled sample outputs when `GEMINI_API_KEY` is unset.
- Evidence handoff in the demo: browser storage plus seeded fixtures (no DB). The passport page reads the chain.
- pnpm workspace at the repo root.

## Conventions

- Units: tonnes of product as integers; intensity as **kgCO₂e per tonne** (uint32). 0.35 tCO₂e/t = 350.
- All emission factors and default values live in `web/data/factors.json` with a `source` and `verify` note. Never hardcode them elsewhere.
- Demo entities are fictional; label them as such in the UI.
- The AI never writes on-chain. Values go to a human confirm step first.
- Don't commit keys. `.env*` is gitignored and `.env.example` documents the variables.
- UI follows `design.md` (DESIGN.md format). Read it before building UI.

## Commands (repo root)

`pnpm test` · `pnpm chain` (local node) · `pnpm deploy:local` · `pnpm sync-env` · `pnpm seed` · `pnpm dev` · `pnpm deploy:sepolia`

## Docs map

`docs/PLAN.md` (timeline + task board) · `docs/ARCHITECTURE.md` · `docs/SECURITY.md` · `docs/IMPACT.md` · `docs/ROADMAP.md` · `docs/PROBLEM.md` · `docs/DEMO_SCRIPT.md` · `docs/DEVPOST.md` · `docs/RESEARCH.md`
