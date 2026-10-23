# Build plan & task board

**Deadline: Sun 25 Oct 2026, 19:30 IST.** Our own hard stop is **16:00 IST Sunday**, which leaves 3.5 hours of buffer for upload problems.
**Feature freeze: Sat 24 Oct, 23:59 IST.** After that, only bug fixes, docs and the video.

## Your availability → schedule

| Block | When (IST) | You | Claude |
|---|---|---|---|
| **A** | Fri 23 Oct, now → ~14:00 | Setup tasks (below), then Claude Design wireframes | Docs, repo, contracts + tests, app skeleton, calculator, fixtures |
| away | Fri afternoon → Sat afternoon | | (nothing runs unless a session is open) |
| **B** | Sat 24 Oct, afternoon → night | Review UI, design handoff, test the flow | Wire the full flow, AI extraction, passport page, Sepolia deploy, Vercel |
| **C** | Sun 25 Oct, morning → 16:00 | Record video, submit on Devpost | Dossier PDF, README final, Devpost text, fixes |

## Block A: your setup tasks (about 45 min, do these first)

- [ ] **Devpost:** confirm you've joined the hackathon. Click *Start a submission*, enter the title "CarbonPass" and the tagline, then save the draft. Drafts can be edited until the deadline.
- [ ] **Team:** if you have teammates, each must join the hackathon individually, then be added via *Manage team*.
- [ ] **GitHub:** create a public repo `carbonpass`, or tell Claude to do it with `gh`.
- [ ] **Testnet ETH:** Claude generates a deployer address and writes it to `contracts/.env`. Fund it with about 0.1 Sepolia ETH from a faucet (e.g. Google Cloud Web3 faucet, or Alchemy / Infura faucets). Faucets need your sign-in or captcha, so this step is yours.
- [ ] **Anthropic API key** (optional, for live extraction): put it in `web/.env.local` as `ANTHROPIC_API_KEY=`. Without it, the demo uses cached extraction output.
- [ ] **Claude Design** (about 1.5h, following the AI LABS video):
  1. Open the Claude desktop app → sidebar → **Design**.
  2. Create a design system from `design.md` (attach it).
  3. **Wireframe** these 5 screens with 2 variations each: Producer evidence & calculation · Verifier review & sign · Shipments (gauge + over-ship reject) · Public passport · Importer surrender.
  4. Use comments to fix things. Pick variations, then **prototype**, then add subtle **animations** (stamp, gauge, shake).
  5. Hand off to Claude Code via the Claude Design MCP. If there's no time, skip it: Claude builds straight from `design.md`.

## Task board

### Must have (the demo breaks without these)

- [x] Docs skeleton (this folder), `design.md`, `CLAUDE.md`
- [ ] Repo + pnpm workspace + git
- [ ] `VerifierRegistry.sol`: accredit / revoke verifiers
- [ ] `CarbonPassport.sol`: installations, submit → attest → mint, ship, surrender, revoke, disclosure check
- [ ] Contract tests: happy path, over-ship revert, duplicate report, overlapping period, non-accredited verifier, self-verification, revoked freeze, Merkle proof
- [ ] Deploy + seed script: registry, verifier, installation, a history of already-issued batches
- [ ] `data/` fixtures: sample invoices (PDF/PNG), 12-month plant history, `factors.json`
- [ ] CBAM calculator + cost model (`web/lib/cbam.ts`)
- [ ] Anomaly checks: robust z-score vs history, physical bounds
- [ ] Merkle evidence tree with salted leaves (`@openzeppelin/merkle-tree`)
- [ ] Web: producer → verifier → shipments → passport → importer surrender
- [ ] Server-side demo role wallets (API routes) + explorer links
- [ ] Sepolia deploy + Vercel deploy
- [ ] README final, architecture diagram
- [ ] Dossier PDF (the Devpost file upload) compiled from `docs/`
- [ ] Demo video, 3:15–3:45
- [ ] Devpost submission

### Should have (big rubric value, cheap)

- [ ] AI extraction via Claude API with source/page citations, plus a fixture fallback
- [ ] ML-DSA (post-quantum) verifier signature, hybrid with ECDSA
- [ ] Tamper check: drop a file on the passport page, re-hash, match or mismatch against the chain
- [ ] QR code on the passport
- [ ] 2026→2034 savings chart

### Nice to have (only if ahead of schedule)

- [ ] Selective disclosure UI (reveal one field + verify its Merkle proof on-chain)
- [ ] TR / EN language toggle
- [ ] Policymaker view (anonymised sector intensity, Türkiye ETS pilot MRV)
- [ ] Precursor chaining (consume an upstream passport into a downstream batch)

### Cut (don't build)

Token economics, DAO governance, a marketplace, real IoT hardware, mobile app, account systems.

## Risks & fallbacks

| Risk | Fallback |
|---|---|
| Faucet won't give Sepolia ETH | Use another testnet (Base Sepolia / Polygon Amoy; same scripts, new RPC). Last resort: local Hardhat node in the video + verified source on GitHub |
| Claude API key missing or quota hit | Cached extraction fixtures (identical UI) |
| Vercel deploy problems | The video is the primary evidence. Submit with the GitHub link plus local run instructions |
| Claude Design takes too long | Skip it. Tokens in `design.md` drive Tailwind directly |
| Running out of time Sunday | Submit the Devpost draft by 16:00 with whatever exists, then keep editing until 19:30 |

## Submission checklist (Sunday)

- [ ] Devpost: title, tagline, **track stated in the first line**, full description (`docs/DEVPOST.md`)
- [ ] Video link (YouTube, public or unlisted), 3–5 min, plays without sign-in
- [ ] GitHub repo is public, README has links, no secrets committed (`git log -p | grep -i key` is clean)
- [ ] Live demo URL works in a private window
- [ ] File upload: `CarbonPass-Dossier.pdf` (≤35 MB)
- [ ] "Built with" tags, screenshots (5), team members added
- [ ] Submitted, and the project page shows as **Submitted**, not draft
