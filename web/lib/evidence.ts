import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { keccak256, toBytes } from "viem";
import type { Activity, CalcResult } from "./cbam";
import type { Check } from "./anomaly";

export type Hex = `0x${string}`;
export type Leaf = [key: string, value: string, unit: string, salt: Hex];
export const LEAF_TYPES = ["string", "string", "string", "bytes32"];

export type DocKind = "gas_invoice" | "electricity_invoice" | "production_log" | "meter_log";

export interface EvidenceDoc {
  name: string;
  kind: DocKind;
  sha256: Hex;
  size: number;
}

export interface SourceRef {
  file: string;
  page: number;
  quote: string;
}

export interface ActivityValue {
  key: keyof Activity | "electricity_meter_mwh";
  label: string;
  value: number;
  unit: string;
  source?: SourceRef;
  confidence?: number;
  extractedBy: "gemini" | "sample" | "manual";
  confirmed: boolean;
}

export interface EvidenceBundle {
  version: "carbonpass/evidence@1";
  installation: { code: string; id: Hex; name: string; country: "TR" | "IN" };
  cnCode: number;
  period: { month: string; start: number; end: number };
  activity: Activity;
  meterMwh?: number;
  values: ActivityValue[];
  documents: EvidenceDoc[];
  calc: CalcResult;
  checks: Check[];
  /** Precursor passports this batch consumes at issuance (also declared on-chain in submitBatch). */
  precursors?: { batchId: number; tonnes: number; directKgPerT: number }[];
  report: Record<string, unknown>;
  reportHash: Hex;
  leaves: Leaf[];
  dataRoot: Hex;
  createdAt: string;
}

// ------------------------------------------------------------------ hashing

/** Deterministic JSON: sorted keys, no whitespace, undefined dropped. */
export function canonical(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
    .join(",")}}`;
}

export async function sha256(data: ArrayBuffer | Uint8Array | string): Promise<Hex> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data instanceof Uint8Array ? data : new Uint8Array(data);
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return `0x${[...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export function randomSalt(): Hex {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return `0x${[...b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

export function installationId(code: string): Hex {
  return keccak256(toBytes(code));
}

// ------------------------------------------------------------------ bundle

const ACTIVITY_UNITS: Record<keyof Activity, string> = {
  production_t: "t",
  natural_gas_gj: "GJ",
  electricity_mwh: "MWh",
  electrodes_t: "t",
  charge_carbon_t: "t",
  pig_iron_t: "t",
};

export function buildReport(b: Omit<EvidenceBundle, "report" | "reportHash" | "leaves" | "dataRoot" | "createdAt">) {
  return {
    schema: "carbonpass/report@1",
    installation: b.installation.code,
    cnCode: b.cnCode,
    period: b.period,
    activity: b.activity,
    calculation: {
      lines: b.calc.lines.map((l) => ({ key: l.key, quantity: l.quantity, factor: l.factor, tco2: l.tco2, scope: l.scope })),
      seeDirect: b.calc.seeDirect,
      seeIndirect: b.calc.seeIndirect,
    },
    checks: b.checks.map((c) => ({ id: c.id, severity: c.severity })),
    documents: b.documents.map((d) => ({ name: d.name, sha256: d.sha256 })),
    precursors: b.precursors, // omitted from the hash when absent, so older reports hash the same
  };
}

/** Builds the private evidence bundle and its public commitments (report hash + Merkle root). */
export async function sealBundle(
  draft: Omit<EvidenceBundle, "report" | "reportHash" | "leaves" | "dataRoot" | "createdAt">,
  saltFn: () => Hex = randomSalt,
): Promise<EvidenceBundle> {
  const report = buildReport(draft);
  const reportHash = await sha256(canonical(report));
  const leaves: Leaf[] = [
    ...(Object.keys(ACTIVITY_UNITS) as (keyof Activity)[]).map(
      (k): Leaf => [`activity.${k}`, String(draft.activity[k]), ACTIVITY_UNITS[k], saltFn()],
    ),
    ...draft.documents.map((d): Leaf => [`doc.${d.name}`, d.sha256, "sha256", saltFn()]),
    ["report", reportHash, "sha256", saltFn()],
  ];
  const tree = StandardMerkleTree.of(leaves, LEAF_TYPES);
  return { ...draft, report, reportHash, leaves, dataRoot: tree.root as Hex, createdAt: new Date().toISOString() };
}

export function proofFor(bundle: Pick<EvidenceBundle, "leaves">, key: string) {
  const tree = StandardMerkleTree.of(bundle.leaves, LEAF_TYPES);
  for (const [i, leaf] of tree.entries()) {
    if (leaf[0] === key) return { leaf: leaf as Leaf, proof: tree.getProof(i) as Hex[] };
  }
  return null;
}
