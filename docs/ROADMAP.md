# Implementation, adoption & scalability roadmap

## Adoption strategy

**Who pays and why:**

- **Producers** pay per verified passport. That's far cheaper than the default-value penalty (see IMPACT.md) and than consultant-prepared reports.
- **Verifiers** get a free workspace. Pre-checked evidence means less review time per batch.
- **Importers** verify for free. Every passport they scan pulls their suppliers onto the network.

**Go-to-market:**

1. **Chambers & export associations.** The Istanbul Chamber of Commerce (a hackathon partner) and Indian export promotion councils reach thousands of CBAM-exposed SMEs.
2. **Verifiers as channel.** One accredited verifier brings all of its clients.
3. **EU importer pull.** Importers want actual values to cut their certificate bill, so they ask suppliers for a CarbonPass link.

**Friction we remove:** no crypto wallet is needed for importers or the public. Producers and verifiers can use managed keys. The outputs export to the existing CBAM communication template.

## Phases

| Phase | When | Scope | Exit criteria |
|---|---|---|---|
| **0: Prototype** | Hackathon (Oct 2026) | Steel (EAF), one installation, testnet, full flow | Working demo; contracts tested |
| **1: Pilot** | Q1–Q2 2027 | 3–5 Turkish / Indian installations, 1 verifier, 2 EU importers. A permissioned EVM (Hyperledger Besu) or public L2. CBAM template export. Slither + external audit | First 2026 CBAM declarations (due 30 Sep 2027) filed on verified data |
| **2: Registry interop** | H2 2027 | Feeds to the EU CBAM Registry, the Türkiye ETS registry (EXIST) and India's CCTS. W3C Verifiable Credentials. EBSI-compatible issuer identities | One dataset → three compliance regimes |
| **3: All CBAM goods** | 2028 | Cement and fertilisers (indirect emissions chargeable) → **retire renewable-electricity certificates into batches** so they can't be double-claimed. Aluminium. Hydrogen | Multi-sector coverage |
| **4: Supply-chain chaining** | 2028+ | **Precursor passports** (pig iron → steel already works in the prototype): extend to alumina, clinker and ammonia, so any precursor batch is consumed into a downstream batch and embedded emissions propagate automatically. EU Digital Product Passport (ESPR) alignment | End-to-end product carbon footprint |

## Scalability

| Dimension | Approach |
|---|---|
| Transactions | One batch per installation × product × period (not per shipment): thousands, not millions, per year. Shipments are cheap token transfers. An L2 or permissioned chain keeps costs below €0.01 |
| Data volume | Raw data stays off-chain. On-chain storage per batch is about 0.5 KB |
| Confidentiality at scale | Today: salted Merkle commitments + selective disclosure. Next: **zero-knowledge proofs** that the SEE was computed correctly from committed data, without revealing it |
| Interoperability | Standard token interface (ERC-1155), W3C VC export, CBAM template mapping, ISO 14064-3 aligned verification statements |
| Governance | Accreditation bodies hold `ACCREDITOR_ROLE`, national registries hold `REGISTRAR_ROLE`, multisig admin, upgrade via a versioned redeploy + migration |
| Crypto-agility | Versioned signature domain tags. ML-DSA today, swappable for other NIST PQC schemes |

## Standards alignment

- EU CBAM Regulation (EU) 2023/956 and its implementing regulations (methodology, default values, verification)
- GHG Protocol / ISO 14064-1 (quantification), ISO 14064-3 (verification), ISO 14067 (product carbon footprint)
- W3C Verifiable Credentials 2.0 (passport export), EU Digital Product Passport (ESPR)
- NIST FIPS 204 (ML-DSA)

## Sustainability of the solution itself

Proof-of-stake chains (Ethereum, its L2s) and permissioned networks use negligible energy per transaction. The system adds far less CO₂ than a single avoided default-value overestimate.
