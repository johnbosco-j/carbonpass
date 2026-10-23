"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { fmtEur, fmtNum } from "@/lib/cbam";
import { fmtEurShort, fmtTShort, niceScale, type ScenarioRow } from "@/lib/impact";

/** Measures the chart's container so SVG text renders at its real size on phones (no viewBox shrinking). */
function useWidth(fallback = 560) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

const M = { l: 52, r: 12, t: 14, b: 26 };
const H = 190;

interface ChartProps {
  rows: ScenarioRow[];
  year: number | null;
  setYear: (y: number | null) => void;
}

/** Shared frame: y gridlines + tick labels, year labels, per-year hover columns. */
function Frame({
  rows,
  year,
  setYear,
  yMax,
  fmtTick,
  label,
  children,
}: ChartProps & { yMax: number; fmtTick: (x: number) => string; label: string; children: (geo: { W: number; bw: number; x0: (i: number) => number; y: (v: number) => number }) => ReactNode }) {
  const [ref, W] = useWidth();
  const { max, step } = niceScale(yMax);
  const pw = W - M.l - M.r;
  const bw = pw / rows.length;
  const y = (v: number) => M.t + H - (max ? (v / max) * H : 0);
  const x0 = (i: number) => M.l + i * bw;
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const shortYears = bw < 40;
  return (
    <div ref={ref} className="w-full min-w-0" onPointerLeave={() => setYear(null)}>
      <svg width="100%" height={M.t + H + M.b} viewBox={`0 0 ${W} ${M.t + H + M.b}`} role="img" aria-label={label} className="block">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke="var(--color-rule)" strokeWidth={t === 0 ? 1 : 0.6} />
            <text x={M.l - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10.5" fill="var(--color-ink-muted)" fontFamily="var(--font-mono)">
              {fmtTick(t)}
            </text>
          </g>
        ))}
        {rows.map((r, i) =>
          r.year === year ? <rect key={r.year} x={x0(i) + 1} y={M.t} width={bw - 2} height={H} fill="var(--color-sunken)" opacity="0.8" /> : null,
        )}
        {children({ W, bw, x0, y })}
        {rows.map((r, i) => (
          <text
            key={r.year}
            x={x0(i) + bw / 2}
            y={M.t + H + 17}
            textAnchor="middle"
            fontSize="10.5"
            fill={r.year === year ? "var(--color-ink)" : "var(--color-ink-muted)"}
            fontFamily="var(--font-mono)"
          >
            {shortYears ? `'${String(r.year).slice(2)}` : r.year}
          </text>
        ))}
        {rows.map((r, i) => (
          <rect
            key={r.year}
            x={x0(i)}
            y={M.t}
            width={bw}
            height={H + M.b}
            fill="transparent"
            onPointerEnter={() => setYear(r.year)}
            onClick={() => setYear(r.year)}
          />
        ))}
      </svg>
    </div>
  );
}

function Readout({ children }: { children: ReactNode }) {
  return <div className="flex min-h-[1.5rem] flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-xs tnum text-ink-muted">{children}</div>;
}

function Key({ swatch, children }: { swatch: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`inline-block h-2.5 w-4 ${swatch}`} />
      {children}
    </span>
  );
}

const pick = (rows: ScenarioRow[], year: number | null) => rows.find((r) => r.year === year) ?? rows.at(-1)!;

// ------------------------------------------------------------------ bills

