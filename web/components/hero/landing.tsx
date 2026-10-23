"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
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
    <div id="landing" className="scroll-mt-24 space-y-28 pt-20 sm:space-y-36 sm:pt-28">
      <section aria-labelledby="live-h">
        <Reveal>
          <SectHead
            id="live-h"
            n="01"
            kicker="Live from the chain"
            title="Every number here is read from the contract."
            right={
              <span className="inline-flex items-center gap-2 rounded-full border border-rule bg-paper/60 px-3 py-1 font-mono text-xs tnum">
                <span className={cx("h-2 w-2 rounded-full", error ? "bg-revoked" : state ? "cp-live-dot bg-verified" : "animate-pulse bg-anomaly")} />
                {error ? "chain offline" : state ? `${state.network} · chain ${state.chainId} · block #${state.latestBlock}` : "connecting"}
              </span>
            }
          />
        </Reveal>
        <div className="cp-readout grid grid-cols-2 md:grid-cols-4">
          <span aria-hidden className="cp-readout-scan" />
          {metrics.map((m, i) => (
            <Reveal key={m.label} delay={i * 60} className="cp-readout-cell">
              <div className="label">{m.label}</div>
              <div className="cp-readout-value mt-3 font-mono font-semibold leading-none">
                <CountUp value={m.value} />
                {m.unit && <span className="ml-1.5 font-sans text-sm font-normal text-ink-muted">{m.unit}</span>}
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={240}>
          <p className="mt-4 text-xs text-ink-muted">
            Batches are minted by the demo flow on a public testnet, across all products (hot-rolled steel and its pig-iron precursor). Run it
            yourself, or{" "}
            <Link href="/passport" className="underline decoration-rule underline-offset-2 hover:decoration-ink">
              open a passport
            </Link>
            .
          </p>
        </Reveal>
      </section>

      <section aria-labelledby="problem-h">
        <Reveal>
          <SectHead id="problem-h" n="02" kicker="The problem" title="A clean mill is priced like a dirty one, and its proof can be sold twice." />
        </Reveal>
        <div className="grid gap-5 md:grid-cols-3">
          {PROBLEMS.map((c, i) => (
            <Parallax key={c.title} speed={0.02 + i * 0.03}>
              <Reveal delay={i * 60} className="h-full">
                <TiltCard>
                  <div className="cp-figure text-steel">
                    <ProblemArt kind={i} />
                  </div>
                  <div className="mt-5 font-mono text-4xl font-semibold tnum">{c.figure}</div>
                  <p className="mt-3 font-semibold">{c.title}</p>
                  <p className="mt-1.5 text-sm text-ink-muted">{c.body}</p>
                </TiltCard>
              </Reveal>
            </Parallax>
          ))}
        </div>
      </section>

      <HowItWorks />

      <section className="grid gap-10 lg:grid-cols-[1fr_1.35fr]" aria-labelledby="why-h">
        <Reveal>
          <SectHead id="why-h" n="04" kicker="Why a blockchain?" title="Because the core risk is a double-spend." />
          <p className="-mt-2 text-ink-muted">
            The AI suggests and explains; it never writes to the chain. The chain guarantees what humans signed, when, and that verified tonnes are conserved.
            It doesn&apos;t make a meter reading true, which is why an accredited verifier and anomaly checks sit in front of it.
          </p>
        </Reveal>
        <div className="cp-card rounded-[4px] border border-rule">
          {WHY.map(([need, why], i) => (
            <Reveal key={need} delay={i * 60} className="cp-why-row grid gap-1 border-b border-rule p-5 last:border-0 sm:grid-cols-[1fr_auto_1fr] sm:items-start sm:gap-5">
              <p className="text-sm font-medium">{need}</p>
              <span aria-hidden className="hidden font-mono text-steel sm:block">→</span>
              <p className="text-sm text-ink-muted">{why}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="cp-bleed cp-cta relative overflow-hidden" aria-labelledby="cta-h">
        <div aria-hidden className="cp-cta-poster absolute inset-0" />
        <div aria-hidden className="cp-cta-scrim absolute inset-0" />
        <div className="relative mx-auto max-w-[1200px] px-4 py-20 sm:px-6 sm:py-28">
          <Reveal>
            <div className="cp-label">Three minutes, five roles</div>
            <h2 id="cta-h" className="cp-display mt-4 max-w-xl">
              Run the whole border, end to end.
            </h2>
            <ol className="mt-7 flex max-w-xl flex-wrap gap-2">
              {ROLES.map((r, i) => (
                <li key={r.href}>
                  <Link href={r.href} className="cp-role-chip">
                    <span className="font-mono text-[0.7rem] opacity-60">{String(i + 1).padStart(2, "0")}</span>
                    {r.label}
                  </Link>
                </li>
              ))}
            </ol>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/producer" className="cp-btn-primary">
                Run the demo →
              </Link>
              <Link href="/impact" className="cp-btn-ghost">
                Climate impact
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <p className="text-xs text-ink-muted">
        Prototype on a public testnet. Companies, installations and verifiers are fictional demo entities. Emission factors and default values are illustrative
        (see <code className="font-mono">data/factors.json</code>).
      </p>
    </div>
  );
}

const ROLES = [
  { href: "/producer", label: "Producer" },
  { href: "/verifier", label: "Verifier" },
  { href: "/shipments", label: "Shipments" },
  { href: "/importer", label: "Importer" },
  { href: "/passport", label: "Passport" },
];

/** Section heading in the hero's voice: a HUD index, an uppercase kicker and a serif title. */
function SectHead({ id, n, kicker, title, right }: { id: string; n: string; kicker: string; title: string; right?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-3xl">
        <div className="flex items-center gap-3">
          <span className="cp-section-n font-mono text-xs text-molten tnum">{n}</span>
          <span className="label">{kicker}</span>
        </div>
        <h2 id={id} className="mt-3 text-balance font-serif text-3xl font-semibold leading-[1.08] tracking-tight sm:text-[2.6rem]">
          {title}
        </h2>
      </div>
      {right}
    </div>
  );
}

/** A card that tilts toward the pointer in 3D, with a soft glare. Mouse only; still under reduced motion. */
function TiltCard({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      el.style.setProperty("--rx", `${((0.5 - y) * 7).toFixed(2)}deg`);
      el.style.setProperty("--ry", `${((x - 0.5) * 9).toFixed(2)}deg`);
      el.style.setProperty("--gx", `${(x * 100).toFixed(1)}%`);
      el.style.setProperty("--gy", `${(y * 100).toFixed(1)}%`);
      el.dataset.tilt = "1";
    };
    const leave = () => {
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
      delete el.dataset.tilt;
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, []);
  return (
    <div ref={ref} className="cp-tilt cp-card h-full rounded-[4px] border border-rule p-6">
      {children}
    </div>
  );
}

/** Small line drawings for the three problem cards. */
function ProblemArt({ kind }: { kind: number }) {
  if (kind === 0)
    return (
      <svg viewBox="0 0 240 88" className="h-full w-full" fill="none">
        <text x="0" y="14" className="cp-art-text">DEFAULT + MARK-UP</text>
        <rect x="0" y="22" width="196" height="14" stroke="currentColor" />
        <rect x="0" y="22" width="178" height="14" fill="url(#cp-hatch)" />
        <rect x="178" y="22" width="18" height="14" stroke="currentColor" strokeDasharray="2 2" />
        <text x="0" y="62" className="cp-art-text">VERIFIED ACTUAL</text>
        <rect x="0" y="70" width="27" height="14" className="cp-art-molten" />
        <defs>
          <pattern id="cp-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="1.5" opacity="0.55" />
          </pattern>
        </defs>
      </svg>
    );
  if (kind === 1)
    return (
      <svg viewBox="0 0 240 88" className="h-full w-full" fill="none">
        <rect x="8" y="10" width="104" height="66" rx="3" stroke="currentColor" />
        <circle cx="84" cy="43" r="16" stroke="currentColor" strokeDasharray="3 3" />
        <line x1="20" y1="26" x2="58" y2="26" stroke="currentColor" opacity="0.6" />
        <line x1="20" y1="36" x2="50" y2="36" stroke="currentColor" opacity="0.6" />
        <rect x="128" y="10" width="104" height="66" rx="3" stroke="currentColor" />
        <circle cx="204" cy="43" r="16" stroke="currentColor" strokeDasharray="3 3" />
        <line x1="140" y1="26" x2="178" y2="26" stroke="currentColor" opacity="0.6" />
        <line x1="140" y1="36" x2="170" y2="36" stroke="currentColor" opacity="0.6" />
        <text x="12" y="70" className="cp-art-text">10,000 t</text>
        <text x="132" y="70" className="cp-art-text">10,000 t</text>
        <path d="M114 37 l12 12 m0 -12 l-12 12" className="cp-art-revoked" />
      </svg>
    );
  return (
    <svg viewBox="0 0 240 88" className="h-full w-full" fill="none">
      <path d="M70 6 h70 l18 18 v58 h-88 z" stroke="currentColor" />
      <path d="M140 6 v18 h18" stroke="currentColor" />
      <line x1="82" y1="34" x2="134" y2="34" stroke="currentColor" opacity="0.6" />
      <line x1="82" y1="44" x2="146" y2="44" stroke="currentColor" opacity="0.6" />
      <line x1="82" y1="54" x2="120" y2="54" stroke="currentColor" opacity="0.6" />
      <circle cx="132" cy="66" r="11" stroke="currentColor" strokeDasharray="2 3" />
      <text x="128" y="70" className="cp-art-text">?</text>
      <path d="M8 44 h46 m-8 -6 l8 6 l-8 6" stroke="currentColor" opacity="0.5" />
      <path d="M174 44 h56 m-8 -6 l8 6 l-8 6" stroke="currentColor" opacity="0.5" />
      <text x="174" y="34" className="cp-art-text">EMAIL</text>
    </svg>
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
      const fill = Math.min(Math.max(t, 0), 1);
      el.style.setProperty("--fill", String(fill));
      el.querySelectorAll<HTMLElement>(".cp-how-node").forEach((n, i, all) => n.toggleAttribute("data-lit", fill >= i / (all.length - 1) - 0.02));
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
        <SectHead id="how-h" n="03" kicker="How it works" title="From an invoice to a burned certificate, in five signed steps." />
      </Reveal>
      <ol className="cp-how-steps relative mt-12 grid gap-8 md:grid-cols-5 md:gap-5">
        <span aria-hidden className="cp-how-rule" />
        {STEPS.map((s, i) => (
          <li key={s.n} className="relative pl-8 md:pl-0 md:pt-8">
            <span aria-hidden className="cp-how-node" />
            <Reveal delay={i * 60} className="relative">
              <span aria-hidden className="cp-how-numeral font-mono">
                {s.n}
              </span>
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
