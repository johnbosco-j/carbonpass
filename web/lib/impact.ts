import factors from "@/data/factors.json";
import type { ChainState } from "@/lib/chain/state";
import { costModel, defaultMarkup, defaultValue, type Country } from "./cbam";

/**
 * Climate-impact arithmetic for the /impact page. Every factor comes from data/factors.json through lib/cbam.ts;
 * nothing here hardcodes a default value, mark-up, phase-in factor or price.
 */

export const ETS_PRICE = factors.eu_ets_price_eur.value;

// ------------------------------------------------------------------ live ledger

export interface LedgerImpact {
  /** Issued (not revoked or rejected) batches of this product */
  batches: number;
  /** Verified tonnes of product minted by issued batches */
  verifiedT: number;
  /** Tonnes burned at CBAM declaration */
  surrenderedT: number;
  /** Tonnage-weighted mean verified intensity, tCO2e/t (direct, chargeable) */
  avgSee: number;
  /** EU default value for this product and origin, tCO2e/t (before mark-up) */
  defaultSee: number;
  /** Σ tonnes × (default − verified): emissions the default would have over-attributed. An accounting correction, not an abatement. */
  overstatementT: number;
  /** Σ CBAM bill on defaults − bill on verified data, 2026 factor, reference ETS price */
  saved2026: number;
}

/**
 * Only batches of `cnCode` count. Precursor batches (e.g. pig iron consumed by the mill) aren't imported into the EU,
 * and their emissions are already inside the downstream product's intensity, so counting them here would double count.
 */
export function ledgerImpact(state: ChainState | null, cnCode: number, country: Country, price = ETS_PRICE): LedgerImpact {
  const issued = state?.batches.filter((b) => b.status === "Issued" && b.cnCode === cnCode) ?? [];
  const defaultSee = defaultValue(cnCode, country);
  let verifiedT = 0;
  let kgT = 0;
  let overstatementT = 0;
  let saved2026 = 0;
  for (const b of issued) {
    const see = b.directKgPerT / 1000;
    const dv = defaultValue(b.cnCode, country);
    verifiedT += b.tonnes;
    kgT += b.tonnes * b.directKgPerT;
    overstatementT += b.tonnes * (dv - see);
    saved2026 += costModel({ tonnes: b.tonnes, seeChargeable: see, cnCode: b.cnCode, country, price, years: [2026] })[0].saving;
  }
  return {
    batches: issued.length,
    verifiedT,
    surrenderedT: issued.reduce((s, b) => s + b.surrendered, 0),
    avgSee: verifiedT ? kgT / verifiedT / 1000 : 0,
    defaultSee,
    overstatementT,
    saved2026,
  };
}

// ------------------------------------------------------------------ scenario simulator

export type AbatementTiming = "phased" | "immediate";

export interface Scenario {
  mills: number;
  /** EU exports per mill, kt of product per year */
  exportsKt: number;
  /** Verified intensity before any abatement, tCO2e/t */
  see: number;
  /** Intensity cut the restored price signal triggers by 2034, tCO2e/t */
  abatement: number;
  /** EU ETS price, €/tCO2e */
  price: number;
  country: Country;
  /** CN code of the product (selects the EU default value) */
  cnCode: number;
  /** "phased": the cut scales with the CBAM factor (the share of the carbon price actually charged). "immediate": full cut from 2026. */
  timing: AbatementTiming;
}

export interface ScenarioRow {
  year: number;
  factor: number;
  markup: number;
  defaultBill: number;
  verifiedBill: number;
  saving: number;
  /** € a 0.1 tCO2e/t cut is worth this year when the bill uses default values: always 0, the bill ignores real emissions */
  marginalDefault: number;
  /** € a 0.1 tCO2e/t cut is worth this year on verified data */
  marginalVerified: number;
  /** Intensity cut realised this year, tCO2e/t */
  cut: number;
  /** tCO2e avoided this year on EU exports */
  avoided: number;
  /** Extra CBAM saving the cut earns this year, € */
  abatementValue: number;
}

export interface ScenarioResult {
  tonnes: number;
  defaultSee: number;
  rows: ScenarioRow[];
  cumulativeSaving: number;
  cumulativeAvoided: number;
  /** Default-value overstatement on the scenario's exports, tCO2e/yr (accounting, not abatement) */
  overstatementPerYr: number;
}

export const MARGINAL_CUT = 0.1;

