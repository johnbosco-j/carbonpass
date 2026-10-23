"use client";

import { useState } from "react";
import { proofFor, sha256, type EvidenceBundle } from "@/lib/evidence";
import { Badge, Card, HashChip } from "./ui";

type Result =
  | { kind: "match"; name: string; hash: string; onchain: boolean }
  | { kind: "altered"; name: string; hash: string; expected: string }
  | { kind: "unknown"; name: string; hash: string };

/**
 * Re-hashes a dropped evidence file and checks it against the batch's committed Merkle root:
 * the doc leaf + proof come from the evidence pack, the inclusion check runs in the contract.
 */
export function TamperCheck({ batchId, bundle }: { batchId: number; bundle: EvidenceBundle | null }) {
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  async function check(file: File) {
    setBusy(true);
    try {
      const hash = await sha256(await file.arrayBuffer());
      const leafInfo = bundle ? proofFor(bundle, `doc.${file.name}`) : null;
      if (!leafInfo) return setResult({ kind: "unknown", name: file.name, hash });
      if (leafInfo.leaf[1] !== hash) return setResult({ kind: "altered", name: file.name, hash, expected: leafInfo.leaf[1] });
      const res = await fetch("/api/disclose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ batchId, leaf: leafInfo.leaf, proof: leafInfo.proof }),
      });
      setResult({ kind: "match", name: file.name, hash, onchain: (await res.json()).included === true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4">
      <label
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[4px] border-2 border-dashed border-rule px-6 py-8 text-center hover:border-steel"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) check(f);
        }}
      >
        <span className="font-semibold">{busy ? "Checking…" : "Drop an evidence file to check it"}</span>
        <span className="text-sm text-ink-muted">Hashed in your browser (SHA-256), then proven against the on-chain Merkle root.</span>
        <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && check(e.target.files[0])} />
      </label>
      <p className="text-xs text-ink-muted">
        Try it: <a className="underline hover:text-molten" href="/samples/electricity_invoice_2026-07.pdf" download>original invoice</a> vs{" "}
        <a className="underline hover:text-molten" href="/samples/tampered/electricity_invoice_2026-07.pdf" download>tampered copy</a> (one figure changed).
        {!bundle && " The evidence pack for this batch isn't in this browser, so only batches you submitted here can be checked."}
      </p>
      {result?.kind === "match" && (
        <div className="space-y-2 rounded-[4px] bg-verified-tint p-4 text-verified">
          <Badge tone="verified">✓ Unchanged</Badge>
          <p className="text-sm">
            <span className="font-mono">{result.name}</span> matches the committed evidence. Merkle inclusion verified by the contract: {result.onchain ? "true" : "false"}.
          </p>
          <HashChip value={result.hash} label="sha256" />
        </div>
      )}
      {result?.kind === "altered" && (
        <div className="space-y-2 rounded-[4px] bg-revoked-tint p-4 text-revoked">
          <Badge tone="revoked">✗ Altered</Badge>
          <p className="text-sm">
            <span className="font-mono">{result.name}</span> is not the document the verifier signed off.
          </p>
          <div className="flex flex-wrap gap-2">
            <HashChip value={result.expected} label="committed" />
            <HashChip value={result.hash} label="this file" />
          </div>
        </div>
      )}
      {result?.kind === "unknown" && (
        <div className="rounded-[4px] bg-sunken p-4 text-sm">
          <span className="font-mono">{result.name}</span> isn&apos;t part of this batch&apos;s committed evidence.
        </div>
      )}
    </Card>
  );
}
