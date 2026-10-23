import factors from "@/data/factors.json";
import type { Activity } from "./cbam";

export type Severity = "ok" | "review";

export interface Check {
  id: string;
  metric: string;
  label: string;
  value: number;
  unit: string;
  kind: "robust_z" | "bounds" | "cross_doc";
  severity: Severity;
  detail: string;
  stat?: { median: number; mad: number; z: number; deltaPct: number };
}

const Z_THRESHOLD = 3.5; // Iglewicz & Hoaglin modified z-score cut-off
const CROSS_DOC_TOLERANCE = 0.02;

const INTENSITY_METRICS: { metric: keyof Activity; label: string; unit: string; scale: number }[] = [
  { metric: "natural_gas_gj", label: "Natural gas per tonne", unit: "GJ/t", scale: 1 },
  { metric: "electricity_mwh", label: "Electricity per tonne", unit: "MWh/t", scale: 1 },
  { metric: "electrodes_t", label: "Electrodes per tonne", unit: "kg/t", scale: 1000 },
  { metric: "charge_carbon_t", label: "Charge carbon per tonne", unit: "kg/t", scale: 1000 },
  { metric: "pig_iron_t", label: "Pig iron share", unit: "t/t", scale: 1 },
];

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Modified z-score: 0.6745 (x − median) / MAD. Robust to outliers in the history itself. */
export function robustZ(x: number, history: number[]) {
  const med = median(history);
  const mad = median(history.map((h) => Math.abs(h - med))) || 1e-9;
  return { median: med, mad, z: (0.6745 * (x - med)) / mad, deltaPct: ((x - med) / med) * 100 };
}

const BOUNDS_KEY: Partial<Record<keyof Activity, [string, number]>> = {
  electricity_mwh: ["electricity_mwh_per_t", 1],
  natural_gas_gj: ["natural_gas_gj_per_t", 1],
  electrodes_t: ["electrodes_kg_per_t", 1000],
  charge_carbon_t: ["charge_carbon_kg_per_t", 1000],
};

/**
 * Advisory checks for a verifier. They compare the installation with its own history (not with peers)
 * and with physical plausibility bounds. Nothing here blocks a submission: flags must be acknowledged.
 */
export function runChecks(current: Activity, history: Activity[], meterMwh?: number): Check[] {
  const checks: Check[] = [];
  const bounds = factors.physical_bounds.eaf_hot_rolled as unknown as Record<string, [number, number]>;

  for (const m of INTENSITY_METRICS) {
    const per = (a: Activity) => (a[m.metric] / a.production_t) * m.scale;
    const value = per(current);
    const stat = robustZ(value, history.map(per));
    const flagged = Math.abs(stat.z) > Z_THRESHOLD;
    checks.push({
      id: `z.${m.metric}`,
      metric: m.metric,
      label: m.label,
      value,
      unit: m.unit,
      kind: "robust_z",
      severity: flagged ? "review" : "ok",
      stat,
      detail: flagged
        ? `${stat.deltaPct > 0 ? "+" : ""}${stat.deltaPct.toFixed(0)}% vs 12-month median (modified z = ${stat.z.toFixed(1)}, threshold ±${Z_THRESHOLD}). Verifier must review supporting evidence.`
        : `Within normal range of the plant's own history (modified z = ${stat.z.toFixed(1)}).`,
    });

    const bk = BOUNDS_KEY[m.metric];
    if (bk) {
      const [lo, hi] = bounds[bk[0]];
      const v = (current[m.metric] / current.production_t) * bk[1];
      const inside = v >= lo && v <= hi;
      checks.push({
        id: `bounds.${m.metric}`,
        metric: m.metric,
        label: `${m.label}: physical range`,
        value: v,
        unit: m.unit,
        kind: "bounds",
        severity: inside ? "ok" : "review",
        detail: inside
          ? `Inside plausible range for EAF + hot rolling (${lo}–${hi} ${m.unit}).`
          : `Outside plausible range ${lo}–${hi} ${m.unit}.`,
      });
    }
  }

  if (meterMwh !== undefined) {
    const diff = Math.abs(current.electricity_mwh - meterMwh) / meterMwh;
    checks.push({
      id: "cross.electricity",
      metric: "electricity_mwh",
      label: "Electricity invoice vs meter log",
      value: diff * 100,
      unit: "%",
      kind: "cross_doc",
      severity: diff > CROSS_DOC_TOLERANCE ? "review" : "ok",
      detail: `Invoice ${current.electricity_mwh.toFixed(1)} MWh vs meter ${meterMwh.toFixed(1)} MWh (${(diff * 100).toFixed(2)}% difference, tolerance ${CROSS_DOC_TOLERANCE * 100}%).`,
    });
  }
  return checks;
}
