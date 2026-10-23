"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useDemo } from "@/components/demo-provider";
import { Badge, Button, Card, Fictional, Field, HashChip, Metric, SectionHead, cx, fmtT } from "@/components/ui";
import { ChecksList } from "@/components/checks-list";
import { activityFromValues, buildBundle, INSTALLATION, CN_CODE, PLANT, SAMPLE_DOCS, SUPPLIER, monthFromTs, monthLabel, nextMonth } from "@/lib/demo";
import type { PrecursorLink } from "@/lib/cbam";
import factors from "@/data/factors.json";
import { sha256, type ActivityValue, type DocKind, type EvidenceBundle, type EvidenceDoc } from "@/lib/evidence";

const PLANT_DEFAULT_PIG_IRON = factors.precursors.pig_iron.see_tco2_per_unit.toFixed(2);

interface LoadedDoc extends EvidenceDoc {
  label: string;
  data?: string; // base64, only for user uploads
}

interface ExtractResult {
  file: string;
  mode: "gemini" | "sample";
  model?: string;
  fallbackReason?: string;
  values: Omit<ActivityValue, "extractedBy" | "confirmed">[];
}

function guessKind(name: string): DocKind {
  const n = name.toLowerCase();
  if (n.includes("gas")) return "gas_invoice";
  if (n.includes("meter")) return "meter_log";
  if (n.includes("elec")) return "electricity_invoice";
  return "production_log";
}

