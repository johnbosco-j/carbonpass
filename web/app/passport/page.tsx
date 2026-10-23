"use client";

import Link from "next/link";
import { useDemo } from "@/components/demo-provider";
import { Card, SectionHead, StatusBadge, fmtT } from "@/components/ui";
import { installationInfo, monthFromTs, monthLabel } from "@/lib/demo";

export default function PassportIndex() {
  const { state } = useDemo();
  const batches = [...(state?.batches ?? [])].reverse();
  return (
    <div className="space-y-8">
      <header className="animate-fade-up">
        <div className="label">Public · step 5 of 5</div>
        <h1 className="mt-2 font-serif text-3xl font-semibold sm:text-4xl">Carbon passports</h1>
        <p className="mt-3 max-w-2xl text-ink-muted">Every batch on the ledger. Anyone can open a passport, no wallet needed: this is what the QR code on the shipping documents opens.</p>
      </header>
      <section>
        <SectionHead title={`${batches.length} batches`} />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {batches.map((b) => (
            <Link key={b.id} href={`/passport/${b.id}`} className="group">
              <Card className="h-full transition-colors group-hover:border-steel">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm">#{b.id}</span>
                  <StatusBadge status={b.status} />
                </div>
                <p className="mt-3 font-semibold">
                  {installationInfo(b.installationId).product}, {monthLabel(monthFromTs(b.periodStart))}
                </p>
                <p className="text-sm text-ink-muted">{installationInfo(b.installationId).name}</p>
                <div className="mt-4 flex items-baseline justify-between border-t border-rule pt-3">
                  <span className="font-mono text-2xl font-semibold tnum">{(b.directKgPerT / 1000).toFixed(3)}</span>
                  <span className="text-sm text-ink-muted">tCO₂e/t · {fmtT(b.tonnes)} t</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
