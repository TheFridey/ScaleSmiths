"use client"

import type { LucideIcon } from "lucide-react"
import { AlertTriangle, ShieldAlert, ShieldCheck } from "lucide-react"
import type { ProviderHealthSnapshot } from "@/lib/server/forge-provider-health"

const T = {
  s1: "var(--s1)",
  s2: "var(--s2)",
  b1: "var(--b1)",
  t1: "var(--t1)",
  t2: "var(--t2)",
  t3: "var(--t3)",
  grn: "var(--grn)",
  amb: "var(--amb)",
}

const STATE_TONE: Record<string, { label: string; color: string; Icon: LucideIcon }> = {
  closed: { label: "Healthy", color: T.grn, Icon: ShieldCheck },
  "half-open": { label: "Recovering", color: T.amb, Icon: AlertTriangle },
  open: { label: "Unavailable", color: "#f87171", Icon: ShieldAlert },
}

export function ForgeProviderHealthPanel({ health }: { health: ProviderHealthSnapshot }) {
  return (
    <section className="mb-3 shrink-0 rounded-[8px] border p-3" style={{ background: T.s1, borderColor: T.b1 }}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={15} style={{ color: "#22d3ee" }} aria-hidden="true" />
          <h2 className="font-syne text-sm font-extrabold" style={{ color: T.t1 }}>Provider Health</h2>
        </div>
        <span className="font-dm text-[11px]" style={{ color: T.t2 }}>
          {health.providers.length} provider{health.providers.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {health.providers.map((entry) => {
          const tone = STATE_TONE[entry.state] ?? STATE_TONE.closed
          return (
            <div key={entry.provider} className="rounded-[8px] border p-3" style={{ background: T.s2, borderColor: T.b1 }}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="truncate font-dm text-xs font-semibold capitalize" style={{ color: T.t1 }}>{entry.provider}</span>
                <tone.Icon size={14} style={{ color: tone.color }} aria-hidden="true" />
              </div>
              <div className="font-syne text-sm font-extrabold" style={{ color: tone.color }}>{tone.label}</div>
              <div className="mt-1 font-dm text-[11px] leading-4" style={{ color: T.t2 }}>
                {entry.recentFailures} recent failure{entry.recentFailures === 1 ? "" : "s"}
                {entry.lastCategory ? ` · ${entry.lastCategory}` : ""}
                {entry.cooldownRemainingMs > 0 ? ` · retry in ${Math.ceil(entry.cooldownRemainingMs / 1000)}s` : ""}
              </div>
            </div>
          )
        })}
      </div>

      {health.recentEvents.length > 0 && (
        <div className="mt-3 rounded-[8px] border p-3" style={{ background: T.s2, borderColor: T.b1 }}>
          <div className="mb-2 font-dm text-[10px] font-semibold uppercase tracking-[.12em]" style={{ color: T.t3 }}>Recent Events</div>
          <ul className="grid gap-1.5">
            {health.recentEvents.slice(0, 8).map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-3 font-dm text-[11px]" style={{ color: T.t2 }}>
                <span className="truncate">
                  <span className="capitalize" style={{ color: T.t1 }}>{event.provider}</span>{" "}
                  {event.event === "failover"
                    ? `failover → ${event.toState}`
                    : `${event.fromState ?? "?"} → ${event.toState ?? "?"}`}
                  {event.category ? ` (${event.category})` : ""}
                </span>
                <span className="shrink-0" style={{ color: T.t3 }}>{new Date(event.createdAt).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
