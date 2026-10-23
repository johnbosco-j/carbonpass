import plant from "@/data/plant.json";
import { calculate, type Activity } from "./cbam";
import { runChecks } from "./anomaly";
import { installationId, sealBundle, type ActivityValue, type EvidenceDoc, type Hex } from "./evidence";

export const PLANT = plant;
export const INSTALLATION = {
  code: plant.installation.code,
  id: installationId(plant.installation.code),
  name: plant.installation.name,
  country: plant.installation.country as "TR" | "IN",
};
export const CN_CODE = plant.installation.product.cnCode;

export const SAMPLE_DOCS: { name: string; kind: EvidenceDoc["kind"]; label: string }[] = [
  { name: "gas_invoice_2026-07.pdf", kind: "gas_invoice", label: "Natural gas invoice" },
  { name: "electricity_invoice_2026-07.pdf", kind: "electricity_invoice", label: "Electricity invoice" },
  { name: "production_log_2026-07.pdf", kind: "production_log", label: "Production & materials report" },
  { name: "meter_log_2026-07.pdf", kind: "meter_log", label: "Check-meter log" },
];

const toActivity = (h: (typeof plant.history)[number]): Activity => ({
  production_t: h.production_t,
  natural_gas_gj: h.natural_gas_gj,
  electricity_mwh: h.electricity_mwh,
  electrodes_t: h.electrodes_t,
  charge_carbon_t: h.charge_carbon_t,
  pig_iron_t: h.pig_iron_t,
});

export const HISTORY: { month: string; activity: Activity }[] = plant.history.map((h) => ({ month: h.month, activity: toActivity(h) }));

/** Unix seconds for the first and last second of a "YYYY-MM" month (UTC). */
export function monthPeriod(month: string) {
  const [y, m] = month.split("-").map(Number);
  const start = Date.UTC(y, m - 1, 1) / 1000;
  const end = Date.UTC(y, m, 1) / 1000 - 1;
  return { month, start, end };
}

export function nextMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

export function monthFromTs(ts: number) {
  const d = new Date(ts * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** Turns confirmed evidence values into Activity (+ check-meter reading). */
export function activityFromValues(values: ActivityValue[]): { activity: Activity; meterMwh?: number } | null {
  const get = (k: string) => values.find((v) => v.key === k)?.value;
  const a = {
    production_t: get("production_t"),
    natural_gas_gj: get("natural_gas_gj"),
    electricity_mwh: get("electricity_mwh"),
    electrodes_t: get("electrodes_t"),
    charge_carbon_t: get("charge_carbon_t"),
    pig_iron_t: get("pig_iron_t"),
  };
  if (Object.values(a).some((v) => v === undefined || Number.isNaN(v))) return null;
  return { activity: a as Activity, meterMwh: get("electricity_meter_mwh") };
}

/** Calculation + anomaly checks + sealed evidence bundle for one installation-month. */
export async function buildBundle(opts: {
  month: string;
  activity: Activity;
  meterMwh?: number;
  values: ActivityValue[];
  documents: EvidenceDoc[];
  history?: Activity[];
  saltFn?: () => Hex;
}) {
  const history = opts.history ?? HISTORY.filter((h) => h.month < opts.month).slice(-12).map((h) => h.activity);
  const calc = calculate(opts.activity, INSTALLATION.country);
  const checks = runChecks(opts.activity, history.length >= 6 ? history : HISTORY.map((h) => h.activity), opts.meterMwh);
  return sealBundle(
    {
      version: "carbonpass/evidence@1",
      installation: INSTALLATION,
      cnCode: CN_CODE,
      period: monthPeriod(opts.month),
      activity: opts.activity,
      meterMwh: opts.meterMwh,
      values: opts.values,
      documents: opts.documents,
      calc,
      checks,
    },
    opts.saltFn,
  );
}
