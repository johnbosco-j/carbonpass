# Problem statement & solution overview

**CarbonPass: verified embedded-emissions passports for EU CBAM**
Track: **Carbon Markets & Emissions Transparency**

## The problem

On **1 January 2026** the EU's Carbon Border Adjustment Mechanism (CBAM) entered its definitive period. Every tonne of steel, aluminium, cement, fertiliser, hydrogen or electricity imported into the EU now carries a carbon price, based on the emissions released to make it.

The legal obligation sits with the EU importer, but the data comes from the producer: a steel mill in Türkiye, an aluminium smelter in India. To declare **actual** emissions, that data must be checked by an accredited verifier. Otherwise the importer must use the EU's **default values, with a markup of 10% in 2026**. The charged share of emissions rises every year, from 2.5% in 2026 to 100% in 2034.

Today the data moves as spreadsheets and PDFs over email. This causes four failures:

1. **Clean producers are priced like dirty ones.** A mill that has invested in a cleaner process gets no reward if its data isn't trusted. Default values cut the link between carbon price and actual performance, and with it the incentive to decarbonise. This is the climate failure.
2. **Double counting.** Nothing stops the same verified low-carbon tonnes being promised to several buyers, the same reporting period being certified twice, or one report being reused across several declarations. This is the exact problem our track names.
3. **No verifiable chain of custody.** An importer receiving a PDF can't confirm it is the version the verifier approved, or that the verifier is accredited.
4. **Cost barrier for SMEs.** Turning invoices and meter logs into verifier-ready data is expensive consultant work. Small exporters, the members of chambers like the Istanbul Chamber of Commerce, are hit hardest.

The same data gap blocks **Türkiye's ETS pilot** (monitoring, reporting and verification only in 2026) and **India's Carbon Credit Trading Scheme**. One trusted pipeline can serve all three.

## Who it's for

| User | Pain today | What CarbonPass gives them |
|---|---|---|
| **Producer** (mill compliance officer, TR/IN) | Manual data prep; can't prove it's clean | AI-prepared, verifier-ready evidence; a passport they can share with buyers |
| **Accredited verifier** | Reviewing messy files; liability for sign-offs | Pre-checked evidence with anomaly flags; a signed, non-repudiable attestation |
| **EU importer** | Can't trust received data; default-value penalties | One QR scan to verify, plus the € saving; tonnes surrendered at declaration |
| **Policymaker / registry** | Fragmented MRV data | A consistent, auditable record that feeds national ETS and CBAM registries |

## The solution

1. **Capture (AI).** The producer uploads fuel and electricity invoices and the production log. An LLM extracts each quantity, with a citation to its document and page. A human confirms every value.
2. **Calculate.** A fixed calculator applies the CBAM method: direct emissions (fuels × emission factors, plus process inputs), indirect emissions (electricity × grid factor), divided by tonnes produced.
3. **Check (AI).** Robust statistical anomaly detection compares the month against the plant's own history and physical bounds, e.g. "intensity 38% below the 12-month median → verifier must review".
4. **Commit (blockchain).** The evidence is hashed into a salted Merkle tree. Only the root and the report hash go on-chain, so process data stays confidential.
5. **Attest (blockchain + cryptography).** An accredited verifier from the on-chain registry signs. This is a hybrid signature: the ECDSA transaction plus a **post-quantum ML-DSA** signature over the report, so it stays valid over multi-year record-keeping obligations. The contract then mints the batch: N tonnes at X kgCO₂e/t, as ERC-1155 tokens.
6. **Ship and surrender (blockchain).** Tonnes move to importers with shipments. When an importer files its CBAM declaration, it **burns** those tonnes. The contract makes double counting impossible:
   - you can't ship more tonnes than were verified
   - you can't certify an overlapping period twice
   - you can't reuse a report
   - you can't surrender tonnes you don't hold
7. **Prove.** A public passport page (from a QR code on the shipping documents) shows the verified intensity, the verifier, the full on-chain history, a **tamper check** for any evidence file, and the **cost saved versus default values**.

## Why blockchain is necessary here

The parties sit in different jurisdictions, and none will run or trust the others' database. The core risk, the same verified tonnes claimed twice, is a double-spend problem. Public ledgers solve that by design. Verifier sign-offs need public, timestamped non-repudiation. Commitments (hashes, Merkle roots) give transparency **without** disclosing confidential plant data.

## Why AI is necessary here

The bottleneck for SMEs is turning unstructured documents into structured, cited activity data. The bottleneck for verifiers is finding the few suspicious numbers in thousands. AI handles both, and **never** writes to the chain itself.

## Track alignment

The Carbon Markets & Emissions Transparency track asks for blockchain-based verification, real-time emissions tracking, and smart contracts to prevent double counting. CarbonPass does all three for the world's first operating carbon border price. Its passports are also digital product passports for the *Sustainable Supply Chains* track.
