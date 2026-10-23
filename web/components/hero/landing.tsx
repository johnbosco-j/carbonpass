"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useDemo } from "@/components/demo-provider";
import { cx } from "@/components/ui";
import { HERO } from "./data";
import { CountUp, Parallax, Reveal } from "./motion";

const STEPS = [
  { n: "01", who: "Producer", tech: "AI", title: "Evidence in, numbers out", body: "Invoices and production logs are read by an AI model (Gemini). Every quantity is cited to its page and confirmed by a human." },
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

const PROBLEMS = [
  {
    figure: `+${Math.round(HERO.markup2026 * 100)}%`,
    title: "Unverified data costs more",
    body: "Without verified actual emissions, importers must use EU default values plus a mark-up. A clean mill gets priced like a dirty one, so there's no reward for cutting emissions.",
  },
  {
    figure: "2×",
    title: "Double counting",
    body: "Nothing stops the same verified low-carbon tonnes being promised to two buyers, a period certified twice, or one report reused across declarations.",
  },
  {
    figure: "PDF",
    title: "Evidence travels by email",
    body: "Importers can't tell if a file is the version the verifier approved, or if the verifier is accredited at all. SMEs can't afford consultants.",
  },
];

export function Landing() {
  const { state, error } = useDemo();
  const issued = state?.batches.filter((b) => b.status === "Issued") ?? [];
  const metrics: { label: string; value: number | null; unit?: string }[] = [
    { label: "Verified batches", value: state ? issued.length : null },
    { label: "Verified tonnes", value: state ? issued.reduce((s, b) => s + b.tonnes, 0) : null, unit: "t" },
    { label: "Surrendered", value: state ? state.batches.reduce((s, b) => s + b.surrendered, 0) : null, unit: "t" },
    { label: "On-chain events", value: state ? state.events.length : null },
  ];

  return (
    <div id="landing" className="scroll-mt-24 space-y-24 pt-16 sm:pt-20">
      <section aria-labelledby="live-h">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rule pb-4">
            <div>
              <div className="label">Live from the chain</div>
              <h2 id="live-h" className="mt-2 font-serif text-2xl font-semibold sm:text-3xl">
                Every number here is read from the contract.
              </h2>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-rule px-3 py-1 font-mono text-xs tnum">
              <span className={cx("h-2 w-2 rounded-full", error ? "bg-revoked" : state ? "bg-verified" : "animate-pulse bg-anomaly")} />
              {error ? "chain offline" : state ? `${state.network} · chain ${state.chainId} · block #${state.latestBlock}` : "connecting"}
            </span>
          </div>
        </Reveal>
        <div className="grid grid-cols-2 border-b border-rule md:grid-cols-4">
          {metrics.map((m, i) => (
            <Reveal key={m.label} delay={i * 60} className={cx("px-1 py-6 sm:px-5", i % 2 === 1 && "border-l border-rule", i === 2 && "md:border-l md:border-rule", i >= 2 && "border-t border-rule md:border-t-0")}>
              <div className="label">{m.label}</div>
              <div className="mt-2 font-mono text-3xl font-semibold leading-none sm:text-4xl">
                <CountUp value={m.value} />
                {m.unit && <span className="ml-1.5 font-sans text-sm font-normal text-ink-muted">{m.unit}</span>}
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={240}>
          <p className="mt-3 text-xs text-ink-muted">
            Batches are minted by the demo flow on a public testnet. Run it yourself, or{" "}
            <Link href="/passport" className="underline decoration-rule underline-offset-2 hover:decoration-ink">
              open a passport
            </Link>
            .
          </p>
        </Reveal>
      </section>

      <section aria-labelledby="problem-h">
        <Reveal>
          <div className="label">The problem</div>
          <h2 id="problem-h" className="mt-2 max-w-2xl font-serif text-2xl font-semibold sm:text-3xl">
            A clean mill is priced like a dirty one, and its proof can be sold twice.
          </h2>
        </Reveal>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {PROBLEMS.map((c, i) => (
            <Parallax key={c.title} speed={0.02 + i * 0.03}>
              <Reveal delay={i * 60} className="h-full">
                <div className="h-full rounded-[4px] border border-rule bg-surface p-6">
                  <div className="font-mono text-4xl font-semibold tnum">{c.figure}</div>
                  <p className="mt-4 font-semibold">{c.title}</p>
                  <p className="mt-1.5 text-sm text-ink-muted">{c.body}</p>
                </div>
              </Reveal>
            </Parallax>
          ))}
        </div>
      </section>

      <HowItWorks />

      <section className="grid gap-8 lg:grid-cols-[1fr_1.4fr]" aria-labelledby="why-h">
        <Reveal>
          <div className="label">Why a blockchain?</div>
          <h2 id="why-h" className="mt-2 font-serif text-2xl font-semibold sm:text-3xl">
            Because the core risk is a double-spend.
          </h2>
          <p className="mt-4 text-ink-muted">
            The AI suggests and explains; it never writes to the chain. The chain guarantees what humans signed, when, and that verified tonnes are conserved.
            It doesn&apos;t make a meter reading true, which is why an accredited verifier and anomaly checks sit in front of it.
          </p>
        </Reveal>
        <div className="rounded-[4px] border border-rule bg-surface">
          {WHY.map(([need, why], i) => (
            <Reveal key={need} delay={i * 60} className="grid gap-1 border-b border-rule p-4 last:border-0 sm:grid-cols-2 sm:gap-6">
              <p className="text-sm font-medium">{need}</p>
              <p className="text-sm text-ink-muted">{why}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <Reveal>
        <div className="flex flex-col items-start justify-between gap-6 border-y border-rule py-10 sm:flex-row sm:items-center">
          <div>
            <div className="label">Three minutes, five roles</div>
            <p className="mt-2 font-serif text-2xl font-semibold">Producer → Verifier → Shipments → Importer → Passport</p>
          </div>
          <Link
            href="/producer"
            className="inline-flex shrink-0 items-center gap-2 rounded-[2px] bg-molten px-5 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-white hover:bg-molten-deep"
          >
            Run the demo →
          </Link>
        </div>
      </Reveal>

      <p className="text-xs text-ink-muted">
        Prototype on a public testnet. Companies, installations and verifiers are fictional demo entities. Emission factors and default values are illustrative
        (see <code className="font-mono">data/factors.json</code>).
      </p>
    </div>
  );
}

/** Five steps on a ledger rule; the rule fills as the section scrolls through the viewport. */
function HowItWorks() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const t = (window.innerHeight * 0.85 - r.top) / (r.height * 0.9);
      el.style.setProperty("--fill", String(Math.min(Math.max(t, 0), 1)));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <section ref={ref} aria-labelledby="how-h" className="cp-how">
      <Reveal>
        <div className="label">How it works</div>
        <h2 id="how-h" className="mt-2 font-serif text-2xl font-semibold sm:text-3xl">
          From an invoice to a burned certificate, in five signed steps.
        </h2>
      </Reveal>
      <ol className="cp-how-steps relative mt-10 grid gap-8 md:grid-cols-5 md:gap-5">
        <span aria-hidden className="cp-how-rule" />
        {STEPS.map((s, i) => (
          <li key={s.n} className="relative pl-8 md:pl-0 md:pt-8">
            <span aria-hidden className="cp-how-node" />
            <Reveal delay={i * 60}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-sm text-steel tnum">{s.n}</span>
                <span className="text-[0.7rem] uppercase tracking-wider text-ink-muted">{s.who}</span>
              </div>
              <p className="mt-2 font-semibold leading-snug">{s.title}</p>
              <p className="mt-2 text-sm text-ink-muted">{s.body}</p>
              <span className="mt-3 inline-block rounded-[2px] bg-sunken px-2 py-0.5 font-mono text-[0.7rem] text-steel">{s.tech}</span>
            </Reveal>
          </li>
        ))}
      </ol>
    </section>
  );
}
