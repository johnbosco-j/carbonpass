"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { useDemo, type TxResponse } from "@/components/demo-provider";
import { ChecksList } from "@/components/checks-list";
import { Stamp } from "@/components/stamp";
import { Badge, Button, Card, Fictional, Field, HashChip, SectionHead, StatusBadge, cx, fmtDate, fmtT } from "@/components/ui";
import { canonical, LEAF_TYPES, sha256 } from "@/lib/evidence";
import { monthFromTs, monthLabel, PLANT } from "@/lib/demo";

export default function VerifierPage() {
  return (
    <Suspense>
      <Verifier />
    </Suspense>
  );
}

function Verifier() {
  const params = useSearchParams();
  const { state, tx, loadBundle } = useDemo();
  const pending = useMemo(() => state?.batches.filter((b) => b.status === "Pending") ?? [], [state]);
  const [selected, setSelected] = useState<number | null>(Number(params.get("batch")) || null);
  const batchId = selected ?? pending.at(-1)?.id ?? null;
  const batch = state?.batches.find((b) => b.id === batchId) ?? null;
  const bundle = useMemo(() => (batchId ? loadBundle(batchId) : null), [batchId, loadBundle]);

  const [integrity, setIntegrity] = useState<{ report: boolean; root: boolean } | null>(null);
  const [ack, setAck] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TxResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!bundle || !batch) return setIntegrity(null);
      const reportOk = (await sha256(canonical(bundle.report))) === batch.reportHash;
      const rootOk = StandardMerkleTree.of(bundle.leaves, LEAF_TYPES).root === batch.dataRoot;
      if (!cancelled) setIntegrity({ report: reportOk, root: rootOk });
    })();
    return () => {
      cancelled = true;
    };
  }, [bundle, batch]);

  const flags = bundle?.checks.filter((c) => c.severity === "review") ?? [];
  const allAck = flags.every((f) => ack[f.id]);
  const canSign = batch?.status === "Pending" && !!bundle && integrity?.report && integrity?.root && allAck;

  async function sign() {
    if (!batchId) return;
    setBusy(true);
    const res = await tx("attest", { batchId, acknowledged: Object.keys(ack).filter((k) => ack[k]) }, `Verify & issue batch #${batchId}`);
    setBusy(false);
    if (res.ok) setResult(res);
  }

  async function reject() {
    if (!batchId) return;
    setBusy(true);
    await tx("reject", { batchId, reason: "Insufficient supporting evidence for flagged values" }, `Reject batch #${batchId}`);
    setBusy(false);
  }

  return (
    <div className="space-y-10">
      <header className="animate-fade-up">
        <div className="label">Verifier · step 2 of 5</div>
        <h1 className="mt-2 font-serif text-3xl font-semibold sm:text-4xl">{state?.verifier.name ?? "Accredited verifier"}</h1>
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <Field label="Accreditation">
            <span className="font-mono">{PLANT.verifier.accreditation}</span> <Fictional />
          </Field>
          <Field label="Registry status">{state?.verifier.active ? <Badge tone="verified">Active</Badge> : <Badge tone="revoked">Inactive</Badge>}</Field>
          <Field label="Verifier address">{state && <HashChip value={state.verifier.address} href={state.explorer ? `${state.explorer}/address/${state.verifier.address}` : null} />}</Field>
          <Field label="Post-quantum key (ML-DSA-65)">{state && <HashChip value={state.verifier.pqPublicKeyHash} label="keccak" />}</Field>
        </div>
      </header>

      <section>
        <SectionHead n="01" title="Queue" hint="Batches submitted by installation operators, waiting for an accredited verifier." />
        <div className="flex flex-wrap gap-2">
          {pending.length === 0 && <p className="text-sm text-ink-muted">No pending batches. Submit one from the producer screen.</p>}
          {pending.map((b) => (
            <button
              key={b.id}
              onClick={() => {
                setSelected(b.id);
                setResult(null);
                setAck({});
              }}
              className={cx("rounded-[2px] border px-4 py-2 text-left text-sm", b.id === batchId ? "border-molten bg-surface" : "border-rule bg-surface hover:border-steel")}
            >
              <span className="font-mono">#{b.id}</span> · {monthLabel(monthFromTs(b.periodStart))} · {fmtT(b.tonnes)} t
            </button>
          ))}
        </div>
      </section>

      {batch && (
        <section>
          <SectionHead n="02" title={`Batch #${batch.id}`} right={<StatusBadge status={batch.status} />} />
          <Card className="grid gap-4 sm:grid-cols-4">
            <Field label="Period">
              {fmtDate(batch.periodStart)} → {fmtDate(batch.periodEnd)}
            </Field>
            <Field label="Tonnes">
              <span className="font-mono tnum">{fmtT(batch.tonnes)}</span> t · CN <span className="font-mono">{batch.cnCode}</span>
            </Field>
            <Field label="Claimed intensity">
              <span className="font-mono tnum">{(batch.directKgPerT / 1000).toFixed(3)}</span> tCO₂e/t direct
            </Field>
            <Field label="Producer">
              <HashChip value={batch.producer} />
            </Field>
            <Field label="Data root">
              <HashChip value={batch.dataRoot} />
            </Field>
            <Field label="Report hash">
              <HashChip value={batch.reportHash} />
            </Field>
          </Card>
        </section>
      )}

      {batch && (
        <section>
          <SectionHead n="03" title="Evidence review" hint="The producer shares the private evidence bundle with the verifier. It must match the on-chain commitments exactly." />
          {!bundle ? (
            <Card>
              <p className="text-sm text-ink-muted">
                The evidence package for this batch isn&apos;t in this browser. In production it arrives over an encrypted channel from the producer.
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Badge tone={integrity?.report ? "verified" : "revoked"}>{integrity?.report ? "✓" : "✗"} report hash matches chain</Badge>
                <Badge tone={integrity?.root ? "verified" : "revoked"}>{integrity?.root ? "✓" : "✗"} Merkle root matches chain</Badge>
                <Badge tone="steel">{bundle.documents.length} documents</Badge>
              </div>
              <Card className="overflow-x-auto p-0 sm:p-0">
                <table className="w-full min-w-[640px] text-sm">
                  <tbody>
                    {bundle.values.map((v) => (
                      <tr key={v.key} className="border-b border-rule last:border-0">
                        <td className="px-5 py-2.5 font-medium">{v.label}</td>
                        <td className="px-3 py-2.5 text-right font-mono tnum">
                          {fmtT(v.value)} <span className="font-sans text-ink-muted">{v.unit}</span>
                        </td>
                        <td className="px-5 py-2.5 text-xs text-ink-muted">
                          <a className="font-mono hover:text-molten" href={`/samples/${v.source?.file}`} target="_blank" rel="noreferrer">
                            {v.source?.file} p.{v.source?.page}
                          </a>{" "}
                          “{v.source?.quote}”
                        </td>
                        <td className="px-5 py-2.5 text-right text-[0.7rem] uppercase tracking-wider text-ink-muted">{v.extractedBy === "cached" ? "sample" : v.extractedBy} · confirmed</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
              {flags.length > 0 && (
                <Card className="border-l-4 border-l-steel">
                  <div className="label">Producer&apos;s explanation</div>
                  <p className="mt-1 text-sm">{PLANT.demoMonth.anomalyExplanation}</p>
                </Card>
              )}
              <ChecksList checks={bundle.checks} acknowledged={ack} onAcknowledge={(id, v) => setAck((a) => ({ ...a, [id]: v }))} />
            </div>
          )}
        </section>
      )}

      {batch && (
        <section>
          <SectionHead
            n="04"
            title="Sign & issue"
            hint="Hybrid attestation: your Ethereum transaction (ECDSA) plus an ML-DSA-65 post-quantum signature over the batch commitments, published on-chain."
          />
          {result || batch.status === "Issued" ? (
            <Card className="flex flex-wrap items-center gap-8">
              <Stamp caption={monthFromTs(batch.periodStart)} animate={!!result} />
              <div className="space-y-3">
                <p className="font-serif text-2xl font-semibold">{fmtT(batch.tonnes)} verified tonnes issued</p>
                {result?.pq && (
                  <p className="text-sm text-ink-muted">
                    {result.pq.scheme}: <span className="font-mono tnum">{fmtT(result.pq.signatureBytes)}</span> byte signature, signed in{" "}
                    <span className="font-mono tnum">{result.pq.signMs}</span> ms. Its keccak hash is stored in the batch; the full signature is in the event log.
                  </p>
                )}
                <div className="flex flex-wrap gap-4">
                  <Link href={`/shipments?batch=${batch.id}`} className="text-sm font-semibold text-molten hover:underline">
                    Ship tonnes to importers →
                  </Link>
                  <Link href={`/passport/${batch.id}`} className="text-sm font-semibold hover:underline">
                    View passport
                  </Link>
                </div>
              </div>
            </Card>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={sign} disabled={!canSign || busy}>
                {busy ? "Signing…" : "Sign (ECDSA + ML-DSA) & issue"}
              </Button>
              <Button variant="secondary" onClick={reject} disabled={batch.status !== "Pending" || busy}>
                Reject
              </Button>
              {!allAck && bundle && <span className="text-sm text-anomaly">Acknowledge every flag before signing.</span>}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
