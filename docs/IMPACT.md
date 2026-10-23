# Climate impact assessment

## 1. Theory of change

CarbonPass doesn't capture carbon itself. Its impact comes from **re-connecting the carbon price to actual performance**:

```
Unverifiable data → default values → bill doesn't depend on real emissions → marginal value of abatement ≈ €0
Verified data     → actual values  → every tCO2e/t cut lowers the bill  → marginal value of abatement > €0
```

Under default values, a mill that cuts its emissions pays the same CBAM bill as one that doesn't. With trusted, verified data, every tonne of CO₂ abated is money saved at the border. That incentive grows each year as the CBAM factor phases in, from 2.5% in 2026 to 100% in 2034.

Secondary effects:
- **Market integrity:** double counting of low-carbon claims becomes technically impossible. That protects the credibility of "green steel" premiums.
- **Cheaper MRV at scale:** the same pipeline produces data for **Türkiye's ETS pilot** (MRV-only in 2026) and **India's CCTS**. Better measurement is the precondition for meaningful caps.
- **Inclusion:** SMEs that can't afford consultants can still reach actual-value reporting, so climate policy doesn't simply push them out of the EU market.

## 2. Quantification method

Per installation, per year `y`:

```
savings(y)            = T × [DV × (1 + m(y)) − SEE] × F(y) × P
abatement_value(y)    = ΔSEE × T × F(y) × P          (the € value of cutting intensity by ΔSEE)
emissions_reduced(y)  = ΔSEE × T_total               (tCO2e/yr, if the incentive triggers abatement ΔSEE)
```

`T` = tonnes exported to the EU · `DV` = default value · `m` = default markup · `SEE` = verified specific embedded emissions · `F` = CBAM factor · `P` = EU ETS price · `T_total` = total production.

## 3. Illustrative scenario

> The installation is fictional and its intensity comes from the demo's sample evidence. The **default value is the EU's published CBAM default for hot-rolled flat steel from Türkiye** (2.43 tCO₂e/t, direct emissions, Implementing Reg. (EU) 2025/2621 Annex I). Check it against the July 2026 corrections (Reg. 2026/1740) before quoting.

Assumptions: an EAF mill in İzmir exports **100,000 t/yr** of hot-rolled coil to the EU. Its verified SEE (direct + precursors) is **0.356 tCO₂e/t**, the figure the demo calculates. Default value **2.43 tCO₂e/t**, with a mark-up of **10% (2026), 20% (2027), 30% from 2028**. EU ETS price **€80/t** (an assumption; adjustable in the app).

| Year | CBAM factor | Bill on default values | Bill on verified data | **Saving** |
|---|---|---|---|---|
| 2026 | 2.5% | €534,600 | €71,200 | **€463,400** |
| 2028 | 10% | €2,527,200 | €284,800 | **€2,242,400** |
| 2030 | 48.5% | €12,256,920 | €1,381,280 | **€10,875,640** |
| 2034 | 100% | €25,272,000 | €2,848,000 | **€22,424,000** |

This matches what Turkish exporters themselves report. About 70% of Türkiye's steel is made via the electric-arc-furnace route, and the Aegean Ferrous and Non-Ferrous Metals Exporters' Association says the default values don't reflect that lower-carbon production ([SteelOrbis, 1 Apr 2026](https://www.steelorbis.com/steel-news/latest-news/turkish-steel-sector-cbam-default-values-fail-to-reflect-low-carbon-production-1445161.htm)). Verified, plant-level data is exactly what they are asking for.

**The abatement incentive** (what cutting 0.1 tCO₂e/t is worth on 100 kt of exports):

| Year | Under default values | Under verified data |
|---|---|---|
| 2026 | €0 | €20,000 / yr |
| 2030 | €0 | €388,000 / yr |
| 2034 | €0 | €800,000 / yr |

**Emissions scenario for a pilot.** Take 5 installations, each producing 200 kt/yr. Suppose the restored incentive drives a 0.05 tCO₂e/t cut (e.g. switching reheating-furnace fuel, or optimising electrode and charge-carbon use). That's 5 × 200,000 × 0.05 = **50,000 tCO₂e/yr avoided**. This is a scenario showing the order of magnitude, not a forecast.

## 4. Indicators we'd track in a pilot

- Share of shipments declared on actual vs. default values
- Verified SEE trend per installation over time
- Double-counting attempts blocked (reverted transactions)
- Time from data upload to verifier sign-off
- Cost per verified passport vs. consultant baseline

## 5. Limitations & risks to impact

- **Resource shuffling:** a producer could send its cleanest output to the EU and the rest elsewhere. Installation-level batches make the mass balance visible but don't stop this. Policy has to.
- **Verification quality:** impact depends on honest verifiers. We reduce the cost of auditing them; we don't remove the need.
- **Scope:** for steel and aluminium only direct emissions are chargeable, so electricity-side improvements show up in CBAM only for cement and fertilisers. We still report indirect emissions for buyers' Scope 3.
- The numbers above are sensitive to the default values and the ETS price. The app's cost model lets users change both.
