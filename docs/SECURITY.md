# Security & data-integrity assessment

What a blockchain can and can't guarantee here:

- **It can prove** that a record hasn't changed since it was committed, who signed it and when, and that tonnes were never counted twice.
- **It can't prove** on its own that the underlying meter reading was true. That's the "oracle problem".

CarbonPass handles that second gap with layered controls: AI cross-checks, statistical anomaly detection, an accredited human verifier, and revocation. We say this plainly rather than claiming "blockchain makes data true".

## 1. Assets

| Asset | Confidentiality | Integrity | Availability |
|---|---|---|---|
| Plant activity data (fuel, electricity, production) | **High** (commercially sensitive) | High | Medium |
| Verified intensity per batch | Public | **High** | High |
| Tonne balances (ownership of verified tonnes) | Public | **Critical** | High |
| Verifier attestation | Public | **Critical** | High |
| Role keys | **Critical** | Critical | Medium |

## 2. Threat model (STRIDE)

| # | Threat | Category | Mitigation in CarbonPass | Residual risk |
|---|---|---|---|---|
| T1 | Producer falsifies activity data (garbage in) | Tampering | Every value is cited to a source document. Anomaly detection runs against history and physical bounds, with cross-document checks. An accredited verifier must acknowledge every flag | Collusion with the verifier (T6) |
| T2 | The same period is certified twice | Tampering | The contract enforces non-overlapping periods per installation and CN code | None at contract level |
| T3 | The same report is reused for another batch | Tampering | `reportHash` uniqueness | None at contract level |
| T4 | Verified tonnes are sold to several importers (double counting) | Tampering / Repudiation | ERC-1155 balance conservation. Over-shipping reverts | None at contract level |
| T5 | Tonnes are reused across several CBAM declarations | Tampering | `surrender` burns them. The declaration reference is logged | The declaration itself sits in the EU registry; an integration hook is on the roadmap |
| T6 | A rogue or bribed verifier | Spoofing / Elevation | Only `ACCREDITOR_ROLE` adds verifiers. Revocation. Batches can be revoked and then frozen. Every attestation is publicly attributable | Detection depends on audits; on-chain data makes audits cheap |
| T7 | A producer verifies its own batch | Elevation | `verifier ≠ producer` check | None at contract level |
| T8 | An impersonated installation (someone else submits) | Spoofing | `registerInstallation` binds an installation to its operator. Only the operator can submit | Registrar key compromise (T10) |
| T9 | Evidence document swapped after issuance | Tampering | Document SHA-256 values are Merkle leaves. The passport tamper check fails on any changed byte | None |
| T10 | Key compromise (producer, verifier, admin) | Spoofing | Role separation (AccessControl). Revocation paths. Production: multisig for admin roles, HSM for verifiers | Window between compromise and revocation |
| T11 | Confidential data leaks from on-chain commitments | Information disclosure | Only roots and hashes on-chain. **Salted leaves** stop dictionary attacks on low-entropy values. Selective disclosure reveals one field at a time | Batch-level intensity is public by design (the importer needs it) |
| T12 | Future quantum attacks forge old attestations | Spoofing / Repudiation | **Hybrid signature:** ECDSA plus ML-DSA-65 (FIPS 204), with the PQ public key registered, so records stay attributable over long retention periods | Ethereum's own transaction signatures need an L1 migration; our attestations don't depend on it |
| T13 | AI extraction (Gemini) hallucinates or misreads a value | Tampering (accidental) | Schema-validated output, a unit whitelist, a citation (file + page + quote) per value, a confidence score, and **mandatory human confirmation**. The AI never writes on-chain | Human confirmation fatigue; low-confidence values are highlighted |
| T14 | Prompt injection inside an uploaded document | Elevation | Documents are treated as data. The model has no tools, no secrets in the prompt, and output validated against the schema | None meaningful |
| T15 | Smart-contract bugs | Tampering | OpenZeppelin bases, custom errors, no ETH handling, invariant-focused tests. Static analysis (Slither) is on the roadmap before mainnet | Unaudited prototype |
| T16 | Demo API abuse drains testnet gas | Denial of service | Demo-only role wallets, rate limiting, testnet only | Testnet only |

## 3. Contract invariants (tested)

1. Tonnes are conserved: supply plus surrendered equals issued.
2. Report hashes are unique.
3. Certified periods don't overlap.
4. Only active accredited verifiers can issue. A producer can't self-verify.
5. Revoked batches are frozen.
6. Disclosure proofs verify only for leaves in the committed root.

Test file: `contracts/test/CarbonPassport.test.ts`.

## 4. Cryptography choices

| Use | Primitive | Why |
|---|---|---|
| Document fingerprints, report hash | SHA-256 | Standard for document integrity and auditor-familiar |
| Evidence commitment | keccak256 Merkle tree (OpenZeppelin `StandardMerkleTree`) with 32-byte salts | Cheap on-chain verification; double-hashed leaves resist second-preimage attacks |
| Transaction / attestation signature | ECDSA secp256k1 | Native to EVM |
| Long-lived attestation signature | **ML-DSA-65** (NIST FIPS 204) | Post-quantum security; crypto-agile domain tag `CarbonPass/v1` |

## 5. Privacy & data protection

- There's no personal data on-chain. Installations are pseudonymous IDs, and entity names are held by the registry operator.
- Data minimisation: the chain holds only what an importer needs (intensity, tonnes, verifier) plus commitments.
- Producers control disclosure. Verifiers get the full bundle; importers get the passport and optional per-field proofs.

## 6. Responsible AI

- **Human in the loop:** AI suggests, humans confirm, verifiers sign.
- **Explainability:** every extracted value shows its source quote. Every anomaly flag shows its statistic and threshold.
- **Fairness:** anomaly thresholds compare an installation to *its own* history, not to a peer group that might penalise atypical-but-legitimate plants.
- **Accountability:** every on-chain action is attributable to a role address.

## 7. Known limitations of the prototype

Testnet only. Demo custodial keys. Illustrative emission factors. No external audit. The verifier workflow is simplified (no site visit). These are listed openly in the README.
