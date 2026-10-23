# Build plan & task board

**Deadline: Sun 25 Oct 2026, 19:30 IST.** Our hard stop is **16:00 IST Sunday**, leaving 3.5 hours of buffer.

_Status at Fri 23 Oct, 11:30 IST: **feature-complete and live.** All that's left is your UI polish, the video, and the Devpost submission._

## Live

| What | Where |
|---|---|
| Live demo | https://carbonpass.vercel.app (Sepolia, no wallet needed) |
| Code | https://github.com/johnbosco-j/carbonpass |
| CarbonPassport | `0xcA4e491c54550b242f90f1c97a1C7612acf7b237` (Sepolia, Sourcify-verified) |
| VerifierRegistry | `0xDB123272620e734a8feEfc776aC0a40E6Baabc69` |
| Dossier PDF | `docs/CarbonPass-Dossier.pdf` (`node scripts/build-dossier.mjs`) |

## Done

- [x] 12 docs, `design.md`, `CLAUDE.md`, README with real links
- [x] Contracts + 28 tests (conservation, overlap, report reuse, self-verification, revocation, Merkle proofs, precursor consumption)
- [x] Deployed + seeded + source-verified on Sepolia (April–June history; July certified once in a live test)
- [x] Web app: producer → verifier → shipments → importer → passport, live on Vercel
- [x] Gemini extraction (falls back to labelled samples without a key)
- [x] ML-DSA-65 attestations verifiable from chain data; on-chain recorded over-ship rejection; tamper check
- [x] Read-your-writes handling for flaky public RPCs (pinned blocks, RPC fallback, nonce tracking)
- [x] Devpost text drafted (`docs/DEVPOST.md`), screenshots (`docs/screenshots/`), UI handoff guide (`docs/UI_HANDOFF.md`)

## Your tasks

| When | Task |
|---|---|
| **Today** | Add your Gemini key locally + on Vercel (commands in chat). Then I can test live extraction |
| **Today / Sat** | Claude Design: restyle using `design.md`; hand off to Claude Code with `docs/UI_HANDOFF.md` |
| **Sat** | Click through the live site; rehearse `docs/DEMO_SCRIPT.md` out loud once |
| **Sun morning** | Run `bash scripts/fresh-demo.sh` (fresh contracts so July 2026 is free), then **record the video** (about 3.5 min) and upload to YouTube |
| **Sun by 16:00** | Devpost: paste `docs/DEVPOST.md`, upload `docs/CarbonPass-Dossier.pdf`, add the video + links + screenshots, then **Submit** |

## If something breaks

| Problem | Fix |
|---|---|
| Live site shows "chain offline" | Public RPC hiccup. Wait 10 s and reload (the app falls back across two RPCs) |
| Sepolia gas runs out | Google Cloud faucet again (0.05 ETH/day) to the deployer `0x67d7…e857`; `deploy.ts` tops up the roles |
| Gemini quota hit | The demo falls back to labelled sample outputs automatically |
| Vercel issue | The video is the primary evidence. GitHub has local run instructions |

## Submission checklist (Sunday)

- [ ] Devpost: title, tagline, **track stated in the first line**, description from `docs/DEVPOST.md`
- [ ] Video link (YouTube public or unlisted), 3–5 min, plays in a private window
- [ ] GitHub public, README links work, no secrets (`git log -p | grep -i private_key` is clean)
- [ ] Live demo works in a private window
- [ ] Upload `docs/CarbonPass-Dossier.pdf`
- [ ] "Built with" tags, 4–5 screenshots from `docs/screenshots/`, team members added
- [ ] The project page shows **Submitted**, not draft
