import type { BatchView } from "@/lib/chain/state";
import { cx, fmtT } from "./ui";

/**
 * Conservation gauge: the producer's balance + tonnes shipped to others + surrendered + consumed as a precursor
 * always equals the issued tonnes.
 */
export function TonnageGauge({ batch, shakeKey, shippedLabel = "Shipped to importers" }: { batch: BatchView; shakeKey?: number; shippedLabel?: string }) {
  const producer = batch.producerBalance;
  const shipped = Math.max(0, batch.supply - producer);
  const { surrendered, consumed } = batch;
  const pct = (x: number) => `${(x / batch.tonnes) * 100}%`;
  const balanced = batch.supply + surrendered + consumed === batch.tonnes;
  return (
    <div>
      <div key={shakeKey} className={cx("flex h-10 w-full overflow-hidden rounded-[2px] border border-rule bg-sunken", shakeKey ? "animate-shake" : false)}>
        <div className="h-full bg-molten transition-[width] duration-500 ease-in-out" style={{ width: pct(producer) }} title={`With producer: ${fmtT(producer)} t`} />
        <div className="hatch h-full transition-[width] duration-500" style={{ width: pct(shipped) }} title={`${shippedLabel}: ${fmtT(shipped)} t`} />
        <div className="h-full bg-steel transition-[width] duration-500" style={{ width: pct(surrendered) }} title={`Surrendered: ${fmtT(surrendered)} t`} />
        {consumed > 0 && <div className="h-full bg-ink-muted transition-[width] duration-500" style={{ width: pct(consumed) }} title={`Consumed downstream: ${fmtT(consumed)} t`} />}
      </div>
      <div className={cx("mt-3 grid grid-cols-2 gap-3 text-sm", consumed > 0 ? "sm:grid-cols-5" : "sm:grid-cols-4")}>
        <Legend swatch="bg-molten" label="With producer" value={producer} />
        <Legend swatch="hatch" label={shippedLabel} value={shipped} />
        <Legend swatch="bg-steel" label="Surrendered (burned)" value={surrendered} />
        {consumed > 0 && <Legend swatch="bg-ink-muted" label="Consumed downstream (burned)" value={consumed} />}
        <div>
          <div className="label">Invariant</div>
          <div className={cx("font-mono text-xs tnum", balanced ? "text-verified" : "text-revoked")}>
            {fmtT(batch.supply)} + {fmtT(surrendered)}
            {consumed > 0 && <> + {fmtT(consumed)}</>} = {fmtT(batch.tonnes)} {balanced ? "✓" : "✗"}
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
