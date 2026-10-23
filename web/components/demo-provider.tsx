"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ChainState } from "@/lib/chain/state";
import type { EvidenceBundle } from "@/lib/evidence";
import { Toasts } from "./toasts";

export interface Toast {
  id: number;
  kind: "pending" | "success" | "error";
  title: string;
  detail?: string;
  hash?: string;
  explorer?: string | null;
  block?: number;
}

export interface TxResponse {
  ok: boolean;
  hash?: string;
  explorer?: string | null;
  blockNumber?: number;
  revert?: { name: string; args: unknown[]; message: string };
  error?: string;
  batchId?: number;
  pq?: { scheme: string; signatureBytes: number; signatureHash: string; signMs: number };
}

interface DemoCtx {
  state: ChainState | null;
  error: string | null;
  refresh: () => Promise<void>;
  toasts: Toast[];
  dismiss: (id: number) => void;
  tx: (action: string, body: unknown, title: string) => Promise<TxResponse>;
  loadBundle: (batchId: number) => EvidenceBundle | null;
  saveBundle: (batchId: number, bundle: EvidenceBundle) => void;
}

const Ctx = createContext<DemoCtx | null>(null);

const fmt = (x: unknown) => Number(x).toLocaleString("en-US");

/** Human-readable contract errors (custom errors from CarbonPassport / OpenZeppelin ERC-1155). */
export function explainRevert(r: { name: string; args: unknown[] }): string {
  switch (r.name) {
    case "ERC1155InsufficientBalance":
      return Number(r.args[1]) === 0
        ? `${fmt(r.args[2])} t requested, but every verified tonne of this batch is already allocated. Double counting blocked.`
        : `${fmt(r.args[2])} t requested, only ${fmt(r.args[1])} verified tonnes remaining. Double counting blocked.`;
    case "PeriodOverlap":
      return "This reporting period is already certified for this installation and product.";
    case "ReportAlreadyUsed":
      return "This evidence report has already been used for another batch.";
    case "SelfVerification":
      return "A producer cannot verify its own batch.";
    case "NotActiveVerifier":
      return "Only an accredited, active verifier can issue.";
    case "BatchFrozen":
      return "This batch was revoked; its tonnes are frozen.";
    case "NotPending":
      return "This batch is no longer pending.";
    default:
      return r.name;
  }
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ChainState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setState(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    // Initial load + light polling; the first refresh runs on the next tick, not synchronously in the effect.
    const first = setTimeout(refresh, 0);
    const t = setInterval(refresh, 6000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [refresh]);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = nextId.current++;
    setToasts((ts) => [...ts.slice(-3), { ...t, id }]);
    return id;
  }, []);
  const update = useCallback((id: number, patch: Partial<Toast>) => setToasts((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t))), []);
  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);

  const tx = useCallback(
    async (action: string, body: unknown, title: string): Promise<TxResponse> => {
      const id = push({ kind: "pending", title, detail: "Submitting transaction…" });
      try {
        const res = await fetch(`/api/tx/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        const json = (await res.json()) as TxResponse;
        if (json.ok) {
          update(id, { kind: "success", detail: `Confirmed in block #${json.blockNumber}`, hash: json.hash, explorer: json.explorer, block: json.blockNumber });
          setTimeout(() => dismiss(id), 9000);
        } else if (json.revert) {
          update(id, {
            kind: "error",
            title: `Rejected by contract: ${json.revert.name}`,
            detail: explainRevert(json.revert) + (json.hash ? " The failed transaction is recorded on-chain." : ""),
            hash: json.hash,
            explorer: json.explorer,
          });
        } else {
          update(id, { kind: "error", title: `${title} failed`, detail: json.error ?? "Unknown error" });
        }
        await refresh();
        return json;
      } catch (e) {
        update(id, { kind: "error", title: `${title} failed`, detail: e instanceof Error ? e.message : String(e) });
        return { ok: false, error: String(e) };
      }
    },
    [push, update, dismiss, refresh],
  );

  // Keyed by deployment so a redeploy at the same address never picks up stale evidence.
  const deployKey = state ? `${state.chainId}:${state.contracts.passport}:${state.deployedAt}` : "?";
  const keyFor = useCallback((batchId: number) => `carbonpass:${deployKey}:bundle:${batchId}`, [deployKey]);
  const loadBundle = useCallback(
    (batchId: number) => {
      try {
        const raw = localStorage.getItem(keyFor(batchId));
        return raw ? (JSON.parse(raw) as EvidenceBundle) : null;
      } catch {
        return null;
      }
    },
    [keyFor],
  );
  const saveBundle = useCallback(
    (batchId: number, bundle: EvidenceBundle) => {
      try {
        localStorage.setItem(keyFor(batchId), JSON.stringify(bundle));
      } catch {
        /* storage unavailable: evidence stays in memory for this page only */
      }
    },
    [keyFor],
  );

  const value = useMemo(
    () => ({ state, error, refresh, toasts, dismiss, tx, loadBundle, saveBundle }),
    [state, error, refresh, toasts, dismiss, tx, loadBundle, saveBundle],
  );
  return (
    <Ctx.Provider value={value}>
      {children}
      <Toasts />
    </Ctx.Provider>
  );
}

export function useDemo() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDemo outside DemoProvider");
  return c;
}
