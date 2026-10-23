"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { useDemo } from "@/components/demo-provider";
import { TonnageGauge } from "@/components/gauge";
import { Button, Card, Fictional, HashChip, SectionHead, cx, fmtDateTime, fmtT } from "@/components/ui";
import { monthFromTs, monthLabel, PLANT } from "@/lib/demo";

const IMPORTERS = PLANT.importers as { key: "importerA" | "importerB"; name: string; city: string; country: string }[];

export default function ShipmentsPage() {
  return (
    <Suspense>
      <Shipments />
    </Suspense>
  );
}

function Shipments() {
  const params = useSearchParams();
  const { state, tx } = useDemo();
  const issued = useMemo(() => state?.batches.filter((b) => b.status === "Issued" || b.status === "Revoked") ?? [], [state]);
  const [selected, setSelected] = useState<number | null>(Number(params.get("batch")) || null);
  const batch = issued.find((b) => b.id === selected) ?? issued.at(-1) ?? null;

  const [to, setTo] = useState<"importerA" | "importerB">("importerA");
  const [tonnes, setTonnes] = useState(6000);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  const shipments = state?.events.filter((e) => e.type === "Shipped" && e.batchId === batch?.id) ?? [];
  const nameOf = (addr: string) => {
    const role = Object.entries(state?.roles ?? {}).find(([, a]) => a.toLowerCase() === String(addr).toLowerCase())?.[0];
    return IMPORTERS.find((i) => i.key === role)?.name ?? addr;
  };

  async function ship() {
    if (!batch) return;
    setBusy(true);
    const ref = `MRN-26${to === "importerA" ? "DE" : "NL"}-B${batch.id}-${String(shipments.length + 1).padStart(3, "0")}`;
    const res = await tx("ship", { batchId: batch.id, to, tonnes, shipmentRef: ref }, `Ship ${fmtT(tonnes)} t → ${IMPORTERS.find((i) => i.key === to)?.city}`);
    setBusy(false);
    if (!res.ok) setShake((s) => s + 1);
  }

  return (
    <div className="space-y-10">
      <header className="animate-fade-up">
        <div className="label">Producer · shipments · step 3 of 5</div>
        <h1 className="mt-2 font-serif text-3xl font-semibold sm:text-4xl">Allocate verified tonnes to importers</h1>
        <p className="mt-3 max-w-2xl text-ink-muted">
          Each shipment transfers verified tonnes with a customs reference. The contract conserves tonnes: you can&apos;t ship more low-carbon steel than was
          verified, whoever asks.
        </p>
      </header>

      <section>
        <SectionHead n="01" title="Batch" />
        <div className="flex flex-wrap gap-2">
          {issued.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelected(b.id)}
              className={cx("rounded-[2px] border px-4 py-2 text-sm", b.id === batch?.id ? "border-molten bg-surface" : "border-rule bg-surface hover:border-steel")}
            >
              <span className="font-mono">#{b.id}</span> · {monthLabel(monthFromTs(b.periodStart))}
            </button>
          ))}
          {!issued.length && <p className="text-sm text-ink-muted">No issued batches yet.</p>}
        </div>
      </section>

      {batch && (
        <>
          <section>
            <SectionHead
              n="02"
              title={`${fmtT(batch.tonnes)} t verified at ${(batch.directKgPerT / 1000).toFixed(3)} tCO₂e/t`}
              hint="Live balances read from the ERC-1155 contract."
              right={
                <Link href={`/passport/${batch.id}`} className="text-sm font-semibold hover:text-molten">
                  Passport →
                </Link>
              }
            />
            <Card>
              <TonnageGauge batch={batch} shakeKey={shake} />
            </Card>
          </section>

          <section>
            <SectionHead n="03" title="New shipment" />
            <Card className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                {IMPORTERS.map((imp) => (
                  <label
                    key={imp.key}
                    className={cx("flex cursor-pointer items-start gap-3 rounded-[2px] border p-4", to === imp.key ? "border-molten" : "border-rule hover:border-steel")}
                  >
                    <input type="radio" name="to" className="mt-1 accent-[var(--color-molten)]" checked={to === imp.key} onChange={() => setTo(imp.key)} />
                    <span>
                      <span className="font-semibold">{imp.name}</span> <Fictional />
                      <span className="block text-sm text-ink-muted">
                        {imp.city}, {imp.country}
                      </span>
                      {state && <HashChip value={state.roles[imp.key]} />}
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <div className="label">Tonnes</div>
                  <input
                    type="number"
                    min={1}
                    value={tonnes}
                    onChange={(e) => setTonnes(Math.max(1, Math.round(Number(e.target.value))))}
                    className="mt-1 w-36 rounded-[2px] border border-rule bg-paper px-3 py-2.5 font-mono tnum"
                  />
                </div>
                {[6000, 4000, 2000].map((t) => (
                  <Button key={t} variant="secondary" onClick={() => setTonnes(t)}>
                    {fmtT(t)}
                  </Button>
                ))}
                <Button onClick={ship} disabled={busy || batch.status !== "Issued"} className="sm:ml-auto">
                  {busy ? "Shipping…" : `Ship ${fmtT(tonnes)} t`}
                </Button>
              </div>
              <p className="text-xs text-ink-muted">
                With producer now: <span className="font-mono tnum">{fmtT(batch.balances.producer ?? 0)} t</span>. Try shipping more than that: the transaction is
                broadcast anyway and the contract rejects it on-chain.
              </p>
            </Card>
          </section>

          <section>
            <SectionHead n="04" title="Shipment ledger" />
            <Card className="overflow-x-auto p-0 sm:p-0">
              <table className="w-full min-w-[560px] text-sm">
                <tbody>
                  {shipments.length === 0 && (
                    <tr>
                      <td className="px-5 py-4 text-ink-muted">No shipments yet.</td>
                    </tr>
                  )}
                  {shipments.map((e) => (
                    <tr key={e.txHash} className="border-b border-rule last:border-0">
                      <td className="px-5 py-3 font-mono text-xs text-ink-muted">{fmtDateTime(e.timestamp)}</td>
                      <td className="px-3 py-3">{nameOf(String(e.args.to))}</td>
                      <td className="px-3 py-3 text-right font-mono tnum">{fmtT(Number(e.args.tonnes))} t</td>
                      <td className="px-5 py-3 text-right">
                        <HashChip value={e.txHash} href={e.explorer} label="tx" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
