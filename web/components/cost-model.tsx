"use client";

import { useState } from "react";
import { costModel, defaultValue, fmtEur, type Country } from "@/lib/cbam";
import factors from "@/data/factors.json";
import { Card, Metric, fmtT } from "./ui";

/** CBAM certificate cost on EU default values vs on this batch's verified intensity, 2026 → 2034. */
export function CostModel({ tonnes, see, cnCode, country }: { tonnes: number; see: number; cnCode: number; country: Country }) {
  const [price, setPrice] = useState(factors.eu_ets_price_eur.value);
  const [t, setT] = useState(tonnes);
  const rows = costModel({ tonnes: t, seeChargeable: see, cnCode, country, price });
  const max = Math.max(...rows.map((r) => r.defaultCost));
  const dv = defaultValue(cnCode, country);
  const W = 560;
  const H = 180;
  const bw = W / rows.length;

  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-end gap-6">
        <Metric label="Saving in 2026 vs default values" value={fmtEur(rows[0].saving)} accent />
        <Metric label="Saving in 2034 (full CBAM)" value={fmtEur(rows.at(-1)!.saving)} />
        <div className="ml-auto flex gap-3">
          <label className="text-sm">
            <span className="label block">Tonnes</span>
            <input type="number" value={t} onChange={(e) => setT(Math.max(0, Number(e.target.value)))} className="mt-1 w-28 rounded-[2px] border border-rule bg-paper px-2 py-1.5 font-mono tnum" />
          </label>
          <label className="text-sm">
            <span className="label block">EU ETS €/t</span>
            <input type="number" value={price} onChange={(e) => setPrice(Math.max(0, Number(e.target.value)))} className="mt-1 w-20 rounded-[2px] border border-rule bg-paper px-2 py-1.5 font-mono tnum" />
          </label>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H + 28}`} className="max-h-72 w-full" role="img" aria-label="CBAM cost per year on default values versus verified data">
        {rows.map((r, i) => {
          const x = i * bw;
          const hd = max ? (r.defaultCost / max) * H : 0;
          const ha = max ? (r.actualCost / max) * H : 0;
          return (
            <g key={r.year}>
              <rect x={x + bw * 0.14} y={H - hd} width={bw * 0.34} height={hd} fill="var(--color-steel)" opacity="0.35">
                <title>{`${r.year} default values: ${fmtEur(r.defaultCost)}`}</title>
              </rect>
              <rect x={x + bw * 0.52} y={H - ha} width={bw * 0.34} height={ha} fill="var(--color-molten)">
                <title>{`${r.year} verified data: ${fmtEur(r.actualCost)}`}</title>
              </rect>
              <text x={x + bw / 2} y={H + 18} textAnchor="middle" fontSize="11" fill="var(--color-ink-muted)" fontFamily="var(--font-mono)">
                {r.year}
              </text>
            </g>
          );
        })}
        <line x1="0" x2={W} y1={H} y2={H} stroke="var(--color-rule)" />
      </svg>
      <div className="flex flex-wrap gap-5 text-xs text-ink-muted">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-4 bg-steel opacity-35" /> Default value {dv} tCO₂e/t + markup
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-4 bg-molten" /> Verified {see.toFixed(3)} tCO₂e/t
        </span>
        <span>
          {fmtT(t)} t × CBAM phase-in factor (2.5% in 2026 → 100% in 2034) × €{price}/t. Default value: EU CBAM default for this product and origin (Reg. 2025/2621 Annex I); mark-up 10% → 30%.
        </span>
      </div>
    </Card>
  );
}
