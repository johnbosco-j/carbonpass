import factors from "@/data/factors.json";
import { CN_CODE } from "@/lib/demo";
import { MARGINAL_CUT } from "@/lib/impact";

type Status = "Sourced" | "Assumption" | "Demo data" | "Your input";

const dv = (factors.default_values as Record<string, { source: string; verify: string }>)[String(CN_CODE)];

const INPUTS: { input: string; status: Status; note: string }[] = [
  { input: "EU default values (TR 2.43, IN 4.28 tCO₂e/t)", status: "Sourced", note: `${dv.source}. ${dv.verify}.` },
  { input: "Default-value mark-up (10% → 30%)", status: "Sourced", note: factors.default_markup._source },
  { input: "CBAM factor (2.5% → 100%)", status: "Sourced", note: factors.cbam_factor._source },
  { input: "EU ETS price", status: "Assumption", note: `${factors.eu_ets_price_eur.value} €/tCO₂e reference. The bill and saving scale linearly with it.` },
  { input: "Verified intensity", status: "Demo data", note: "Starts at the fictional demo mill's value, calculated from its sample evidence with the factors in data/factors.json." },
  { input: "Mills and exports per mill", status: "Your input", note: "Scenario size. Not a market estimate." },
  { input: "Abatement Δ and timing", status: "Assumption", note: "How far the restored price signal moves plants is not known. Treat Δ as a what-if, not a forecast." },
];

const TONE: Record<Status, string> = {
  Sourced: "border border-steel text-steel",
  Assumption: "bg-anomaly-tint text-anomaly",
  "Demo data": "bg-sunken text-ink-muted",
  "Your input": "bg-sunken text-ink-muted",
};

const LIMITS: { title: string; body: string }[] = [
  {
    title: "Resource shuffling",
    body: "A producer can send its cleanest output to the EU and sell the rest elsewhere. Installation-level batches make the mass balance visible, but they don't prevent it: that takes policy. Avoided emissions count only when the plant really cuts, not when it reallocates clean tonnes.",
  },
  {
    title: "Verifier quality",
    body: "The chain proves who signed what, and when. It cannot prove a meter reading is true. Impact depends on honest, competent accredited verifiers. Anomaly checks and the verifier registry make auditing them cheaper; they don't replace it.",
  },
  {
    title: "A saving is not an emissions cut",
    body: "The € saving is a smaller border bill, a transfer of money. The climate benefit appears only if that price signal leads plants to abate (Δ). “Overstatement corrected” fixes the accounting; it removes no CO₂ from the air.",
  },
  {
    title: "Additionality goes both ways",
    body: "We count avoided emissions on EU exports only, but a process change usually lowers emissions on the whole output, so that understates. Some plants would have cut anyway, so attributing every cut to the price signal overstates. Read the result as an order of magnitude.",
  },
  {
    title: "Chargeable scope",
    body: "For iron and steel only direct emissions (including precursors) are charged. Cleaner electricity lowers the plant's real footprint but not its CBAM bill. We still report indirect emissions for importers' Scope 3.",
  },
  {
    title: "Rules and prices can move",
    body: "Annex I default values were corrected by Reg. 2026/1740, and the ETS price is volatile. The bills scale linearly with both, and the phase-in schedule is the current law, not a certainty.",
  },
];

export function Methodology() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_1.25fr]">
        <div className="min-w-0 rounded-[4px] border border-rule bg-surface p-5 sm:p-6">
          <div className="label">Method, per year y</div>
          <pre className="mt-3 overflow-x-auto whitespace-pre font-mono text-[0.7rem] leading-relaxed text-ink sm:text-[0.8rem]">
            {`saving(y)   = T × [DV × (1 + m(y)) − SEE] × F(y) × P
worth(y)    = ${MARGINAL_CUT} × T × F(y) × P    on verified data
            = 0                      on default values
cut(y)      = A × F(y)   (phased)  or  A  (immediate)
avoided(y)  = cut(y) × T
overstated  = T × (DV − SEE)         accounting only`}
          </pre>
          <p className="mt-3 text-xs text-ink-muted">
            T tonnes exported to the EU · DV EU default value · m mark-up · SEE verified intensity (direct + precursors) · F CBAM factor · P EU ETS price · A abatement by 2034. Same
            functions as the passport&apos;s cost model (lib/cbam.ts); every factor comes from data/factors.json.
          </p>
        </div>

        <div className="min-w-0 overflow-hidden rounded-[4px] border border-rule bg-surface">
          <div className="label border-b border-rule px-5 py-3 sm:px-6">Inputs and where they come from</div>
          <ul>
            {INPUTS.map((i) => (
              <li key={i.input} className="border-b border-rule px-5 py-3 last:border-0 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">{i.input}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em] ${TONE[i.status]}`}>{i.status}</span>
                </div>
                <p className="mt-1 text-xs text-ink-muted">{i.note}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <div className="label mb-3">Limitations</div>
        <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {LIMITS.map((l, i) => (
            <li key={l.title} className="rounded-[4px] border border-rule border-l-2 border-l-steel bg-surface p-5">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xs text-ink-muted">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="font-semibold">{l.title}</h3>
              </div>
              <p className="mt-2 text-sm text-ink-muted">{l.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
