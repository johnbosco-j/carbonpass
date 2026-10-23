"use client";

import { usePathname } from "next/navigation";
import { useDemo } from "@/components/demo-provider";

/**
 * The landing hero's stage, carried onto every other page: a perspective ledger floor with a molten horizon above
 * the page title, registration marks and a live ledger readout (the page's own label already names its step).
 * Purely decorative; it sits behind <main>'s content.
 */
export function StageBackdrop() {
  const path = usePathname();
  const { state, error } = useDemo();
  if (path === "/") return null;
  const readout = error ? "Ledger offline" : state ? `Ledger · ${state.network} · block #${state.latestBlock.toLocaleString("en-US")}` : "Ledger · connecting";
  return (
    <div className="cp-backdrop" aria-hidden>
      <div className="cp-backdrop-floor" />
      <div className="cp-backdrop-glow" />
      <div className="cp-backdrop-scan" />
      <span className="cp-backdrop-reg cp-backdrop-reg-l" />
      <span className="cp-backdrop-reg cp-backdrop-reg-r" />
      <div className="cp-backdrop-hud font-mono">
        <span className="cp-backdrop-hud-rule" /> {readout}
      </div>
    </div>
  );
}
