import type { BatchView } from "@/lib/chain/state";
import { cx, fmtT } from "./ui";

/** Conservation gauge: producer balance + importer balances + surrendered always equals issued tonnes. */
export function TonnageGauge({ batch, shakeKey }: { batch: BatchView; shakeKey?: number }) {
  const producer = batch.balances.producer ?? 0;
  const importers = (batch.balances.importerA ?? 0) + (batch.balances.importerB ?? 0);
  const surrendered = batch.surrendered;
  const other = Math.max(0, batch.supply - producer - importers);
  const pct = (x: number) => `${(x / batch.tonnes) * 100}%`;
  const balanced = batch.supply + surrendered === batch.tonnes;
  return (
    <div>
      <div key={shakeKey} className={cx("flex h-10 w-full overflow-hidden rounded-[2px] border border-rule bg-sunken", shakeKey ? "animate-shake" : false)}>
        <div className="h-full bg-molten transition-[width] duration-500 ease-in-out" style={{ width: pct(producer) }} title={`With producer: ${fmtT(producer)} t`} />
        <div className="hatch h-full transition-[width] duration-500" style={{ width: pct(importers + other) }} title={`With importers: ${fmtT(importers + other)} t`} />
        <div className="h-full bg-steel transition-[width] duration-500" style={{ width: pct(surrendered) }} title={`Surrendered: ${fmtT(surrendered)} t`} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Legend swatch="bg-molten" label="With producer" value={producer} />
        <Legend swatch="hatch" label="Shipped to importers" value={importers + other} />
        <Legend swatch="bg-steel" label="Surrendered (burned)" value={surrendered} />
        <div>
          <div className="label">Invariant</div>
          <div className={cx("font-mono text-xs tnum", balanced ? "text-verified" : "text-revoked")}>
            {fmtT(batch.supply)} + {fmtT(surrendered)} = {fmtT(batch.tonnes)} {balanced ? "✓" : "✗"}
          </div>
        </div>
      </div>
    </div>
  );
}

function Legend({ swatch, label, value }: { swatch: string; label: string; value: number }) {
  return (
    <div>
      <div className="label flex items-center gap-2">
        <span className={cx("inline-block h-2.5 w-4 rounded-[1px]", swatch)} />
        {label}
      </div>
      <div className="font-mono tnum">{fmtT(value)} t</div>
    </div>
  );
}
