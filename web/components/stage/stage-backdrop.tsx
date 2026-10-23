"use client";

import { usePathname } from "next/navigation";

/** Where each page sits in the demo flow, for the header readout. */
const PAGES: { prefix: string; step: string; name: string }[] = [
  { prefix: "/producer", step: "01", name: "Producer" },
  { prefix: "/verifier", step: "02", name: "Verifier" },
  { prefix: "/shipments", step: "03", name: "Shipments" },
  { prefix: "/importer", step: "04", name: "Importer" },
  { prefix: "/passport", step: "05", name: "Passport" },
  { prefix: "/impact", step: "—", name: "Climate impact" },
];

/**
 * The landing hero's stage, carried onto every other page: a perspective ledger floor with a molten glow behind
 * the page title, registration marks and a flow readout. Purely decorative; it sits behind <main>'s content.
 */
export function StageBackdrop() {
  const path = usePathname();
  if (path === "/") return null;
  const page = PAGES.find((p) => path.startsWith(p.prefix));
  return (
    <div className="cp-backdrop" aria-hidden>
      <div className="cp-backdrop-floor" />
      <div className="cp-backdrop-glow" />
      <div className="cp-backdrop-scan" />
      <span className="cp-backdrop-reg cp-backdrop-reg-l" />
      <span className="cp-backdrop-reg cp-backdrop-reg-r" />
      {page && (
        <div className="cp-backdrop-hud font-mono">
          {page.step === "—" ? page.name : `${page.step} / 05 · ${page.name}`}
          <span className="cp-backdrop-hud-rule" />
          CarbonPass ledger · Sepolia
        </div>
      )}
    </div>
  );
}
