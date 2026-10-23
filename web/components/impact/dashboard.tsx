"use client";

import { ledgerImpact } from "@/lib/impact";
import { CN_CODE, INSTALLATION } from "@/lib/demo";
import { useDemo } from "../demo-provider";
import { SectionHead } from "../ui";
import { LiveImpact } from "./live-impact";
import { Simulator } from "./simulator";

/** Sections 01 (live ledger) and 02 (scenario simulator): both read the chain state. */
export function ImpactDashboard() {
  const { state } = useDemo();
  const impact = ledgerImpact(state, CN_CODE, INSTALLATION.country);
  return (
    <>
      <section className="animate-fade-up">
        <SectionHead
          n="01"
          title="On the ledger now"
          hint={<>What the verified batches on the chain have already corrected. The installation is a fictional demo entity.</>}
        />
        <LiveImpact impact={impact} />
      </section>

      <section>
        <SectionHead
          n="02"
          title="Scenario: scale it to an industry"
          hint="Move the sliders. Bills, savings and avoided emissions per year, 2026–2034, from the same cost model as the passport page."
        />
        <Simulator ledgerSee={impact.verifiedT ? impact.avgSee : null} />
      </section>
    </>
  );
}
