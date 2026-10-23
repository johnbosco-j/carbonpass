import type { Metadata } from "next";
import { ImpactDashboard } from "@/components/impact/dashboard";
import { Methodology } from "@/components/impact/methodology";
import { PolicyCards } from "@/components/impact/policy-cards";
import { SectionHead } from "@/components/ui";

export const metadata: Metadata = {
  title: "Climate impact · CarbonPass",
  description: "Live verified tonnes from the chain, a CBAM scenario simulator to 2034, policy context and an honest methodology.",
};

const CHAIN = [
  {
    on: "Default values",
    steps: ["Bill set by the EU country average", "Real emissions don't change the bill"],
    result: "Cutting emissions is worth €0",
    tone: "text-ink-muted",
  },
  {
    on: "Verified data",
    steps: ["Bill set by the plant's verified intensity", "Every tCO₂e/t cut lowers the bill"],
    result: "Cutting pays, more each year to 2034",
    tone: "text-molten",
  },
];

export default function ImpactPage() {
  return (
    <div className="space-y-12">
      <header className="animate-fade-up">
        <div className="label">Climate impact</div>
        <h1 className="mt-2 max-w-3xl text-balance font-serif text-3xl font-semibold leading-tight sm:text-4xl">Verified data turns the carbon price back on.</h1>
        <p className="mt-3 max-w-2xl text-ink-muted">
          CarbonPass captures no carbon itself. Its impact comes from reconnecting the CBAM bill to what a plant actually emits. On default values, a mill
          that cuts its emissions pays the same as one that doesn&apos;t. On verified data, every tonne cut is money saved at the border.
        </p>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {CHAIN.map((c) => (
            <div key={c.on} className="rounded-[4px] border border-rule bg-surface p-4">
              <div className="label">{c.on}</div>
              <ol className="mt-2 space-y-1 text-sm">
                {[...c.steps, c.result].map((s, i) => (
                  <li key={s} className={i === c.steps.length ? `font-semibold ${c.tone}` : undefined}>
                    <span aria-hidden className="mr-2 inline-block w-3 text-ink-muted">
                      {i ? "→" : "·"}
                    </span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </header>

      <ImpactDashboard />

      <section>
        <SectionHead n="03" title="Policy context" hint="Why this matters now for Turkish and Indian producers. Each card links to its source." />
        <PolicyCards />
      </section>

      <section>
        <SectionHead n="04" title="Methodology and limitations" hint="What the numbers mean, which inputs are assumptions, and where the impact could fall short." />
        <Methodology />
      </section>

      <p className="border-t border-rule pt-6 text-xs text-ink-muted">
        Prototype on a public testnet. The installation, verifier and importers are fictional demo entities. Scenario outputs are what-ifs, not forecasts. Full
        write-up: docs/IMPACT.md in the repository.
      </p>
    </div>
  );
}
