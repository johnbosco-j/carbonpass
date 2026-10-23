"use client";

import { useState } from "react";
import type { Check } from "@/lib/anomaly";
import { Badge, cx } from "./ui";

export function ChecksList({
  checks,
  acknowledged,
  onAcknowledge,
}: {
  checks: Check[];
  acknowledged?: Record<string, boolean>;
  onAcknowledge?: (id: string, v: boolean) => void;
}) {
  const [showOk, setShowOk] = useState(false);
  const flags = checks.filter((c) => c.severity === "review");
  const ok = checks.filter((c) => c.severity === "ok");
  return (
    <div className="space-y-3">
      {flags.map((c) => (
        <div key={c.id} className="rounded-[4px] border border-rule border-l-4 border-l-anomaly bg-anomaly-tint/60 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="anomaly">Review</Badge>
            <span className="font-semibold">{c.label}</span>
            <span className="font-mono text-sm tnum">
              {c.value.toFixed(c.unit === "%" ? 2 : 3)} {c.unit}
            </span>
          </div>
          <p className="mt-2 text-sm">{c.detail}</p>
          {onAcknowledge && (
            <label className="mt-3 flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--color-molten)]"
                checked={!!acknowledged?.[c.id]}
                onChange={(e) => onAcknowledge(c.id, e.target.checked)}
              />
              I reviewed the supporting evidence for this flag
            </label>
          )}
        </div>
      ))}
      <div className="rounded-[4px] border border-rule bg-surface">
        <button className="flex w-full items-center justify-between px-4 py-3 text-sm" onClick={() => setShowOk((s) => !s)}>
          <span>
            <Badge tone="verified">{ok.length} checks passed</Badge>
            <span className="ml-3 text-ink-muted">history z-scores, physical bounds, invoice vs meter</span>
          </span>
          <span className="text-ink-muted">{showOk ? "Hide" : "Show"}</span>
        </button>
        {showOk && (
          <ul className="border-t border-rule">
            {ok.map((c) => (
              <li key={c.id} className={cx("flex flex-wrap gap-x-4 gap-y-1 border-b border-rule px-4 py-2 text-sm last:border-0")}>
                <span className="font-medium">{c.label}</span>
                <span className="font-mono text-xs tnum text-steel">
                  {c.value.toFixed(c.unit === "%" ? 2 : 3)} {c.unit}
                </span>
                <span className="text-ink-muted">{c.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
