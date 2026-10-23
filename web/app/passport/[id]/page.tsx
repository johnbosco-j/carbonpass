"use client";

import { use, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { useDemo } from "@/components/demo-provider";
import { CostModel } from "@/components/cost-model";
import { TonnageGauge } from "@/components/gauge";
import { Stamp } from "@/components/stamp";
import { TamperCheck } from "@/components/tamper-check";
import { Badge, Button, Card, Fictional, Field, HashChip, SectionHead, StatusBadge, fmtDate, fmtDateTime, fmtT } from "@/components/ui";
import { CN_CODE, INSTALLATION, monthFromTs, monthLabel, PLANT } from "@/lib/demo";

interface PqResult {
  verified: boolean;
  scheme: string;
  signatureBytes: number;
  publicKeyBytes: number;
  signatureHashMatches: boolean;
  publicKeyHashMatches: boolean;
  signatureValid: boolean;
  verifyMs: number;
  txHash: string;
  reason?: string;
}

const EVENT_LABEL: Record<string, string> = {
  BatchSubmitted: "Submitted by producer",
  BatchIssued: "Verified & issued",
  BatchRejected: "Rejected by verifier",
  BatchRevoked: "Revoked",
  Shipped: "Shipped",
  Surrendered: "Surrendered for CBAM declaration",
};

export default function PassportPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number(use(params).id);
  const { state, loadBundle } = useDemo();
  const batch = state?.batches.find((b) => b.id === id);
  const events = state?.events.filter((e) => e.batchId === id) ?? [];
  const bundle = useMemo(() => loadBundle(id), [id, loadBundle]);
  const [qr, setQr] = useState<string | null>(null);
  const [pq, setPq] = useState<PqResult | null>(null);
  const [pqBusy, setPqBusy] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(window.location.href, { margin: 1, width: 240, color: { dark: "#10203a", light: "#ffffff" } }).then(setQr);
  }, []);

  const nameOf = (addr: string) => {
    const role = Object.entries(state?.roles ?? {}).find(([, a]) => a.toLowerCase() === String(addr).toLowerCase())?.[0];
    return PLANT.importers.find((i) => i.key === role)?.name ?? (role === "producer" ? PLANT.installation.name : addr);
  };

  async function verifyPq() {
    setPqBusy(true);
    setPq(await (await fetch(`/api/pq/${id}`)).json());
    setPqBusy(false);
  }

  if (!state) return <p className="text-ink-muted">Loading ledger…</p>;
  if (!batch) return <p className="text-ink-muted">Batch #{id} not found on {state.network}.</p>;
  const month = monthFromTs(batch.periodStart);

  return (
    <div className="space-y-10">
      {/* Passport card */}
      <div className="animate-fade-up relative overflow-hidden rounded-[4px] border border-rule bg-surface shadow-[0_8px_24px_rgba(16,32,58,0.08)]">
        <div className="perforated h-2 bg-sunken" />
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_auto]">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="label">CBAM carbon passport</span>
              <span className="font-mono text-sm">#{batch.id}</span>
              <StatusBadge status={batch.status} />
            </div>
            <div>
              <h1 className="font-serif text-3xl font-semibold sm:text-4xl">
                {PLANT.installation.product.name}, {monthLabel(month)}
              </h1>
              <p className="mt-2 text-ink-muted">
                {PLANT.installation.name} · {PLANT.installation.city}, {PLANT.installation.country} <Fictional />
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-3">
              <div>
                <div className="label">Verified embedded emissions</div>
                <div className="mt-1 font-mono text-4xl font-semibold text-molten tnum">{(batch.directKgPerT / 1000).toFixed(3)}</div>
                <div className="text-sm text-ink-muted">tCO₂e per tonne (direct incl. precursors)</div>
              </div>
              <div>
                <div className="label">Indirect (electricity)</div>
                <div className="mt-1 font-mono text-2xl font-semibold tnum">{(batch.indirectKgPerT / 1000).toFixed(3)}</div>
                <div className="text-sm text-ink-muted">tCO₂e/t · reported</div>
              </div>
              <div>
                <div className="label">Verified tonnes</div>
                <div className="mt-1 font-mono text-2xl font-semibold tnum">{fmtT(batch.tonnes)}</div>
                <div className="text-sm text-ink-muted">CN {batch.cnCode}</div>
              </div>
            </div>
            <div className="grid gap-4 border-t border-rule pt-5 sm:grid-cols-3">
              <Field label="Reporting period">
                {fmtDate(batch.periodStart)} → {fmtDate(batch.periodEnd)}
              </Field>
              <Field label="Verifier">
                {state.verifier.name}
                <div className="mt-1">
                  <HashChip value={batch.verifier} href={state.explorer ? `${state.explorer}/address/${batch.verifier}` : null} />
                </div>
              </Field>
              <Field label="Commitments">
                <div className="flex flex-col gap-1">
                  <HashChip value={batch.dataRoot} label="root" />
                  <HashChip value={batch.reportHash} label="report" />
                </div>
              </Field>
            </div>
          </div>
          <div className="flex flex-col items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL QR code */}
            {qr && <img src={qr} alt="QR code linking to this passport" width={160} height={160} className="rounded-[2px] border border-rule" />}
            {batch.status === "Issued" && <Stamp caption={month} animate={false} size={120} />}
          </div>
        </div>
      </div>

      <section>
        <SectionHead
          n="01"
          title="Post-quantum attestation"
          hint="Checks the verifier's ML-DSA-65 signature using only chain data: the signature from the issuance event and the public key from the accreditation event."
          right={
            <Button variant="secondary" onClick={verifyPq} disabled={pqBusy || batch.status === "Pending"}>
              {pqBusy ? "Verifying…" : "Verify signature"}
            </Button>
          }
        />
        {pq && (
          <Card className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <Badge tone={pq.verified ? "verified" : "revoked"}>{pq.verified ? "✓ Valid" : `✗ ${pq.reason ?? "Invalid"}`}</Badge>
            {pq.scheme && (
              <>
                <span className="text-sm">{pq.scheme}</span>
                <span className="font-mono text-sm tnum">sig {fmtT(pq.signatureBytes)} B · pk {fmtT(pq.publicKeyBytes)} B · {pq.verifyMs} ms</span>
                <span className="text-sm text-ink-muted">
                  hash of signature {pq.signatureHashMatches ? "✓" : "✗"} · registered key {pq.publicKeyHashMatches ? "✓" : "✗"}
                </span>
                <HashChip value={pq.txHash} href={state.explorer ? `${state.explorer}/tx/${pq.txHash}` : null} label="tx" />
              </>
            )}
          </Card>
        )}
      </section>

      <section>
        <SectionHead n="02" title="Conservation of verified tonnes" />
        <Card>
          <TonnageGauge batch={batch} />
        </Card>
      </section>

      <section>
        <SectionHead n="03" title="What verified data is worth" hint="CBAM certificates needed for these tonnes on EU default values vs this batch's verified intensity." />
        <CostModel tonnes={batch.tonnes} see={batch.directKgPerT / 1000} cnCode={CN_CODE} country={INSTALLATION.country} />
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div>
          <SectionHead n="04" title="Ledger timeline" />
          <Card className="p-0 sm:p-0">
            <ol>
              {events.map((e) => (
                <li key={e.txHash + e.type} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-rule px-5 py-3 last:border-0">
                  <span className="h-2 w-2 rounded-full bg-molten" />
                  <span className="font-medium">{EVENT_LABEL[e.type] ?? e.type}</span>
                  {e.type === "Shipped" && (
                    <span className="text-sm text-ink-muted">
                      {fmtT(Number(e.args.tonnes))} t → {nameOf(String(e.args.to))}
                    </span>
                  )}
                  {e.type === "Surrendered" && (
                    <span className="text-sm text-ink-muted">
                      {fmtT(Number(e.args.tonnes))} t by {nameOf(String(e.args.holder))}
                    </span>
                  )}
                  <span className="ml-auto font-mono text-xs text-ink-muted">{fmtDateTime(e.timestamp)}</span>
                  <HashChip value={e.txHash} href={e.explorer} label="tx" />
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <div>
          <SectionHead n="05" title="Tamper check" />
          <TamperCheck batchId={batch.id} bundle={bundle} />
        </div>
      </section>
    </div>
  );
}