/**
 * Hand check (defaults below: 5 mills × 200 kt, TR, 0.337 tCO2e/t verified, Δ 0.05, €80, phased), T = 1,000,000 t:
 *   2026: default bill = 1,000,000 × 2.43 × (1 + 0.10) × 0.025 × 80 = €5,346,000
 *         verified bill = 1,000,000 × 0.337 × 0.025 × 80            =   €674,000   → saving €4,672,000
 *         marginal value of −0.1 t/t: defaults €0; verified 0.1 × 1,000,000 × 0.025 × 80 = €200,000
 *         avoided = 0.05 × 0.025 × 1,000,000 = 1,250 tCO2e
 *   2034: default bill = 1,000,000 × 2.43 × 1.30 × 1.00 × 80 = €252,720,000
 *         verified bill = 1,000,000 × 0.337 × 1.00 × 80        =  €26,960,000   → saving €225,760,000
 *         marginal value of −0.1 t/t on verified data = 0.1 × 1,000,000 × 80 = €8,000,000
 *         avoided = 0.05 × 1.00 × 1,000,000 = 50,000 tCO2e/yr (the docs/IMPACT.md pilot figure)
 *   Cumulative avoided 2026–2034 = 0.05 × 1,000,000 × ΣF, ΣF = 0.025+0.05+0.1+0.225+0.485+0.61+0.735+0.86+1 = 4.09
 *                                = 204,500 tCO2e ("immediate" timing: 0.05 × 1,000,000 × 9 = 450,000 tCO2e)
 *   Cumulative saving 2026–2034 = 4,672,000 + 1,000,000 × (2.43 × 1.2 − 0.337) × 0.05 × 80 [2027: 10,316,000]
 *                               + 1,000,000 × (2.43 × 1.3 − 0.337) × 80 × (0.1+0.225+0.485+0.61+0.735+0.86+1) [2028–34: 906,426,400]
 *                               = €921,414,400
 * Checked by running simulate() on these inputs (23 Oct 2026): every figure above matches.
 */
export function simulate(s: Scenario): ScenarioResult {
  const tonnes = s.mills * s.exportsKt * 1000;
  const defaultSee = defaultValue(s.cnCode, s.country);
  const bills = costModel({ tonnes, seeChargeable: s.see, cnCode: s.cnCode, country: s.country, price: s.price });
  const delta = Math.min(s.abatement, s.see);
  const rows = bills.map((b): ScenarioRow => {
    const cut = s.timing === "phased" ? delta * b.factor : delta;
    return {
      year: b.year,
      factor: b.factor,
      markup: defaultMarkup(b.year),
      defaultBill: b.defaultCost,
      verifiedBill: b.actualCost,
      saving: b.saving,
      marginalDefault: 0,
      marginalVerified: MARGINAL_CUT * tonnes * b.factor * s.price,
      cut,
      avoided: cut * tonnes,
      abatementValue: cut * tonnes * b.factor * s.price,
    };
  });
  return {
    tonnes,
    defaultSee,
    rows,
    cumulativeSaving: rows.reduce((t, r) => t + r.saving, 0),
    cumulativeAvoided: rows.reduce((t, r) => t + r.avoided, 0),
    overstatementPerYr: tonnes * (defaultSee - s.see),
  };
}

/** Compact € for chart ticks and labels: €5.3M, €640k. */
export function fmtEurShort(x: number): string {
  const a = Math.abs(x);
  const sign = x < 0 ? "−" : "";
  if (a >= 1e9) return `${sign}€${(a / 1e9).toFixed(a >= 1e10 ? 0 : 1)}B`;
  if (a >= 1e6) return `${sign}€${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e3) return `${sign}€${(a / 1e3).toFixed(0)}k`;
  return `${sign}€${a.toFixed(0)}`;
}

/** Compact tonnes: 1.2M, 450k, 980. */
export function fmtTShort(x: number): string {
  const a = Math.abs(x);
  if (a >= 1e6) return `${(x / 1e6).toFixed(a >= 1e7 ? 0 : 2)}M`;
  if (a >= 1e3) return `${(x / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k`;
  return x.toFixed(0);
}

/** A "nice" axis maximum and tick step for 0..max (1, 2, 2.5, 5 × 10^n). */
export function niceScale(max: number, ticks = 4): { max: number; step: number } {
  if (!(max > 0)) return { max: 1, step: 0.25 };
  const raw = max / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((m) => m >= raw)!;
  return { max: Math.ceil(max / step) * step, step };
}
