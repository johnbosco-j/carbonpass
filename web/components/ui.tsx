"use client";

import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("cp-card rounded-[4px] border border-rule bg-surface p-5 sm:p-6", className)}>{children}</div>;
}

export function SectionHead({ n, title, hint, right }: { n?: string; title: string; hint?: ReactNode; right?: ReactNode }) {
  return (
    <div className="cp-section-head mb-5 flex flex-wrap items-end justify-between gap-3 pb-3">
      <div>
        <div className="flex items-center gap-3">
          {n && <span className="cp-section-n font-mono text-xs text-molten tnum">{n}</span>}
          <h2 className="font-serif text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
        </div>
        {hint && <p className="mt-1 text-sm text-ink-muted">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

type Tone = "verified" | "anomaly" | "revoked" | "pending" | "steel";
const TONES: Record<Tone, string> = {
  verified: "bg-verified-tint text-verified",
  anomaly: "bg-anomaly-tint text-anomaly",
  revoked: "bg-revoked-tint text-revoked",
  pending: "border border-steel text-steel",
  steel: "bg-steel text-paper",
};

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.08em]", TONES[tone])}>{children}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const tone: Tone = status === "Issued" ? "verified" : status === "Revoked" || status === "Rejected" ? "revoked" : "pending";
  return <Badge tone={tone}>{status}</Badge>;
}

export function short(v: string, head = 6, tail = 4) {
  return v.length <= head + tail + 2 ? v : `${v.slice(0, head)}…${v.slice(-tail)}`;
}

export function HashChip({ value, href, label }: { value: string; href?: string | null; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-[2px] bg-sunken px-2 py-0.5 font-mono text-[0.8rem] text-steel tnum">
      {label && <span className="font-sans text-[0.7rem] uppercase tracking-wider text-ink-muted">{label}</span>}
      <span title={value} className="truncate">
        {short(value)}
      </span>
      <button
        type="button"
        aria-label="Copy"
        className="text-ink-muted hover:text-ink"
        onClick={() => {
          navigator.clipboard?.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          });
        }}
      >
        {copied ? "✓" : "⧉"}
      </button>
      {href && (
        <a href={href} target="_blank" rel="noreferrer" aria-label="View on explorer" className="text-ink-muted hover:text-molten">
          ↗
        </a>
      )}
    </span>
  );
}

export function Button({ variant = "primary", className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-[2px] px-5 py-3 text-xs font-semibold uppercase tracking-[0.08em] transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const v =
    variant === "primary"
      ? "bg-molten text-white hover:bg-molten-deep"
      : variant === "secondary"
        ? "border border-rule bg-surface text-ink hover:border-steel"
        : "text-ink-muted hover:text-ink";
  return <button {...props} className={cx(base, v, className)} />;
}

export function Metric({ value, unit, label, accent }: { value: ReactNode; unit?: string; label: string; accent?: boolean }) {
  return (
    <div role="group" aria-label={label}>
      <div className="label">{label}</div>
      <div className={cx("mt-1 font-mono text-3xl font-semibold leading-none tnum sm:text-4xl", accent && "text-molten")}>
        {value}
        {unit && <span className="ml-1.5 font-sans text-sm font-normal text-ink-muted">{unit}</span>}
      </div>
    </div>
  );
}

export function Fictional({ children = "fictional demo entity" }: { children?: ReactNode }) {
  return <span className="text-xs text-ink-muted">({children})</span>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

export const fmtT = (x: number) => x.toLocaleString("en-US");
export const fmtDate = (ts: number) => (ts ? new Date(ts * 1000).toISOString().slice(0, 10) : "—");
export const fmtDateTime = (ts: number) => (ts ? new Date(ts * 1000).toISOString().replace("T", " ").slice(0, 16) + " UTC" : "—");
