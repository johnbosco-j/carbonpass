"use client";

import { useDemo } from "./demo-provider";
import { HashChip, cx } from "./ui";

export function Toasts() {
  const { toasts, dismiss } = useDemo();
  return (
    <div role="log" aria-live="polite" aria-label="Transactions" className="fixed bottom-4 right-4 z-50 flex w-[min(420px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="article"
          aria-labelledby={`toast-${t.id}-title`}
          className={cx(
            "animate-fade-up rounded-[4px] border bg-surface p-4 shadow-[0_8px_24px_rgba(16,32,58,0.12)]",
            t.kind === "error" ? "border-revoked" : t.kind === "success" ? "border-verified" : "border-rule",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div id={`toast-${t.id}-title`} className="flex items-center gap-2 text-sm font-semibold">
              <span
                className={cx(
                  "inline-block h-2 w-2 rounded-full",
                  t.kind === "pending" && "animate-pulse bg-molten",
                  t.kind === "success" && "bg-verified",
                  t.kind === "error" && "bg-revoked",
                )}
              />
              {t.title}
            </div>
            <button className="text-ink-muted hover:text-ink" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              ×
            </button>
          </div>
          {t.detail && <p className={cx("mt-1 text-sm", t.kind === "error" ? "text-revoked" : "text-ink-muted")}>{t.detail}</p>}
          {t.hash && (
            <div className="mt-2">
              <HashChip value={t.hash} href={t.explorer} label="tx" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
