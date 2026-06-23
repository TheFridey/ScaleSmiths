"use client"

import { useMemo, useState } from "react"
import { FileText } from "lucide-react"
import type { ForgeArtifactType } from "@/lib/forge"

const T = { s1:"var(--s1)", s2:"var(--s2)", s3:"var(--s3)", b1:"var(--b1)", b2:"var(--b2)", t1:"var(--t1)", t2:"var(--t2)", t3:"var(--t3)", acc:"var(--acc)", grn:"var(--grn)", amb:"var(--amb)", red:"var(--red)" }

interface ForgeArtifactRow {
  id: number
  type: ForgeArtifactType
  title: string
  content: string | null
  createdAt: Date | string
}

const TABS = [
  { key: "research", label: "Research", types: ["research_report"] },
  { key: "sitemap", label: "Sitemap", types: ["sitemap"] },
  { key: "copy", label: "Copy", types: ["copy_doc"] },
  { key: "design", label: "Design", types: ["design_direction", "component_spec"] },
  { key: "code", label: "Code", types: ["generated_code"] },
  { key: "qa", label: "QA", types: ["visual_critique", "qa_report", "seo_pack", "visual_qa"] },
  { key: "proposal", label: "Proposal", types: ["proposal"] },
] as const

export function ForgeArtifactTabs({ artifacts }: { artifacts: ForgeArtifactRow[] }) {
  const [active, setActive] = useState<(typeof TABS)[number]["key"]>("research")
  const tab = TABS.find((item) => item.key === active) ?? TABS[0]
  const rows = useMemo(
    () => artifacts.filter((artifact) => (tab.types as readonly string[]).includes(artifact.type)),
    [artifacts, tab.types],
  )

  return (
    <section className="rounded-xl border p-4" style={{ background:T.s1, borderColor:T.b1 }}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText size={16} style={{ color:T.acc }} aria-hidden="true" />
          <h2 className="font-syne text-lg font-bold">Artifacts</h2>
        </div>
        <div className="flex max-w-full overflow-x-auto rounded-lg border p-1" style={{ background:T.s2, borderColor:T.b1 }}>
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActive(item.key)}
              className="whitespace-nowrap rounded-md px-3 py-2 font-dm text-xs font-semibold"
              style={{
                background: active === item.key ? T.s1 : "transparent",
                color: active === item.key ? T.t1 : T.t2,
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4" style={{ background:T.s2, borderColor:T.b2 }}>
          <p className="font-dm text-sm" style={{ color:T.t2 }}>No {tab.label.toLowerCase()} artifact has been generated yet.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {rows.map((row) => (
            <article key={row.id} className="rounded-lg border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-dm text-sm font-semibold" style={{ color:T.t1 }}>{row.title}</div>
                <span className="font-dm text-[11px]" style={{ color:T.t3 }}>{formatDate(row.createdAt)}</span>
              </div>
              <div className="mt-1 font-dm text-[11px] uppercase tracking-[.06em]" style={{ color:T.t3 }}>{labelize(row.type)}</div>
              {row.content && (
                <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded border p-3 font-mono text-[11px] leading-relaxed" style={{ background:T.s3, borderColor:T.b1, color:T.t2 }}>
                  {row.content}
                </pre>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "No date"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "No date"
  return date.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })
}

function labelize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}
