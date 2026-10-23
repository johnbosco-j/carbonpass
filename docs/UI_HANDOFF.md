# UI handoff: bringing a Claude Design prototype into the app

Use this when you hand off from Claude Design to Claude Code. The visuals can change completely. **The logic must not.**

## Rules for the handoff session

1. **Don't touch:** `web/lib/**`, `web/app/api/**`, `web/scripts/**`, `contracts/**`, `web/data/**`, `web/public/samples/**`.
2. Pages keep calling the same hooks and endpoints (below). Restyle the JSX; keep the behaviour.
3. Design tokens live in `web/app/globals.css` (`@theme`) and come from `design.md`. Update both together.
4. After the restyle, run `pnpm --filter web build`, then click through the full flow (see "Acceptance").

## The data hook

Every page is a client component using `useDemo()` from `web/components/demo-provider.tsx`:

| Field | What it is |
|---|---|
| `state` | Chain snapshot: `network`, `chainId`, `explorer`, `contracts`, `roles` (addresses), `verifier` (name, active, pqPublicKeyHash), `batches[]`, `events[]`, `latestBlock` |
| `state.batches[]` | `id, status ("Pending" / "Issued" / "Rejected" / "Revoked"), periodStart, periodEnd, tonnes, directKgPerT, indirectKgPerT, dataRoot, reportHash, producer, verifier, supply, surrendered, balances {producer, importerA, importerB}` |
| `state.events[]` | `type` (BatchSubmitted / BatchIssued / Shipped / Surrendered / …), `batchId`, `timestamp`, `txHash`, `explorer`, `args` |
| `tx(action, body, title)` | Sends a transaction via `/api/tx/{action}` and shows toasts. Actions: `submit`, `attest`, `reject`, `ship`, `surrender`, `revoke`. Returns `{ ok, hash, explorer, revert, batchId?, pq? }` |
| `loadBundle(id)` / `saveBundle(id, bundle)` | The private evidence bundle for a batch (browser storage) |
| `error` | Set when the chain is unreachable |

## Logic-carrying components (restyle, keep the props)

| Component | Behaviour to keep |
|---|---|
| `checks-list.tsx` | Shows anomaly flags; `onAcknowledge` gates the verifier's Sign button |
| `gauge.tsx` | `shakeKey` changes → shake (rejected over-ship); shows the invariant `supply + surrendered = tonnes` |
| `stamp.tsx` | Verification stamp; `animate` only right after issuance |
| `cost-model.tsx` | Calls `costModel()` from `lib/cbam.ts`; tonnes and price inputs |
| `tamper-check.tsx` | Hashes a dropped file, finds the `doc.*` leaf, posts the proof to `/api/disclose` |
| `toasts.tsx` | Pending / confirmed / rejected; shows the tx hash with an explorer link |

## Page flow (keep these steps and their order)

1. **/producer**: Load sample evidence → Extract (`POST /api/extract`) → confirm values → Calculate (`buildBundle()` from `lib/demo.ts`) → Submit (`tx("submit", …)`, then `saveBundle`).
2. **/verifier**: pending queue → integrity badges (report hash and Merkle root match the chain) → acknowledge flags → `tx("attest", { batchId })` → stamp.
3. **/shipments**: batch picker → gauge → ship to A or B with presets 6,000 / 4,000 / 2,000 → a rejected ship triggers the shake.
4. **/importer**: switch Hamburg / Rotterdam → holdings → `tx("surrender", …)`.
5. **/passport/[id]**: passport card + QR → Verify signature (`GET /api/pq/[id]`) → gauge → cost model → timeline → tamper check.

## Acceptance (must still pass after the restyle)

- [ ] The full flow above works on `pnpm dev` (local chain) and on carbonpass.vercel.app.
- [ ] Shipping 2,000 t after 6,000 + 4,000 shows "Rejected by contract: ERC1155InsufficientBalance" with a tx link.
- [ ] The passport "Verify signature" button shows ✓ Valid. The tampered invoice shows ✗ Altered.
- [ ] Phone width (375 px) has no horizontal scroll. Light and dark mode are both readable.
- [ ] "fictional demo entity" labels are still visible.
