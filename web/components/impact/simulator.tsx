"use client";

import { useMemo, useState, type ReactNode } from "react";
import { calculate, defaultValue, fmtEur, fmtNum, type Country } from "@/lib/cbam";
import { ETS_PRICE, MARGINAL_CUT, fmtEurShort, simulate, type AbatementTiming, type Scenario } from "@/lib/impact";
import { CN_CODE, PLANT } from "@/lib/demo";
import { Card, Metric, cx } from "../ui";
import { AvoidedChart, BillChart, MarginalChart } from "./charts";

/** The demo mill's verified intensity, computed from its sample evidence (not typed in). */
const DEMO_SEE = calculate(PLANT.demoMonth, "TR").seeDirect;

const INITIAL: Scenario = {
  mills: 5,
  exportsKt: 200,
  see: DEMO_SEE,
  abatement: 0.05,
  price: ETS_PRICE,
  country: "TR",
  cnCode: CN_CODE,
  timing: "phased",
};

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
  unit,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  display: string;
  unit: string;
  hint?: ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3">
        <span className="label">{label}</span>
        <span className="font-mono text-sm font-semibold tnum">
          {display}
          <span className="ml-1 font-sans text-xs font-normal text-ink-muted">{unit}</span>
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-molten"
      />
      {hint && <span className="mt-0.5 block text-xs text-ink-muted">{hint}</span>}
    </label>
  );
}

function Segmented<T extends string>({ label, value, options, onChange, hint }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; hint?: ReactNode }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="mt-2 inline-flex rounded-[2px] border border-rule p-0.5" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cx("rounded-[2px] px-3 py-1.5 text-sm", value === o.value ? "bg-ink text-paper" : "text-ink-muted hover:text-ink")}
          >
            {o.label}
          </button>
        ))}
      </div>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