export function BillChart({ rows, year, setYear, dv, see }: ChartProps & { dv: number; see: number }) {
  const r = pick(rows, year);
  const yMax = Math.max(...rows.map((x) => Math.max(x.defaultBill, x.verifiedBill)));
  return (
    <div className="space-y-3">
      <Readout>
        <span className="text-ink">{r.year}</span>
        <span>defaults {fmtEurShort(r.defaultBill)}</span>
        <span>verified {fmtEurShort(r.verifiedBill)}</span>
        <span className="text-ink">saving {fmtEurShort(r.saving)}</span>
      </Readout>
      <Frame rows={rows} year={year} setYear={setYear} yMax={yMax} fmtTick={fmtEurShort} label="CBAM bill per year on EU default values versus on verified data, 2026 to 2034">
        {({ bw, x0, y }) =>
          rows.map((x, i) => {
            const w = Math.min(bw * 0.36, 22);
            const cx = x0(i) + bw / 2;
            return (
              <g key={x.year}>
                <rect x={cx - w - 1} y={y(x.defaultBill)} width={w} height={y(0) - y(x.defaultBill)} fill="var(--color-steel)" opacity="0.35">
                  <title>{`${x.year} default values: ${fmtEur(x.defaultBill)}`}</title>
                </rect>
                <rect x={cx + 1} y={y(x.verifiedBill)} width={w} height={y(0) - y(x.verifiedBill)} fill="var(--color-molten)">
                  <title>{`${x.year} verified data: ${fmtEur(x.verifiedBill)}`}</title>
                </rect>
              </g>
            );
          })
        }
      </Frame>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-muted">
        <Key swatch="bg-steel opacity-35">Default {dv} tCO₂e/t + mark-up</Key>
        <Key swatch="bg-molten">Verified {see.toFixed(3)} tCO₂e/t</Key>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ the key insight

export function MarginalChart({ rows, year, setYear, cut }: ChartProps & { cut: number }) {
  const r = pick(rows, year);
  const yMax = Math.max(...rows.map((x) => x.marginalVerified));
  return (
    <div className="space-y-3">
      <Readout>
        <span className="text-ink">{r.year}</span>
        <span>on defaults €0</span>
        <span className="text-ink">on verified data {fmtEurShort(r.marginalVerified)}</span>
        <span>CBAM factor {fmtNum(r.factor * 100, 1)}%</span>
      </Readout>
      <Frame rows={rows} year={year} setYear={setYear} yMax={yMax} fmtTick={fmtEurShort} label={`Yearly value of cutting ${cut} tCO2e per tonne: zero under default values, rising under verified data`}>
        {({ bw, x0, y, W }) => {
          const px = (i: number) => x0(i) + bw / 2;
          const line = (k: "marginalVerified" | "marginalDefault") => rows.map((x, i) => `${i ? "L" : "M"}${px(i).toFixed(1)},${y(x[k]).toFixed(1)}`).join(" ");
          const last = rows.length - 1;
          const sel = year === null ? -1 : rows.findIndex((x) => x.year === year);
          return (
            <g>
              {sel >= 0 && <line x1={px(sel)} x2={px(sel)} y1={M.t} y2={y(0)} stroke="var(--color-steel)" strokeWidth="1" opacity="0.5" />}
              <path d={line("marginalDefault")} fill="none" stroke="var(--color-steel)" strokeWidth="2.5" />
              <path d={line("marginalVerified")} fill="none" stroke="var(--color-molten)" strokeWidth="2" />
              {rows.map((x, i) => (
                <g key={x.year}>
                  <circle cx={px(i)} cy={y(0)} r={i === sel ? 4.5 : 3.5} fill="var(--color-steel)" stroke="var(--color-surface)" strokeWidth="2" />
                  <circle cx={px(i)} cy={y(x.marginalVerified)} r={i === sel ? 5 : 4} fill="var(--color-molten)" stroke="var(--color-surface)" strokeWidth="2">
                    <title>{`${x.year}: ${fmtEur(x.marginalVerified)} on verified data, €0 on defaults`}</title>
                  </circle>
                </g>
              ))}
              <text x={px(last) - 8} y={y(rows[last].marginalVerified) + 4} textAnchor="end" fontSize="12" fontWeight="600" fill="var(--color-ink)" fontFamily="var(--font-mono)">
                {fmtEurShort(rows[last].marginalVerified)}/yr
              </text>
              <text x={Math.min(px(last), W - M.r)} y={y(0) - 9} textAnchor="end" fontSize="11" fill="var(--color-ink-muted)" fontFamily="var(--font-sans)">
                Default values: €0 every year
              </text>
            </g>
          );
        }}
      </Frame>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-muted">
        <Key swatch="bg-steel">Declared on default values</Key>
        <Key swatch="bg-molten">Declared on verified data</Key>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ avoided emissions

export function AvoidedChart({ rows, year, setYear }: ChartProps) {
  const r = pick(rows, year);
  const yMax = Math.max(...rows.map((x) => x.avoided));
  return (
    <div className="space-y-3">
      <Readout>
        <span className="text-ink">{r.year}</span>
        <span>cut {r.cut.toFixed(3)} tCO₂e/t</span>
        <span className="text-ink">avoided {fmtNum(r.avoided)} tCO₂e</span>
        <span>worth {fmtEurShort(r.abatementValue)}</span>
      </Readout>
      <Frame rows={rows} year={year} setYear={setYear} yMax={yMax} fmtTick={fmtTShort} label="Avoided emissions per year on EU exports, tonnes of CO2 equivalent">
        {({ bw, x0, y }) =>
          rows.map((x, i) => {
            const w = Math.min(bw * 0.56, 30);
            return (
              <rect key={x.year} x={x0(i) + (bw - w) / 2} y={y(x.avoided)} width={w} height={y(0) - y(x.avoided)} fill="var(--color-steel)">
                <title>{`${x.year}: ${fmtNum(x.avoided)} tCO₂e avoided`}</title>
              </rect>
            );
          })
        }
      </Frame>
      <div className="text-xs text-ink-muted">
        <Key swatch="bg-steel">tCO₂e avoided per year (EU exports only)</Key>
      </div>
    </div>
  );
}
