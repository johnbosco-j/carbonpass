import factors from "@/data/factors.json";

export type Country = "TR" | "IN";

/** Monthly activity data for one installation and product. Keys match evidence leaf keys. */
export interface Activity {
  production_t: number;
  natural_gas_gj: number;
  electricity_mwh: number;
  electrodes_t: number;
  charge_carbon_t: number;
  pig_iron_t: number;
}

export interface CalcLine {
  key: string;
  label: string;
  quantity: number;
  unit: string;
  factor: number;
  factorUnit: string;
  tco2: number;
  scope: "direct" | "indirect" | "precursor";
  source: string;
}

export interface CalcResult {
  lines: CalcLine[];
  directT: number;
  precursorT: number;
  indirectT: number;
  /** tCO2e per tonne of product, direct incl. precursors (chargeable for iron & steel) */
  seeDirect: number;
  seeIndirect: number;
  directKgPerT: number;
  indirectKgPerT: number;
}

const round = (x: number, dp = 3) => Math.round(x * 10 ** dp) / 10 ** dp;

/** Simplified CBAM specific embedded emissions (SEE) for scrap-based EAF hot-rolled steel. */
export function calculate(a: Activity, country: Country = "TR"): CalcResult {
  const f = factors;
  const grid = f.grid[country];
  const lines: CalcLine[] = [
    {
      key: "fuel.natural_gas",
      label: "Natural gas (reheating, ladles)",
      quantity: a.natural_gas_gj,
      unit: "GJ",
      factor: f.fuels.natural_gas.ef_tco2_per_unit,
      factorUnit: "tCO₂/GJ",
      tco2: a.natural_gas_gj * f.fuels.natural_gas.ef_tco2_per_unit,
      scope: "direct",
      source: f.fuels.natural_gas.source,
    },
    {
      key: "input.electrodes",
      label: "Graphite electrodes",
      quantity: a.electrodes_t,
      unit: "t",
      factor: f.process_inputs.electrodes.ef_tco2_per_unit,
      factorUnit: "tCO₂/t",
      tco2: a.electrodes_t * f.process_inputs.electrodes.ef_tco2_per_unit,
      scope: "direct",
      source: f.process_inputs.electrodes.source,
    },
    {
      key: "input.charge_carbon",
      label: "Charge carbon",
      quantity: a.charge_carbon_t,
      unit: "t",
      factor: f.process_inputs.charge_carbon.ef_tco2_per_unit,
      factorUnit: "tCO₂/t",
      tco2: a.charge_carbon_t * f.process_inputs.charge_carbon.ef_tco2_per_unit,
      scope: "direct",
      source: f.process_inputs.charge_carbon.source,
    },
    {
      key: "precursor.pig_iron",
      label: "Purchased pig iron (precursor)",
      quantity: a.pig_iron_t,
      unit: "t",
      factor: f.precursors.pig_iron.see_tco2_per_unit,
      factorUnit: "tCO₂e/t",
      tco2: a.pig_iron_t * f.precursors.pig_iron.see_tco2_per_unit,
      scope: "precursor",
      source: f.precursors.pig_iron.source,
    },
    {
      key: "electricity.grid",
      label: "Grid electricity",
      quantity: a.electricity_mwh,
      unit: "MWh",
      factor: grid.ef_tco2_per_mwh,
      factorUnit: "tCO₂/MWh",
      tco2: a.electricity_mwh * grid.ef_tco2_per_mwh,
      scope: "indirect",
      source: grid.source,
    },
  ];
  const sum = (s: CalcLine["scope"]) => lines.filter((l) => l.scope === s).reduce((t, l) => t + l.tco2, 0);
  const directT = sum("direct");
  const precursorT = sum("precursor");
  const indirectT = sum("indirect");
  const seeDirect = (directT + precursorT) / a.production_t;
  const seeIndirect = indirectT / a.production_t;
  return {
    lines: lines.map((l) => ({ ...l, tco2: round(l.tco2, 1) })),
    directT: round(directT, 1),
    precursorT: round(precursorT, 1),
    indirectT: round(indirectT, 1),
    seeDirect: round(seeDirect, 3),
    seeIndirect: round(seeIndirect, 3),
    directKgPerT: Math.round(seeDirect * 1000),
    indirectKgPerT: Math.round(seeIndirect * 1000),
  };
}

// ------------------------------------------------------------------ cost model

export const YEARS = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034] as const;

export function cbamFactor(year: number): number {
  return (factors.cbam_factor as unknown as Record<string, number>)[String(year)] ?? 1;
}

/** Mark-up on default values: the value for the latest listed year at or before `year` (30% from 2028). */
export function defaultMarkup(year: number): number {
  const m = factors.default_markup as unknown as Record<string, number>;
  const years = Object.keys(m).filter((k) => /^\d{4}$/.test(k)).map(Number).sort((a, b) => a - b);
  const y = [...years].reverse().find((k) => k <= year) ?? years[0];
  return m[String(y)];
}

export function defaultValue(cnCode: number, country: Country): number {
  const dv = (factors.default_values as Record<string, Record<string, number | string>>)[String(cnCode)];
  return Number(dv?.[country] ?? NaN);
}

export interface CostRow {
  year: number;
  factor: number;
  defaultCost: number;
  actualCost: number;
  saving: number;
}

/** CBAM certificate cost on default values vs on verified actual data, for `tonnes` of product. */
export function costModel(opts: {
  tonnes: number;
  seeChargeable: number;
  cnCode: number;
  country: Country;
  price?: number;
  years?: readonly number[];
}): CostRow[] {
  const price = opts.price ?? factors.eu_ets_price_eur.value;
  const dv = defaultValue(opts.cnCode, opts.country);
  return (opts.years ?? YEARS).map((year) => {
    const factor = cbamFactor(year);
    const defaultCost = opts.tonnes * dv * (1 + defaultMarkup(year)) * factor * price;
    const actualCost = opts.tonnes * opts.seeChargeable * factor * price;
    return { year, factor, defaultCost, actualCost, saving: defaultCost - actualCost };
  });
}

export const fmtEur = (x: number) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(x);
export const fmtNum = (x: number, dp = 0) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp }).format(x);
