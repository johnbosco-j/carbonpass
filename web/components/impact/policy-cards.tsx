import type { ReactNode } from "react";

interface Source {
  label: string;
  href: string;
}

const CARDS: { tag: string; figure: string; title: string; body: ReactNode; link: ReactNode; sources: Source[] }[] = [
  {
    tag: "Türkiye · industry",
    figure: "~70% EAF",
    title: "Exporters say the defaults miss their low-carbon steel",
    body: "About 70% of Türkiye's steel comes from electric arc furnaces. The Aegean Ferrous and Non-Ferrous Metals Exporters' Association says the CBAM default values don't reflect that lower-carbon production, and that it is unclear which bodies accredit verifiers.",
    link: "CarbonPass gives each plant its own verified value and keeps an on-chain registry of accredited verifiers.",
    sources: [
      { label: "SteelOrbis, 1 Apr 2026", href: "https://www.steelorbis.com/steel-news/latest-news/turkish-steel-sector-cbam-default-values-fail-to-reflect-low-carbon-production-1445161.htm" },
      { label: "Eurometal", href: "https://eurometal.net/turkish-steel-sector-cbam-default-values-fail-to-reflect-low-carbon-production/" },
    ],
  },
  {
    tag: "COP31 · Nov 2026",
    figure: "Antalya",
    title: "Türkiye hosts COP31, with Australia leading negotiations",
    body: "The conference is in Antalya, Türkiye, with Australia as President of Negotiations. The winners of this hackathon are announced there.",
    link: "A working evidence-to-border pipeline for a Turkish mill is a concrete, local example of carbon-market transparency.",
    sources: [{ label: "Prime Minister of Australia", href: "https://www.pm.gov.au/media/cop-be-hosted-turkiye-australia-leading-negotiations" }],
  },
  {
    tag: "Türkiye · domestic ETS",
    figure: "MRV-only 2026",
    title: "The Türkiye ETS pilot starts with reporting",
    body: "Climate Law No. 7552 (July 2025) set up a national emissions trading system. Under the 2026 pilot rules, installations only monitor and report in 2026. EXIST runs the market and the registry.",
    link: "The same verified monitoring data can feed the pilot. Once a domestic carbon price is paid, CBAM lets importers deduct it (Reg. 2023/956, Art. 9), and that deduction also needs trusted data.",
    sources: [{ label: "ICAP", href: "https://icapcarbonaction.com/en/news/turkiye-unveils-regulation-its-national-emissions-trading-system" }],
  },
  {
    tag: "India · CCTS",
    figure: "4.28 t/t",
    title: "India's carbon market goes live as CBAM bites",
    body: "Compliance credits under India's Carbon Credit Trading Scheme are expected to be issued and traded around October 2026. Research already finds CBAM reshaping EU–India steel trade. India's EU default for hot-rolled steel is 4.28 tCO₂e/t, so clean Indian mills lose the most on defaults.",
    link: "One pipeline produces both the CCTS intensity data and the CBAM passport.",
    sources: [
      { label: "Outlook Business", href: "https://www.outlookbusiness.com/news/india-to-launch-first-carbon-trading-programme-by-october-2026" },
      { label: "Nature Climate Change, 2026", href: "https://www.nature.com/articles/s41558-026-02607-y" },
    ],
  },
];

export function PolicyCards() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {CARDS.map((c) => (
        <article key={c.tag} className="flex flex-col rounded-[4px] border border-rule bg-surface p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="label">{c.tag}</span>
            <span className="font-mono text-lg font-semibold text-steel">{c.figure}</span>
          </div>
          <h3 className="mt-3 font-semibold leading-snug">{c.title}</h3>
          <p className="mt-2 text-sm text-ink-muted">{c.body}</p>
          <p className="mt-3 border-l-2 border-steel pl-3 text-sm">{c.link}</p>
          <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-4 text-xs">
            <span className="text-ink-muted">Source:</span>
            {c.sources.map((s) => (
              <a key={s.href} href={s.href} target="_blank" rel="noreferrer" className="text-steel underline decoration-rule underline-offset-2 hover:text-molten">
                {s.label} ↗
              </a>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
