"use client";

import Link from "next/link";
import { useState } from "react";
import { useDemo } from "@/components/demo-provider";
import { Badge, Button, Card, Fictional, HashChip, SectionHead, StatusBadge, cx, fmtDateTime, fmtT } from "@/components/ui";
import { costModel, fmtEur } from "@/lib/cbam";
import { CN_CODE, INSTALLATION, monthFromTs, monthLabel, PLANT } from "@/lib/demo";

const IMPORTERS = PLANT.importers as { key: "importerA" | "importerB"; name: string; city: string; country: string }[];

export default function ImporterPage() {
  const { state, tx } = useDemo();
  const [who, setWho] = useState<"importerA" | "importerB">("importerA");
  const [amounts, setAmounts] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const me = IMPORTERS.find((i) => i.key === who)!;
  const holdings = state?.batches.filter((b) => (b.balances[who] ?? 0) > 0) ?? [];
  const myAddr = state?.roles[who]?.toLowerCase();
  const surrenders = state?.events.filter((e) => e.type === "Surrendered" && String(e.args.holder).toLowerCase() === myAddr) ?? [];

  async function surrender(batchId: number, max: number) {
    const t = Math.min(amounts[batchId] ?? max, max);
    setBusy(batchId);
    await tx("surrender", { batchId, as: who, tonnes: t, declarationRef: `CBAM-DECL-2026-${me.country}-${batchId}` }, `Surrender ${fmtT(t)} t for CBAM declaration`);
    setBusy(null);
  }

  return (
    <div className="space-y-10">
      <header className="animate-fade-up">
        <div className="label">EU importer · step 4 of 5</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {IMPORTERS.map((i) => (
            <button
              key={i.key}
              onClick={() => setWho(i.key)}
              className={cx("rounded-[2px] px-4 py-2 text-sm", who === i.key ? "bg-ink text-paper" : "border border-rule bg-surface hover:border-steel")}
            >
              {i.city}
            </button>
          ))}
        </div>
        <h1 className="mt-4 font-serif text-3xl font-semibold sm:text-4xl">
          {me.name} <Fictional />
        </h1>
        <p className="mt-2 text-ink-muted">
          Authorised CBAM declarant · {me.city}, {me.country} · {state && <HashChip value={state.roles[who]} />}
        </p>
      </header>

      <section>
        <SectionHead
          n="01"
          title="Verified tonnes held"
          hint="Declare on actual verified emissions instead of default values. Surrendering burns the tonnes so the same evidence can't back a second declaration."
        />
        {holdings.length === 0 && (
          <Card>
            <p className="text-sm text-ink-muted">No verified tonnes held. Ship some from the shipments screen.</p>
          </Card>
        )}
        <div className="space-y-4">
          {holdings.map((b) => {
            const bal = b.balances[who] ?? 0;
            const [y2026] = costModel({ tonnes: bal, seeChargeable: b.directKgPerT / 1000, cnCode: CN_CODE, country: INSTALLATION.country, years: [2026] });
            return (
              <Card key={b.id} className="grid gap-5 lg:grid-cols-[1.2fr_1fr_1.2fr] lg:items-center">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm">#{b.id}</span>
                    <StatusBadge status={b.status} />
                  </div>
                  <p className="mt-2 font-semibold">
                    {monthLabel(monthFromTs(b.periodStart))} · HRC · CN {b.cnCode}
                  </p>
                  <p className="text-sm text-ink-muted">{PLANT.installation.name}</p>
                  <Link href={`/passport/${b.id}`} className="mt-2 inline-block text-sm font-semibold hover:text-molten">
                    Open passport →
                  </Link>
                </div>
                <div className="space-y-1">
                  <div className="label">Holding</div>
                  <div className="font-mono text-2xl font-semibold tnum">{fmtT(bal)} t</div>
                  <div className="text-sm text-ink-muted">
                    at <span className="font-mono tnum">{(b.directKgPerT / 1000).toFixed(3)}</span> tCO₂e/t
                  </div>
                  <Badge tone="verified">saves {fmtEur(y2026.saving)} in 2026</Badge>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <div className="label">Surrender tonnes</div>
                    <input
                      type="number"
                      min={1}
                      max={bal}
                      value={amounts[b.id] ?? bal}
                      onChange={(e) => setAmounts((a) => ({ ...a, [b.id]: Math.max(1, Math.round(Number(e.target.value))) }))}
                      className="mt-1 w-32 rounded-[2px] border border-rule bg-paper px-3 py-2.5 font-mono tnum"
                    />
                  </div>
                  <Button onClick={() => surrender(b.id, bal)} disabled={busy === b.id || b.status !== "Issued"}>
                    {busy === b.id ? "Burning…" : "Surrender for declaration"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <SectionHead n="02" title="Declarations filed" />
        <Card className="overflow-x-auto p-0 sm:p-0">
          <table className="w-full min-w-[520px] text-sm">
            <tbody>
              {surrenders.length === 0 && (
                <tr>
                  <td className="px-5 py-4 text-ink-muted">Nothing surrendered yet.</td>
                </tr>
              )}
              {surrenders.map((e) => (
                <tr key={e.txHash} className="border-b border-rule last:border-0">
                  <td className="px-5 py-3 font-mono text-xs text-ink-muted">{fmtDateTime(e.timestamp)}</td>
                  <td className="px-3 py-3">
                    Batch <span className="font-mono">#{e.batchId}</span>
                  </td>
                  <td className="px-3 py-3 text-right font-mono tnum">{fmtT(Number(e.args.tonnes))} t burned</td>
                  <td className="px-5 py-3 text-right">
                    <HashChip value={e.txHash} href={e.explorer} label="tx" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}
