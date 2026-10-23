"use client";

import Link from "next/link";
import { fmtEur, fmtNum } from "@/lib/cbam";
import type { LedgerImpact } from "@/lib/impact";
import { useDemo } from "../demo-provider";
import { Card, Metric, fmtT } from "../ui";

/** Live totals from the chain: what the verified batches on the ledger have already corrected. */
export function LiveImpact({ impact }: { impact: LedgerImpact }) {
  const { state, error } = useDemo();
  const loading = !state && !error;
  const v = (x: string) => (loading ? "—" : x);
  const { avgSee, defaultSee } = impact;
  const below = defaultSee ? 1 - avgSee / defaultSee : 0;

  return (
    <div className="space-y-4">
      <Card className="grid grid-cols-2 gap-x-6 gap-y-7 lg:grid-cols-3">
        <Metric label="Verified tonnes on the ledger" value={v(fmtT(impact.verifiedT))} unit="t" />
        <Metric label="Verified batches" value={v(String(impact.batches))} />
        <Metric label="Surrendered at declaration" value={v(fmtT(impact.surrenderedT))} unit="t" />
        <Metric label="Overstatement corrected" value={v(fmtNum(impact.overstatementT))} unit="tCO₂e" />
        <Metric label="Avg verified intensity" value={v(impact.verifiedT ? avgSee.toFixed(3) : "—")} unit="tCO₂e/t" />
        <Metric label="Saved at 2026 CBAM factor" value={v(fmtEur(impact.saved2026))} accent />
      </Card>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="label">Tonnage-weighted verified intensity vs EU default</div>
          {impact.verifiedT > 0 && (
            <div className="font-mono text-sm tnum">
              {below >= 0 ? "−" : "+"}
              {fmtNum(Math.abs(below) * 100, 0)}% <span className="font-sans text-ink-muted">vs default</span>
            </div>
          )}
        </div>
        <IntensityBar label="EU default value" value={defaultSee} max={Math.max(defaultSee, avgSee)} tone="default" />
        <IntensityBar label="Verified on the ledger" value={impact.verifiedT ? avgSee : 0} max={Math.max(defaultSee, avgSee)} tone="verified" />
        <p className="text-xs text-ink-muted">
          {error ? (
            <>Chain unreachable ({error}). Totals will appear when it reconnects.</>
          ) : state ? (
            <>
              Read from {state.network} at block #{state.latestBlock}: issued hot-rolled steel batches only (revoked and rejected excluded; precursor pig iron is counted inside the steel, not twice). Overstatement corrected = Σ tonnes ×
              (default − verified), the emissions the default would have wrongly attributed. It is an accounting correction, not an emissions cut. Savings use
              the 2026 CBAM factor, the 10% mark-up and the reference ETS price.
              {impact.batches === 0 && (
                <>
                  {" "}
                  No verified batches yet: <Link href="/producer" className="text-molten underline-offset-2 hover:underline">run the demo flow</Link>.
                </>
              )}
            </>
          ) : (
            "Connecting to the chain…"
          )}
        </p>
      </Card>
    </div>
  );
}

function IntensityBar({ label, value, max, tone }: { label: string; value: number; max: number; tone: "default" | "verified" }) {
  const pct = max ? Math.max(0, Math.min(1, value / max)) * 100 : 0;
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[12rem_1fr_auto]">
      <span className="text-ink-muted">{label}</span>
      <span className="h-3 rounded-[2px] bg-sunken">
        <span className={`block h-full rounded-[2px] ${tone === "default" ? "bg-steel opacity-35" : "bg-molten"}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="w-24 text-right font-mono tnum">
        {value ? value.toFixed(3) : "—"} <span className="font-sans text-xs text-ink-muted">t/t</span>
      </span>
    </div>
  );
}
