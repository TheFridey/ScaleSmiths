"use client"

import { useState } from "react"
import { ChevronDown, Terminal } from "lucide-react"
import { ForgeQaPanel } from "./ForgeQaPanel"
import type { ForgeGeneratedCodeArtifactState } from "@/lib/forge-frontend-code"
import type { ForgeQaArtifactState } from "@/lib/forge-qa"
import type { ForgeWorkspaceMetadata } from "@/lib/forge-workspace"

const T = { s1:"var(--s1)", s2:"var(--s2)", s3:"var(--s3)", b1:"var(--b1)", b2:"var(--b2)", t1:"var(--t1)", t2:"var(--t2)", t3:"var(--t3)", acc:"var(--acc)", grn:"var(--grn)", amb:"var(--amb)", red:"var(--red)" }

export function ForgeBuildLogsDrawer({
  projectId,
  initialWorkspace,
  initialGeneratedCode,
  initialQa,
  disabled = false,
}: {
  projectId: number
  initialWorkspace: ForgeWorkspaceMetadata | null
  initialGeneratedCode: ForgeGeneratedCodeArtifactState
  initialQa: ForgeQaArtifactState
  disabled?: boolean
}) {
  const [open, setOpen] = useState(Boolean(initialQa.report?.failureSummary))
  const status = initialQa.report?.status ?? "not_run"

  return (
    <section className="rounded-xl border" style={{ background:T.s1, borderColor:T.b1 }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Terminal size={16} style={{ color:T.acc }} aria-hidden="true" />
          <div>
            <div className="font-syne text-base font-bold">Build / QA Logs</div>
            <div className="font-dm text-xs" style={{ color:T.t2 }}>
              {initialQa.report ? `${initialQa.report.commands.length} checks / ${initialQa.report.repairHistory.length} repairs` : "No QA report yet"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge value={status} tone={status === "passed" ? "good" : status === "failed" ? "bad" : "muted"} />
          <ChevronDown size={16} className={open ? "rotate-180 transition" : "transition"} aria-hidden="true" />
        </div>
      </button>
      {open && (
        <div className="border-t p-4" style={{ borderColor:T.b1 }}>
          <ForgeQaPanel
            projectId={projectId}
            initialWorkspace={initialWorkspace}
            initialGeneratedCode={initialGeneratedCode}
            initialQa={initialQa}
            disabled={disabled}
          />
        </div>
      )}
    </section>
  )
}

function Badge({ value, tone }: { value: string; tone: "good" | "bad" | "muted" }) {
  const color = tone === "good" ? T.grn : tone === "bad" ? T.red : T.t2
  return (
    <span className="inline-flex w-fit rounded px-2 py-0.5 font-dm text-[10px] font-semibold uppercase tracking-[.05em]" style={{ background:T.s2, border:`1px solid ${T.b2}`, color }}>
      {value}
    </span>
  )
}