async function fileToBase64(buf: ArrayBuffer) {
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export default function ProducerPage() {
  const { state, tx, saveBundle } = useDemo();
  const [docs, setDocs] = useState<LoadedDoc[]>([]);
  const [values, setValues] = useState<ActivityValue[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extractMode, setExtractMode] = useState<string | null>(null);
  const [bundle, setBundle] = useState<EvidenceBundle | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<number | null>(null);
  const [linkPassport, setLinkPassport] = useState(true);
  const [pickedPassport, setPickedPassport] = useState<number | null>(null);

  // Next free reporting month for this installation (sandbox: each run certifies the next month).
  const month = useMemo(() => {
    const mine = state?.batches.filter((b) => b.installationId.toLowerCase() === INSTALLATION.id.toLowerCase() && b.status !== "Rejected") ?? [];
    if (!mine.length) return PLANT.demoMonth.month;
    const last = Math.max(...mine.map((b) => b.periodEnd));
    return nextMonth(monthFromTs(last));
  }, [state]);

  async function loadSamples() {
    const loaded = await Promise.all(
      SAMPLE_DOCS.map(async (d) => {
        const buf = await (await fetch(`/samples/${d.name}`)).arrayBuffer();
        return { name: d.name, kind: d.kind, label: d.label, sha256: await sha256(buf), size: buf.byteLength };
      }),
    );
    setDocs(loaded);
    setValues([]);
    setBundle(null);
    setSubmittedId(null);
  }

  async function addFiles(files: FileList | null) {
    if (!files) return;
    const loaded = await Promise.all(
      [...files].map(async (f) => {
        const buf = await f.arrayBuffer();
        const kind = guessKind(f.name);
        return { name: f.name, kind, label: kind.replace("_", " "), sha256: await sha256(buf), size: buf.byteLength, data: await fileToBase64(buf) };
      }),
    );
    setDocs((d) => [...d.filter((x) => !loaded.some((l) => l.name === x.name)), ...loaded]);
    setValues([]);
    setBundle(null);
  }

  async function extract() {
    setExtracting(true);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ documents: docs.map((d) => ({ name: d.name, kind: d.kind, data: d.data })) }),
      });
      const json = (await res.json()) as { mode: string; results: ExtractResult[] };
      setExtractMode(json.mode);
      setValues(
        json.results.flatMap((r) =>
          r.values.map((v) => ({ ...v, extractedBy: r.mode === "gemini" ? "gemini" : "sample", confirmed: false }) as ActivityValue),
        ),
      );
      setBundle(null);
    } finally {
      setExtracting(false);
    }
  }

  const allConfirmed = values.length > 0 && values.every((v) => v.confirmed);
  const derived = useMemo(() => (allConfirmed ? activityFromValues(values) : null), [allConfirmed, values]);

  // Verified pig-iron passports from the supplier. Default: the one the mill holds most of, else the latest (so a
  // reuse attempt after consumption can be shown being rejected by the contract).
  const pigIron = useMemo(
    () => state?.batches.filter((b) => b.installationId.toLowerCase() === SUPPLIER.id.toLowerCase() && b.status !== "Pending" && b.status !== "Rejected") ?? [],
    [state],
  );
  const passport =
    pigIron.find((b) => b.id === pickedPassport) ??
    [...pigIron].sort((a, b) => (b.balances.producer ?? 0) - (a.balances.producer ?? 0) || b.id - a.id)[0] ??
    null;
  const precursor: PrecursorLink | undefined =
    linkPassport && passport ? { batchId: passport.id, directKgPerT: passport.directKgPerT, supplier: `${SUPPLIER.name} (fictional)` } : undefined;
  const pigIronNeeded = Math.round(derived?.activity.pig_iron_t ?? PLANT.demoMonth.pig_iron_t);
  const held = passport?.balances.producer ?? 0;
  const consumedBy = state?.events.filter((e) => e.type === "PrecursorConsumed" && Number(e.args.precursorId) === passport?.id) ?? [];

  async function seal() {
    if (!derived) return;
    setBundle(
      await buildBundle({
        month,
        activity: derived.activity,
        meterMwh: derived.meterMwh,
        values,
        documents: docs.map(({ name, kind, sha256, size }) => ({ name, kind, sha256, size })),
        precursor,
      }),
    );
  }

  async function submit() {
    if (!bundle) return;
    setSubmitting(true);
    const res = await tx(
      "submit",
      {
        installationId: INSTALLATION.id,
        cnCode: CN_CODE,
        periodStart: bundle.period.start,
        periodEnd: bundle.period.end,
        tonnes: Math.round(bundle.activity.production_t),
        directKgPerT: bundle.calc.directKgPerT,
        indirectKgPerT: bundle.calc.indirectKgPerT,
        dataRoot: bundle.dataRoot,
        reportHash: bundle.reportHash,
        precursors: (bundle.precursors ?? []).map(({ batchId, tonnes }) => ({ batchId, tonnes })),
      },
      `Submit ${monthLabel(bundle.period.month)} batch`,
    );
    setSubmitting(false);
    if (res.ok && res.batchId) {
      saveBundle(res.batchId, bundle);
      setSubmittedId(res.batchId);
    }
  }

  const reviewFlags = bundle?.checks.filter((c) => c.severity === "review") ?? [];
  // Once sealed, the bundle's own period is authoritative (the "next free month" moves on after submission).
  const periodMonth = bundle?.period.month ?? month;

  return (
    <div className="space-y-10">
      <header className="animate-fade-up">
        <div className="label">Producer · step 1 of 5</div>
        <h1 className="mt-2 font-serif text-3xl font-semibold sm:text-4xl">{PLANT.installation.name}</h1>
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <Field label="Installation">
            <span className="font-mono">{INSTALLATION.code}</span> <Fictional />
          </Field>
          <Field label="Route">{PLANT.installation.routeLabel}</Field>
          <Field label="Product">
            {PLANT.installation.product.name} · <span className="font-mono">CN {CN_CODE}</span>
          </Field>
          <Field label="Reporting period">
            <span className="font-semibold">{monthLabel(periodMonth)}</span>
            {periodMonth !== PLANT.demoMonth.month && <span className="block text-xs text-ink-muted">sandbox: reusing the July 2026 sample evidence</span>}
          </Field>
        </div>
      </header>

      {/* 01 Evidence */}
      <section>
        <SectionHead n="01" title="Evidence" hint="Invoices, production report and check-meter log for the month. Files are hashed in your browser." />
        <div className="flex flex-wrap gap-3">
          <Button onClick={loadSamples}>Load sample evidence</Button>
          <label className="inline-flex cursor-pointer items-center rounded-[2px] border border-rule bg-surface px-5 py-3 text-xs font-semibold uppercase tracking-[0.08em] hover:border-steel">
            Upload PDFs
            <input type="file" accept="application/pdf" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
          </label>
        </div>
        {docs.length > 0 && (
          <Card className="mt-4 p-0 sm:p-0">
            <ul>
              {docs.map((d) => (
                <li key={d.name} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-rule px-5 py-3 last:border-0">
                  <span aria-hidden className="text-steel">▤</span>
                  <a href={d.data ? undefined : `/samples/${d.name}`} target="_blank" rel="noreferrer" className="font-medium hover:text-molten">
                    {d.name}
                  </a>
                  <span className="text-sm text-ink-muted">{d.label}</span>
                  <span className="ml-auto">
                    <HashChip value={d.sha256} label="sha256" />
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* 02 Extraction */}
      <section className={cx(!docs.length && "opacity-40")}>
        <SectionHead
          n="02"
          title="AI extraction"
          hint="Gemini reads each document and returns structured quantities with a verbatim source quote. Confirm every value; the AI never writes to the chain."
          right={
            <Button variant="secondary" disabled={!docs.length || extracting} onClick={extract}>
              {extracting ? "Reading documents…" : values.length ? "Re-extract" : "Extract with AI"}
            </Button>
          }
        />
        {extractMode && (
          <p className="mb-3 text-xs text-ink-muted">
            {extractMode === "gemini"
              ? "Live extraction by Gemini (structured JSON output, verbatim citations)."
              : extractMode === "mixed"
                ? "Some documents fell back to pre-recorded sample output (live extraction failed for them)."
                : "Showing pre-recorded sample extraction output. Live AI extraction runs when a Gemini API key is configured."}
          </p>
        )}
        {values.length > 0 && (
          <Card className="overflow-x-auto p-0 sm:p-0">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-rule text-left">
                  <th scope="col" className="label px-5 py-3">Quantity</th>
                  <th scope="col" className="label px-3 py-3 text-right">Value</th>
                  <th scope="col" className="label px-3 py-3">Source</th>
                  <th scope="col" className="label px-3 py-3">Conf.</th>
                  <th scope="col" className="label px-5 py-3 text-right">Confirm</th>
                </tr>
              </thead>
              <tbody>
                {values.map((v, i) => (
                  <tr key={v.key} className="border-b border-rule last:border-0">
                    <td className="px-5 py-3">
                      <div className="font-medium">{v.label}</div>
                      {!v.confirmed && <span className="text-[0.7rem] uppercase tracking-wider text-anomaly">extracted · unconfirmed</span>}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <input
                        aria-label={`${v.label} value`}
                        className="w-28 rounded-[2px] border border-rule bg-paper px-2 py-1 text-right font-mono tnum"
                        value={v.value}
                        onChange={(e) =>
                          setValues((vs) => vs.map((x, j) => (j === i ? { ...x, value: Number(e.target.value), extractedBy: "manual", confirmed: false } : x)))
                        }
                      />
                      <span className="ml-1.5 text-ink-muted">{v.unit}</span>
                    </td>
                    <td className="max-w-[320px] px-3 py-3 text-ink-muted">
                      <span className="font-mono text-xs">
                        {v.source?.file} · p.{v.source?.page}
                      </span>
                      <div className="truncate text-xs" title={v.source?.quote}>
                        “{v.source?.quote}”
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={cx("inline-block h-2.5 w-2.5 rounded-full", (v.confidence ?? 0) >= 0.95 ? "bg-verified" : "bg-anomaly")}
                        title={`confidence ${v.confidence}`}
                      />
                      <span className="ml-1.5 font-mono text-xs tnum">{v.confidence?.toFixed(2)}</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <input
                        type="checkbox"
                        aria-label={`Confirm ${v.label}`}
                        className="h-4 w-4 accent-[var(--color-molten)]"
                        checked={v.confirmed}
                        onChange={(e) => setValues((vs) => vs.map((x, j) => (j === i ? { ...x, confirmed: e.target.checked } : x)))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end border-t border-rule px-5 py-3">
              <Button variant="ghost" onClick={() => setValues((vs) => vs.map((x) => ({ ...x, confirmed: true })))}>
                Confirm all
              </Button>
            </div>
          </Card>
        )}
      </section>

      {/* 03 Calculation + checks */}
      <section className={cx(!allConfirmed && "opacity-40")}>
        <SectionHead
          n="03"
          title="Calculation & checks"
          hint="CBAM specific embedded emissions (simplified), then anomaly checks against the plant's own 12-month history."
          right={
            <Button variant="secondary" disabled={!derived} onClick={seal}>
              {bundle ? "Recalculate" : "Calculate"}
            </Button>
          }
        />
        {passport && (
          <Card className="mb-4 space-y-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="label">Precursor passport</span>
              <Link href={`/passport/${passport.id}`} className="font-mono text-sm hover:text-molten">
                #{passport.id}
              </Link>
              <span className="text-sm">
                {SUPPLIER.product.name} · {SUPPLIER.name} <Fictional />
              </span>
              <span className="font-mono text-sm tnum">verified {(passport.directKgPerT / 1000).toFixed(3)} tCO₂e/t</span>
              {passport.status === "Revoked" && <Badge tone="revoked">Revoked</Badge>}
              {pigIron.length > 1 && (
                <select
                  aria-label="Precursor passport"
                  className="ml-auto rounded-[2px] border border-rule bg-paper px-2 py-1 text-sm"
                  value={passport.id}
                  onChange={(e) => {
                    setPickedPassport(Number(e.target.value));
                    setBundle(null);
                  }}
                >
                  {pigIron.map((b) => (
                    <option key={b.id} value={b.id}>
                      #{b.id} · {monthLabel(monthFromTs(b.periodStart))} · you hold {fmtT(b.balances.producer ?? 0)} t
                    </option>
                  ))}
                </select>
              )}
            </div>
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-[var(--color-molten)]"
                checked={linkPassport}
                onChange={(e) => {
                  setLinkPassport(e.target.checked);
                  setBundle(null);
                }}
              />
              <span>
                Use the supplier&apos;s verified intensity for {fmtT(pigIronNeeded)} t of pig iron instead of the EU default (
                {PLANT_DEFAULT_PIG_IRON} tCO₂e/t). The contract burns these {fmtT(pigIronNeeded)} t of passport #{passport.id} when this batch is issued, so
                they can&apos;t be counted in any other product.
              </span>
            </label>
            <p className={cx("text-xs", linkPassport && held < pigIronNeeded ? "text-anomaly" : "text-ink-muted")}>
              You hold <span className="font-mono tnum">{fmtT(held)} t</span> of passport #{passport.id}.
              {held < pigIronNeeded &&
                (consumedBy.length
                  ? ` ${fmtT(consumedBy.reduce((t, e) => t + Number(e.args.tonnes), 0))} t were already consumed by batch ${consumedBy.map((e) => `#${e.batchId}`).join(", ")}. Submitting this claim anyway shows the contract rejecting the reuse.`
                  : " Not enough for this claim: the contract will reject it.")}
            </p>
          </Card>
        )}
        {bundle && (
          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <Card className="overflow-x-auto p-0 sm:p-0">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-rule text-left">
                    <th scope="col" className="label px-5 py-3">Source</th>
                    <th scope="col" className="label px-3 py-3 text-right">Activity</th>
                    <th scope="col" className="label px-3 py-3 text-right">Factor</th>
                    <th scope="col" className="label px-5 py-3 text-right">tCO₂e</th>
                  </tr>
                </thead>
                <tbody className="font-mono tnum">
                  {bundle.calc.lines.map((l) => (
                    <tr key={l.key} className="border-b border-rule">
                      <td className="px-5 py-2.5 font-sans">
                        {l.label} <span className="ml-1 text-[0.7rem] uppercase tracking-wider text-ink-muted">{l.scope}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {fmtT(l.quantity)} <span className="font-sans text-ink-muted">{l.unit}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {l.factor} <span className="font-sans text-xs text-ink-muted">{l.factorUnit}</span>
                      </td>
                      <td className="px-5 py-2.5 text-right">{fmtT(l.tco2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card className="space-y-5">
              <Metric label="Direct incl. precursors (chargeable for steel)" value={bundle.calc.seeDirect.toFixed(3)} unit="tCO₂e/t" accent />
              <Metric label="Indirect (reported, not charged for steel)" value={bundle.calc.seeIndirect.toFixed(3)} unit="tCO₂e/t" />
              <p className="border-t border-rule pt-3 text-xs text-ink-muted">
                Factors: IPCC 2006 / EU MRR standard values; grid factor illustrative. See data/factors.json.{" "}
                {bundle.precursors?.length
                  ? `Pig iron: the supplier's verified passport #${bundle.precursors[0].batchId}, read from the chain.`
                  : "Pig iron: EU default value for Türkiye."}
              </p>
            </Card>
            <div className="xl:col-span-2">
              <ChecksList checks={bundle.checks} />
            </div>
          </div>
        )}
      </section>

      {/* 04 Commit */}
      <section className={cx(!bundle && "opacity-40")}>
        <SectionHead
          n="04"
          title="Commit & submit to verifier"
          hint="The evidence is sealed into a salted Merkle tree. Only the root and the report hash go on-chain; the bundle stays with you and your verifier."
        />
        {bundle && (
          <Card className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Data root (Merkle)">
                <HashChip value={bundle.dataRoot} />
              </Field>
              <Field label="Report hash (sha256)">
                <HashChip value={bundle.reportHash} />
              </Field>
              <Field label="Committed leaves">
                <span className="font-mono tnum">{bundle.leaves.length}</span> <span className="text-ink-muted">(activity, documents, report)</span>
              </Field>
            </div>
            {bundle.precursors?.map((p) => (
              <p key={p.batchId} className="text-sm">
                <Badge tone="steel">Precursor</Badge>{" "}
                <span className="ml-2">
                  Consumes <span className="font-mono tnum">{fmtT(p.tonnes)} t</span> of pig-iron passport{" "}
                  <Link href={`/passport/${p.batchId}`} className="font-mono hover:text-molten">
                    #{p.batchId}
                  </Link>{" "}
                  at {(p.directKgPerT / 1000).toFixed(3)} tCO₂e/t when the verifier issues this batch. Nothing is burned if it&apos;s rejected.
                </span>
              </p>
            ))}
            {reviewFlags.length > 0 && (
              <p className="text-sm">
                <Badge tone="anomaly">{reviewFlags.length} flag{reviewFlags.length > 1 ? "s" : ""} for review</Badge>{" "}
                <span className="ml-2 text-ink-muted">Flags don&apos;t block submission. The verifier must acknowledge each one before signing.</span>
              </p>
            )}
            {submittedId ? (
              <div className="flex flex-wrap items-center gap-4 border-t border-rule pt-4">
                <Badge tone="pending">Pending verification</Badge>
                <span className="text-sm">
                  Batch <span className="font-mono">#{submittedId}</span> submitted for {monthLabel(periodMonth)}.
                </span>
                <Link href={`/verifier?batch=${submittedId}`} className="ml-auto text-sm font-semibold text-molten hover:underline">
                  Continue as verifier →
                </Link>
              </div>
            ) : (
              <Button onClick={submit} disabled={submitting}>
                {submitting ? "Submitting…" : `Submit ${fmtT(bundle.activity.production_t)} t for verification`}
              </Button>
            )}
          </Card>
        )}
      </section>
    </div>
  );
}
