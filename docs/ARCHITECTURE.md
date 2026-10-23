# Architecture & technical specification

## 1. System context

```mermaid
flowchart TB
  subgraph Producer["Producer (TR / IN)"]
    U[Upload invoices,<br/>meter + production logs]
  end
  subgraph App["CarbonPass web app (Next.js)"]
    EX[AI extraction<br/>Claude API, cited]
    CALC[CBAM calculator<br/>deterministic]
    AN[Anomaly checks<br/>robust z-score + bounds]
    MT[Evidence Merkle tree<br/>salted leaves]
    PQ[ML-DSA-65 signer<br/>verifier side]
    API[API routes<br/>demo role wallets]
  end
  subgraph Chain["EVM (Sepolia testnet)"]
    REG[(VerifierRegistry)]
    CP[(CarbonPassport<br/>ERC-1155)]
  end
  V[Accredited verifier]
  I[EU importers]
  PUB[Public passport page / QR]

  U --> EX --> CALC --> AN --> MT
  MT -->|root + report hash| API --> CP
  V --> PQ -->|sig hash| API
  REG --- CP
  CP -->|ship / surrender| I
  PUB -->|read events + state| CP
```

**On-chain:** registry of verifiers and installations, batch metadata, Merkle roots, report hashes, signature digests, tonne balances, the shipment and surrender history.
**Off-chain:** raw documents, extracted activity data, salts, the full ML-DSA signature (about 3.3 KB). The producer holds these and shares them with the verifier. Anything off-chain can be checked against the on-chain commitments.

## 2. Main sequence

```mermaid
sequenceDiagram
  autonumber
  actor P as Producer
  participant W as Web app
  participant AI as Claude API
  participant C as CarbonPassport
  actor V as Verifier
  actor A as Importer A
  actor B as Importer B

  P->>W: upload invoices + production log
  W->>AI: extract quantities (structured output, cited)
  AI-->>W: activity lines + source refs + confidence
  P->>W: confirm each value
  W->>W: calculate SEE, run anomaly checks, build Merkle tree
  W->>C: submitBatch(installation, CN, period, tonnes, intensities, root, reportHash)
  V->>W: review evidence + anomaly flags
  V->>W: ML-DSA sign(domain, batchId, root, reportHash)
  V->>C: attestAndIssue(batchId, keccak(pqSig))
  C-->>P: mint N tonnes (ERC-1155 id = batchId)
  P->>C: ship(A, batchId, 6,000 t, shipmentRef)
  P->>C: ship(B, batchId, 4,000 t, shipmentRef)
  P->>C: ship(B, batchId, 2,000 t)  ❌ reverts: insufficient balance
  A->>C: surrender(batchId, 6,000 t, declarationRef)  🔥 burn
```

## 3. Smart contracts

Solidity 0.8.28 and OpenZeppelin Contracts 5.x. There's no ETH handling, so reentrancy has nothing to exploit.

### `VerifierRegistry`

| Function | Who | Effect |
|---|---|---|
| `accredit(verifier, name, accreditationRef, pqPublicKeyHash)` | `ACCREDITOR_ROLE` (accreditation body) | Adds or updates an active verifier |
| `revoke(verifier, reasonHash)` | `ACCREDITOR_ROLE` | Deactivates a verifier |
| `isActive(verifier) → bool` | anyone | |
| `getVerifier(verifier) → Verifier` | anyone | |

### `CarbonPassport` (ERC-1155, token id = batch id)

```solidity
struct Batch {
  address producer;          // installation operator
  bytes32 installationId;
  uint32  cnCode;            // e.g. 72083900 (hot-rolled flat steel)
  uint64  periodStart;       // unix seconds
  uint64  periodEnd;
  uint64  tonnes;            // product tonnes (integer)
  uint32  directKgPerT;      // kgCO2e per tonne
  uint32  indirectKgPerT;
  bytes32 dataRoot;          // Merkle root of salted evidence leaves
  bytes32 reportHash;        // sha256(canonical report JSON)
  address verifier;
  bytes32 pqSignatureHash;   // keccak256(ML-DSA-65 signature)
  uint64  submittedAt;
  uint64  issuedAt;
  uint64  surrendered;       // tonnes burned for declarations
  Status  status;            // None, Pending, Issued, Rejected, Revoked
}
```

| Function | Who | Checks | Effect |
|---|---|---|---|
| `registerInstallation(id, operator, name)` | `REGISTRAR_ROLE` | | Binds an installation to its operator |
| `submitBatch(...) → batchId` | the installation's operator | reportHash unused; period valid and after the last certified period | `Pending` |
| `attestAndIssue(batchId, pqSigHash)` | an active verifier | pending; verifier ≠ producer; period still free | `Issued`; mints `tonnes` to the producer |
| `rejectBatch(batchId, reasonHash)` | an active verifier | pending | `Rejected` |
| `ship(to, batchId, tonnes, shipmentRef)` | holder | balance ≥ tonnes; batch not revoked | Transfer + `Shipped` event |
| `surrender(batchId, tonnes, declarationRef)` | holder | balance ≥ tonnes | Burn + `Surrendered` event |
| `revokeBatch(batchId, reasonHash)` | issuing verifier or registrar | issued | `Revoked`; all transfers and burns frozen |
| `verifyDisclosure(batchId, key, value, unit, salt, proof) → bool` | anyone (view) | | Merkle inclusion against `dataRoot` |

