import Link from "next/link";
import type { ReactNode } from "react";
import type { BatchView, ChainState } from "@/lib/chain/state";
import { installationInfo, PLANT } from "@/lib/demo";
import { Badge, cx, fmtT } from "./ui";

interface Node {
  key: string;
  href?: string;
  title: ReactNode;
  detail: ReactNode;
  tone?: "current" | "revoked" | "muted";
}

/**
 * Where this batch's embedded emissions come from and where its tonnes went, read from the chain:
 * precursor passports it consumed → this batch → downstream batches that consumed it and the holders it shipped to.
 */
export function SupplyChain({ batch, state }: { batch: BatchView; state: ChainState }) {
  const byId = new Map(state.batches.map((b) => [b.id, b]));
  const info = installationInfo(batch.installationId);
  const roleOf = (addr: string) => Object.entries(state.roles).find(([, a]) => a.toLowerCase() === addr.toLowerCase())?.[0] as keyof BatchView["balances"] | undefined;
  const holderName = (addr: string) => {
    const role = roleOf(addr);
    if (role === "producer") return PLANT.installation.name;
    return PLANT.importers.find((i) => i.key === role)?.name ?? `${addr.slice(0, 8)}…`;
  };

  const upstream: Node[] = batch.precursors.map((p) => {
    const pre = byId.get(p.batchId);
    const preInfo = pre ? installationInfo(pre.installationId) : null;
    return {
      key: `pre-${p.batchId}`,
      href: `/passport/${p.batchId}`,
      title: (
        <>
          {preInfo?.product ?? "Batch"} <span className="font-mono">#{p.batchId}</span>
        </>
      ),
      detail: (
        <>
          {preInfo?.name}
          {pre && <span className="block font-mono tnum">verified {(pre.directKgPerT / 1000).toFixed(3)} tCO₂e/t</span>}
          {pre?.status === "Revoked" && (
            <span className="mt-1 block">
              <Badge tone="revoked">Revoked after use</Badge>
            </span>
          )}
        </>
      ),
      tone: pre?.status === "Revoked" ? "revoked" : undefined,
    };
  });

  const consumers = state.events.filter((e) => e.type === "PrecursorConsumed" && Number(e.args.precursorId) === batch.id);
  const shippedTo = new Map<string, number>();
  for (const e of state.events) {
    if (e.type === "Shipped" && e.batchId === batch.id) shippedTo.set(String(e.args.to), (shippedTo.get(String(e.args.to)) ?? 0) + Number(e.args.tonnes));
  }
  const downstream: Node[] = [
    ...consumers.map((e) => {
      const down = byId.get(e.batchId);
      return {
        key: `down-${e.batchId}`,
        href: `/passport/${e.batchId}`,
        title: (
          <>
            {down ? installationInfo(down.installationId).product : "Batch"} <span className="font-mono">#{e.batchId}</span>
          </>
        ),
        detail: <>embeds {fmtT(Number(e.args.tonnes))} t of this batch</>,
      };
    }),
    ...[...shippedTo].map(([to, t]) => {
      const role = roleOf(to);
      const holds = role ? batch.balances[role] : undefined;
      return { key: `ship-${to}`, title: holderName(to), detail: <>{fmtT(t)} t shipped{holds !== undefined && <> · holds {fmtT(holds)} t</>}</> };
    }),
  ];

  const upstreamTonnes = batch.precursors.reduce((t, p) => t + p.tonnes, 0);
  // Net tonnes that left the producer (shipped, then possibly consumed or surrendered downstream): counted once.
  const downstreamTonnes = batch.status === "Issued" || batch.status === "Revoked" ? batch.tonnes - batch.producerBalance : 0;

  return (
    <div className="grid gap-3 md:grid-cols-[1fr_auto_1.1fr_auto_1fr] md:items-start">
      <Column label="Precursors">
        {upstream.length ? (
          upstream.map((n) => <NodeCard key={n.key} node={n} />)
        ) : (
          <NodeCard
            node={{
              key: "none",
              tone: "muted",
              title: info.supplier ? "Raw materials" : "No precursor passport",
              detail: info.supplier ? "Iron ore, coke and coal (counted in this batch's own emissions)" : "Pig iron counted at the EU default value",
            }}
          />
        )}
      </Column>
      <Arrow label={upstreamTonnes ? `${fmtT(upstreamTonnes)} t consumed` : undefined} />
      <Column label="This passport">
        <NodeCard
          node={{
            key: "self",
            tone: "current",
            title: (
              <>
                {info.product} <span className="font-mono">#{batch.id}</span>
              </>
            ),
            detail: (
              <>
                {info.name}
                <span className="block font-mono tnum">
                  {fmtT(batch.tonnes)} t · {(batch.directKgPerT / 1000).toFixed(3)} tCO₂e/t
                </span>
              </>
            ),
          }}
        />
      </Column>
      <Arrow label={downstreamTonnes ? `${fmtT(downstreamTonnes)} t left the producer` : undefined} />
      <Column label="Downstream">
        {downstream.length ? (
          downstream.map((n) => <NodeCard key={n.key} node={n} />)
        ) : (
          <NodeCard node={{ key: "none", tone: "muted", title: "Not shipped yet", detail: "All tonnes are with the producer" }} />
        )}
      </Column>
    </div>
  );
}

function Column({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="label">{label}</div>
      {children}
    </div>
  );
}

function Arrow({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-1 text-ink-muted md:min-w-24 md:flex-col md:gap-1 md:pt-9">
      <span aria-hidden className="text-xl leading-none md:hidden">
        ↓
      </span>
      <span aria-hidden className="hidden text-xl leading-none md:inline">
        →
      </span>
      {label && <span className="font-mono text-xs tnum">{label}</span>}
    </div>
  );
}

function NodeCard({ node }: { node: Node }) {
  const body = (
    <div
      className={cx(
        "rounded-[2px] border px-4 py-3 text-sm",
        node.tone === "current" ? "border-molten bg-surface" : node.tone === "revoked" ? "border-revoked bg-revoked-tint" : "border-rule bg-surface",
        node.tone === "muted" && "border-dashed text-ink-muted",
        node.href && "transition-colors hover:border-steel",
      )}
    >
      <div className="font-semibold">{node.title}</div>
      <div className="mt-0.5 text-xs text-ink-muted">{node.detail}</div>
    </div>
  );
  return node.href ? (
    <Link href={node.href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}
