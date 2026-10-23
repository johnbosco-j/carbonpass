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

> **All inputs are illustrative assumptions for a fictional installation.** Replace `DV` with the official EU default value for the CN code and country before quoting.

Assumptions: an EAF mill exports **100,000 t/yr** of hot-rolled coil to the EU. Verified direct SEE = **0.35 tCO₂e/t**. Default value **1.80 tCO₂e/t** (placeholder). Markup held at the 2026 level of **10%** (conservative). EU ETS price **€80/t**.

| Year | CBAM factor | Bill on default values | Bill on verified data | **Saving** |
|---|---|---|---|---|
| 2026 | 2.5% | €396,000 | €70,000 | **€326,000** |
| 2028 | 10% | €1,584,000 | €280,000 | **€1,304,000** |
| 2030 | 48.5% | €7,682,400 | €1,358,000 | **€6,324,400** |
| 2034 | 100% | €15,840,000 | €2,800,000 | **€13,040,000** |

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