**Invariants** (covered by tests):

1. `totalSupply(id) + surrendered(id) == tonnes(id)` for every issued batch, so tonnes are never created after issuance.
2. A `reportHash` can be used at most once.
3. For each installation and CN code, certified periods never overlap.
4. A producer can never verify its own batch. Only active accredited verifiers can issue.
5. A revoked batch can't move.

## 4. Evidence commitment

**Leaves:** `[key, value, unit, salt]`, encoded as `(string, string, string, bytes32)` in an OpenZeppelin `StandardMerkleTree`. Each leaf is `keccak256(bytes.concat(keccak256(abi.encode(...))))`. Examples:

| key | value | unit |
|---|---|---|
| `fuel.natural_gas` | `118400` | `GJ` |
| `electricity.grid` | `46250` | `MWh` |
| `input.electrodes` | `172` | `t` |
| `production.hrc` | `10000` | `t` |
| `doc.gas_invoice_2026-07.pdf` | `<sha256 hex>` | `sha256` |

- **Salt:** a random 32 bytes per leaf. Activity values have low entropy, and without salts someone could brute-force a leaf.
- **Tamper check:** a file dropped on the passport page is re-hashed (SHA-256). It matches only if a `doc.*` leaf with that hash proves into `dataRoot`.
- **Report hash:** SHA-256 of the canonical JSON report (sorted keys, no whitespace).

## 5. Hybrid verifier signature

- **ECDSA (secp256k1):** the verifier's transaction calling `attestAndIssue`. It's native and gives immediate non-repudiation.
- **ML-DSA-65 (FIPS 204)** via `@noble/post-quantum`. The message is the domain-separated tuple `("CarbonPass/v1", chainId, contract, batchId, dataRoot, reportHash)`. The signature is stored off-chain, and `keccak256(sig)` goes on-chain. The verifier's PQ public-key hash is registered in `VerifierRegistry`.
- **Why:** CBAM and ETS records must stay attributable for years. Hybrid signing keeps attestations unforgeable even if secp256k1 is broken during that period. It's crypto-agile: the scheme is versioned in the domain tag.

## 6. CBAM calculation (simplified, in `web/lib/cbam.ts`)

```
direct_t   = Σ fuel_GJ × EF_fuel (tCO2/GJ)  +  Σ process_input_t × EF_input (tCO2/t)
indirect_t = electricity_MWh × grid_EF (tCO2/MWh)
SEE_direct   = direct_t / production_t          (tCO2e per t product)
SEE_indirect = indirect_t / production_t
chargeable   = SEE_direct (+ SEE_indirect for cement, fertilisers)
cbam_cost(y) = tonnes × chargeable × CBAM_factor(y) × EU_ETS_price
default_cost(y) = tonnes × default_value × (1 + markup(y)) × CBAM_factor(y) × EU_ETS_price
```

All factors live in `web/data/factors.json`, each with a source and a verify note. Purchased pig iron is included as a **precursor** using the supplier's declared embedded emissions (`precursor_t × SEE_precursor`, added to direct). Recursive passport chaining (consuming the supplier's own CarbonPass batch) is on the roadmap.

## 7. Anomaly checks (in `web/lib/anomaly.ts`)

- **Robust z-score** against the installation's 12-month history: `z = 0.6745 × (x − median) / MAD`. Flag if |z| > 3.5. This is Iglewicz & Hoaglin's modified z-score.
- **Physical bounds** per route, e.g. EAF electricity 0.35–0.75 MWh/t. Out of range means a flag.
- **Cross-document consistency:** e.g. the invoiced MWh vs. the meter log, flagged above 2% difference.
- Flags are advisory. The verifier must acknowledge each one before signing.

## 8. AI extraction (in `web/app/api/extract`)

- The Claude API gets each document (PDF or image) and a **JSON schema** for the output. Each line has: `{ key, value, unit, period, source: { file, page, quote }, confidence }`.
- Documents are treated as untrusted data. The model has no tools, and its output is validated against the schema and unit whitelist.
- Model: `claude-opus-5-5` at `effort: low`, via `client.beta.messages.parse` with a Zod schema, plus `fallbacks: "default"` (server-side refusal fallback).
- Without an API key, pre-recorded sample outputs in `web/data/extractions/` are returned (hand-prepared, labelled as such in the UI), so the demo always works.

## 9. Web app

| Route | Role | Purpose |
|---|---|---|
| `/` | public | Problem, live chain stats, start demo |
| `/producer` | producer | Evidence upload → extraction → calculation → checks → submit |
| `/verifier` | verifier | Queue → evidence + flags → sign → issue (stamp) |
| `/shipments` | producer | Tonnage gauge, ship to A / B, over-ship revert |
| `/importer` | importer | Holdings, surrender at declaration |
| `/passport/[id]` | public | QR, intensity, verifier, timeline, tamper check, cost model |

API routes (`/api/tx/*`) sign with **demo role wallets** held as server env vars on testnet. In production each party signs with its own wallet or HSM. The UI shows the acting address on every action.

## 10. Deployment

- **Contracts:** Hardhat, `pnpm --filter contracts deploy:sepolia`, then source verification on Etherscan.
- **Seed:** register the verifier and installation, plus 3 historical issued batches (so the passport timeline and history aren't empty).
- **Web:** Vercel. Env vars: `RPC_URL`, contract addresses, demo role keys, optional `ANTHROPIC_API_KEY`.
