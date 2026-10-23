"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDemo } from "./demo-provider";
import { cx } from "./ui";

const LINKS = [
  { href: "/producer", label: "Producer", step: "1" },
  { href: "/verifier", label: "Verifier", step: "2" },
  { href: "/shipments", label: "Shipments", step: "3" },
  { href: "/importer", label: "Importer", step: "4" },
  { href: "/passport", label: "Passports", step: "5" },
];

export function TopBar() {
  const path = usePathname();
  const { state, error } = useDemo();
  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-serif text-xl font-semibold tracking-tight">CarbonPass</span>
          <span className="hidden font-mono text-[0.7rem] text-ink-muted sm:inline">CBAM · verified tonnes</span>
        </Link>
        <nav className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto" aria-label="Demo roles">
          {LINKS.map((l) => {
            const active = path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cx(
                  "whitespace-nowrap rounded-[2px] px-3 py-1.5 text-sm",
                  active ? "bg-ink text-paper" : "text-ink-muted hover:bg-sunken hover:text-ink",
                )}
              >
                <span className="mr-1.5 font-mono text-[0.7rem] opacity-70">{l.step}</span>
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2 rounded-full border border-rule px-3 py-1 font-mono text-xs">
          <span className={cx("h-2 w-2 rounded-full", error ? "bg-revoked" : state ? "bg-verified" : "animate-pulse bg-anomaly")} />
          {error ? "chain offline" : state ? `${state.network} · #${state.latestBlock}` : "connecting"}
        </div>
      </div>
    </header>
  );
}
