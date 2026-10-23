"use client";

import Link from "next/link";
import { useDemo } from "@/components/demo-provider";
import { Card, Metric, fmtT } from "@/components/ui";

const STEPS = [
  { n: "01", who: "Producer", tech: "AI", title: "Evidence in, numbers out", body: "Invoices and production logs are read by Claude. Every quantity is cited to its page and confirmed by a human." },
  { n: "02", who: "Producer", tech: "Calculation + checks", title: "CBAM intensity, checked", body: "A fixed calculator applies the CBAM method. Robust statistics flag values that don't match the plant's own history." },
  { n: "03", who: "Verifier", tech: "Post-quantum signature", title: "Accredited sign-off", body: "An on-chain-registered verifier signs with ECDSA and ML-DSA-65 (NIST FIPS 204). Only salted Merkle roots go on-chain." },
  { n: "04", who: "Producer → Importers", tech: "Smart contract", title: "Tonnes that can't be sold twice", body: "Verified tonnes are minted once (ERC-1155). Shipping more than exists reverts. Certified periods can't overlap." },
  { n: "05", who: "Importer", tech: "Burn on declaration", title: "Surrendered, never reused", body: "When the CBAM declaration is filed, tonnes are burned. The public passport shows the trail and the € saved." },
];

const WHY = [
  ["Producer, verifier and importer sit in TR / IN / EU", "No neutral database operator exists across borders"],
  ["The core risk is the same verified tonnes claimed twice", "That is the double-spend problem ledgers solve"],
  ["Verifier sign-offs must be undeniable for years", "Public, timestamped, post-quantum attestations"],
  ["Plant data is commercially sensitive", "Only salted commitments on-chain; selective disclosure"],
];

export default function Home() {
  const { state } = useDemo();
  const issued = state?.batches.filter((b) => b.status === "Issued") ?? [];
  const verifiedT = issued.reduce((s, b) => s + b.tonnes, 0);
  const surrendered = state?.batches.reduce((s, b) => s + b.surrendered, 0) ?? 0;
  const eventCount = state?.events.length ?? 0;

  return (
    <div className="space-y-16">
      <section className="grid gap-10 pt-6 lg:grid-cols-[1.3fr_1fr] lg:items-end">
        <div className="animate-fade-up">
          <div className="label">EU CBAM · definitive period since 1 January 2026</div>
          <h1 className="mt-4 font-serif text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
            Clean steel shouldn&apos;t pay for dirty defaults.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink-muted">
            CarbonPass turns a mill&apos;s invoices into a verified carbon passport. AI prepares the evidence, an accredited verifier signs it, and a smart
            contract makes sure the same low-carbon tonnes are never counted twice.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/producer" className="inline-flex items-center gap-2 rounded-[2px] bg-molten px-5 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-white hover:bg-molten-deep">
              Run the demo →
            </Link>
            <Link href="/passport" className="inline-flex items-center gap-2 rounded-[2px] border border-rule bg-surface px-5 py-3 text-xs font-semibold uppercase tracking-[0.08em] hover:border-steel">
              Browse passports
            </Link>
          </div>
          <p className="mt-4 text-sm text-ink-muted">Track: Carbon Markets &amp; Emissions Transparency · IEEE ClimateChain Hackathon 2026</p>
        </div>
        <Card className="grid grid-cols-2 gap-6">
          <Metric label="Verified batches" value={issued.length} />
          <Metric label="Verified tonnes" value={fmtT(verifiedT)} unit="t" />
          <Metric label="Surrendered" value={fmtT(surrendered)} unit="t" />
          <Metric label="On-chain events" value={eventCount} />
          <p className="col-span-2 border-t border-rule pt-3 text-xs text-ink-muted">Live from {state ? `${state.network} (chain ${state.chainId})` : "the chain"}.</p>
        </Card>
      </section>

      <section>
        <div className="label mb-4">The problem</div>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <div className="font-mono text-3xl font-semibold text-molten tnum">+10%</div>
            <p className="mt-2 font-semibold">Unverified data costs more</p>
            <p className="mt-1 text-sm text-ink-muted">Without verified actual emissions, importers must use EU default values plus a markup. A clean mill gets priced like a dirty one, so there&apos;s no reward for cutting emissions.</p>
          </Card>
          <Card>
            <div className="font-mono text-3xl font-semibold text-molten tnum">2×</div>
            <p className="mt-2 font-semibold">Double counting</p>
            <p className="mt-1 text-sm text-ink-muted">Nothing stops the same verified low-carbon tonnes being promised to two buyers, a period certified twice, or one report reused across declarations.</p>
          </Card>
          <Card>
            <div className="font-mono text-3xl font-semibold text-molten tnum">PDF</div>
            <p className="mt-2 font-semibold">Evidence travels by email</p>
            <p className="mt-1 text-sm text-ink-muted">Importers can&apos;t tell if a file is the version the verifier approved, or if the verifier is accredited at all. SMEs can&apos;t afford consultants.</p>
          </Card>
        </div>
      </section>

      <section>
        <div className="label mb-4">How it works</div>
        <ol className="grid gap-4 md:grid-cols-5">
          {STEPS.map((s) => (
            <li key={s.n} className="rounded-[4px] border border-rule bg-surface p-5">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-sm text-molten">{s.n}</span>
                <span className="text-[0.7rem] uppercase tracking-wider text-ink-muted">{s.who}</span>
              </div>
              <p className="mt-3 font-semibold leading-snug">{s.title}</p>
              <p className="mt-2 text-sm text-ink-muted">{s.body}</p>
              <p className="mt-3 font-mono text-[0.7rem] text-steel">{s.tech}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <div className="label">Why a blockchain?</div>
          <h2 className="mt-3 font-serif text-2xl font-semibold">Because the core risk is a double-spend.</h2>
          <p className="mt-3 text-ink-muted">
            The AI suggests and explains; it never writes to the chain. The chain guarantees what humans signed, when, and that verified tonnes are conserved.
            It doesn&apos;t make a meter reading true, which is why an accredited verifier and anomaly checks sit in front of it.
          </p>
        </div>
        <Card className="p-0 sm:p-0">
          <table className="w-full text-sm">
            <tbody>
              {WHY.map(([need, why]) => (
                <tr key={need} className="border-b border-rule last:border-0">
                  <td className="p-4 align-top font-medium">{need}</td>
                  <td className="p-4 align-top text-ink-muted">{why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <p className="border-t border-rule pt-6 text-xs text-ink-muted">
        Prototype on a public testnet. Companies, installations and verifiers are fictional demo entities. Emission factors and default values are illustrative
        (see <code className="font-mono">data/factors.json</code>).
      </p>
    </div>
  );
}