export function Simulator({ ledgerSee }: { ledgerSee: number | null }) {
  const [s, setS] = useState<Scenario>(INITIAL);
  const [year, setYear] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const set = <K extends keyof Scenario>(k: K, v: Scenario[K]) => setS((p) => ({ ...p, [k]: v }));
  const r = useMemo(() => simulate(s), [s]);
  const dv = defaultValue(s.cnCode, s.country);
  const first = r.rows[0];
  const last = r.rows.at(-1)!;
  const cut = Math.min(s.abatement, s.see);

  return (
    <div className="space-y-6">
      <Card className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Segmented<Country>
            label="Origin"
            value={s.country}
            options={[
              { value: "TR", label: "Türkiye" },
              { value: "IN", label: "India" },
            ]}
            onChange={(v) => set("country", v)}
            hint={
              <>
                EU default for hot-rolled flat steel: <span className="font-mono tnum">{dv}</span> tCO₂e/t
              </>
            }
          />
          <Segmented<AbatementTiming>
            label="Abatement timing"
            value={s.timing}
            options={[
              { value: "phased", label: "Follows CBAM factor" },
              { value: "immediate", label: "Full from 2026" },
            ]}
            onChange={(v) => set("timing", v)}
            hint={s.timing === "phased" ? "Conservative: the cut grows with the share of the carbon price actually charged." : "Upper bound: the full cut happens in year one."}
          />
          <div className="flex gap-2">
            {ledgerSee !== null && ledgerSee > 0 && (
              <button type="button" onClick={() => set("see", Number(ledgerSee.toFixed(3)))} className="rounded-[2px] border border-rule px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted hover:border-steel hover:text-ink">
                Use ledger intensity
              </button>
            )}
            <button type="button" onClick={() => setS(INITIAL)} className="rounded-[2px] border border-rule px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted hover:border-steel hover:text-ink">
              Reset
            </button>
          </div>
        </div>

        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <Slider label="Mills" value={s.mills} min={1} max={200} step={1} onChange={(v) => set("mills", v)} display={fmtNum(s.mills)} unit="installations" />
          <Slider label="EU exports per mill" value={s.exportsKt} min={10} max={2000} step={10} onChange={(v) => set("exportsKt", v)} display={fmtNum(s.exportsKt)} unit="kt/yr" hint={<>Total {fmtNum(r.tonnes / 1e6, 2)} Mt/yr to the EU</>} />
          <Slider
            label="Verified intensity"
            value={s.see}
            min={0.05}
            max={4.5}
            step={0.001}
            onChange={(v) => set("see", v)}
            display={s.see.toFixed(3)}
            unit="tCO₂e/t"
            hint={<>Demo mill: {DEMO_SEE.toFixed(3)} (scrap EAF)</>}
          />
          <Slider
            label="Abatement Δ by 2034"
            value={s.abatement}
            min={0}
            max={0.5}
            step={0.005}
            onChange={(v) => set("abatement", v)}
            display={s.abatement.toFixed(3)}
            unit="tCO₂e/t"
            hint={s.abatement > s.see ? <>Capped at the verified intensity ({s.see.toFixed(3)})</> : "Cut the restored price signal triggers (assumption)"}
          />
          <Slider label="EU ETS price" value={s.price} min={20} max={200} step={5} onChange={(v) => set("price", v)} display={`€${s.price}`} unit="/tCO₂e" hint={`Reference ${fmtEur(ETS_PRICE)} (assumption)`} />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-x-6 gap-y-6 rounded-[4px] border border-rule bg-surface p-5 sm:p-6 lg:grid-cols-4">
        <Metric label="Saving in 2026" value={fmtEurShort(first.saving)} accent />
        <Metric label="Saving in 2034" value={fmtEurShort(last.saving)} />
        <Metric label="Saving 2026–2034" value={fmtEurShort(r.cumulativeSaving)} />
        <Metric label="Avoided 2026–2034" value={fmtNum(r.cumulativeAvoided)} unit="tCO₂e" />
        {first.saving < 0 && (
          <p className="col-span-2 text-sm text-anomaly lg:col-span-4">
            This intensity is above the default value plus mark-up, so these mills would declare on defaults. Verified data only pays for producers cleaner than
            the default.
          </p>
        )}
      </div>

      <Card className="min-w-0 space-y-4 border-t-2 border-t-molten">
        <div>
          <div className="label">The key insight</div>
          <h3 className="mt-2 font-serif text-xl font-semibold sm:text-2xl">
            Cutting {MARGINAL_CUT} tCO₂e/t is worth €0 on default values. On verified data it is worth {fmtEurShort(last.marginalVerified)} a year by 2034.
          </h3>
          <p className="mt-2 max-w-3xl text-sm text-ink-muted">
            A bill on default values is fixed by the EU&apos;s country average, so it ignores what the mill actually emits. Once the bill uses verified data, every
            tonne of CO₂ cut is money saved at the border, and the reward grows each year as the CBAM factor rises from 2.5% to 100%. Shown for{" "}
            {fmtNum(r.tonnes / 1e6, 2)} Mt/yr of exports at €{s.price}/tCO₂e.
          </p>
        </div>
        <MarginalChart rows={r.rows} year={year} setYear={setYear} cut={MARGINAL_CUT} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="min-w-0 space-y-4">
          <div>
            <div className="label">CBAM bill per year</div>
            <p className="mt-1 text-sm text-ink-muted">Defaults (with mark-up) against verified data, same tonnes and price.</p>
          </div>
          <BillChart rows={r.rows} year={year} setYear={setYear} dv={dv} see={s.see} />
        </Card>
        <Card className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="label">Avoided emissions</div>
              <p className="mt-1 text-sm text-ink-muted">If the restored incentive triggers a cut of {cut.toFixed(3)} tCO₂e/t.</p>
            </div>
            <div className="text-right">
              <div className="font-mono text-2xl font-semibold tnum">{fmtNum(last.avoided)}</div>
              <div className="text-xs text-ink-muted">tCO₂e in 2034</div>
            </div>
          </div>
          <AvoidedChart rows={r.rows} year={year} setYear={setYear} />
        </Card>
      </div>

      <div className="rounded-[4px] border border-rule bg-surface">
        <button type="button" onClick={() => setShowTable((v) => !v)} aria-expanded={showTable} className="flex w-full items-center justify-between px-5 py-3 text-left sm:px-6">
          <span className="label">Year-by-year table</span>
          <span className="font-mono text-sm text-ink-muted">{showTable ? "−" : "+"}</span>
        </button>
        {showTable && (
          <div className="overflow-x-auto border-t border-rule">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-rule text-left">
                  {["Year", "CBAM factor", "Mark-up", "Bill on defaults", "Bill on verified", "Saving", `−${MARGINAL_CUT} t/t worth`, "Cut", "Avoided"].map((h) => (
                    <th key={h} className="label px-3 py-2 font-semibold first:pl-5 last:pr-5 sm:first:pl-6">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="font-mono tnum">
                {r.rows.map((x) => (
                  <tr key={x.year} className="border-b border-rule last:border-0">
                    <td className="px-3 py-2 pl-5 sm:pl-6">{x.year}</td>
                    <td className="px-3 py-2">{fmtNum(x.factor * 100, 1)}%</td>
                    <td className="px-3 py-2">{fmtNum(x.markup * 100)}%</td>
                    <td className="px-3 py-2">{fmtEur(x.defaultBill)}</td>
                    <td className="px-3 py-2">{fmtEur(x.verifiedBill)}</td>
                    <td className="px-3 py-2 font-semibold">{fmtEur(x.saving)}</td>
                    <td className="px-3 py-2">{fmtEur(x.marginalVerified)}</td>
                    <td className="px-3 py-2">{x.cut.toFixed(4)}</td>
                    <td className="px-3 py-2 pr-5">{fmtNum(x.avoided)} t</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
