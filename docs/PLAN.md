# Build plan & task board

**Deadline: Sun 25 Oct 2026, 19:30 IST.** Our hard stop is **16:00 IST Sunday**, leaving 3.5 hours of buffer.

_Status at Sat 24 Oct, 01:30 IST: **feature freeze reached.** Final contracts are deployed and verified, and the final 4:01 video was recorded on Sepolia (`docs/video/`). Left: your voiceover, the YouTube upload, and the Devpost submission._

## Live

| What | Where |
|---|---|
| Live demo | https://carbonpass.vercel.app (Sepolia, no wallet needed) |
| Code | https://github.com/johnbosco-j/carbonpass |
| CarbonPassport | `0x2eD59Df13de482318Fa1dc61aAE5015cf7bE6a22` (Sepolia, Sourcify-verified) |
| VerifierRegistry | `0x52ca9d789B4A7819FF453b887BfcE558b340Ba54` |
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
| **Sat** | Watch `docs/video/carbonpass-demo.mp4`. Record your voice reading `docs/video/VOICEOVER.md` in time with it (any phone or laptop mic). Then run `node tools/recorder/mux.mjs path/to/voice.m4a`, which writes `docs/video/carbonpass-demo-vo.mp4` |
| **Sat** | Upload `carbonpass-demo-vo.mp4` to YouTube (public or unlisted). Use the title, description and chapters in `docs/video/YOUTUBE.md`, and upload `carbonpass-demo.srt` as captions |
| **Sat** | Claim 0.05 Sepolia ETH to the deployer `0x67d7…e857` (Google Cloud faucet), then run `pnpm --filter contracts topup:sepolia` so the live demo stays funded through judging |
| **Sun by 16:00** | Run the Devpost autofill prompt (`docs/DEVPOST_AUTOFILL_PROMPT.md`), add the YouTube link, check every field, then **Submit**. Check the project page says "Submitted" |
| **After** | Rotate your Gemini API key (it was pasted in chat) |

**Don't** run `fresh-demo.sh` again before submission: it replaces the contracts the video shows. Visitors' demo runs simply certify the next free month.

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
