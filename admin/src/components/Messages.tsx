"use client"

import { useState } from "react"
import { ChevronDown, Inbox } from "lucide-react"

const T = { s1:"var(--s1)", s2:"var(--s2)", b1:"var(--b1)", b2:"var(--b2)", t1:"var(--t1)", t2:"var(--t2)", t3:"var(--t3)", acc:"var(--acc)", grn:"var(--grn)", amb:"var(--amb)", red:"var(--red)" }

interface Lead {
  id: number
  name: string
  email: string
  business: string | null
  websiteUrl: string | null
  businessType: string | null
  projectType: string | null
  budget: string | null
  launchTimeframe: string | null
  mainGoal: string | null
  needs: string | null
  carePlanInterest: string | null
  preferredContactMethod: string | null
  leadQuality: string
  emailDeliveryStatus: string
  emailFailureReason: string | null
  status: string
  brief: string
  createdAt: Date
}

const QUALITY_STYLE: Record<string, string> = {
  high: "var(--grn)",
  medium: "var(--amb)",
  low: "var(--t3)",
}

export function Messages({ leads }: { leads: Lead[] }) {
  const [open, setOpen] = useState<number | null>(leads[0]?.id ?? null)

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-syne text-2xl font-extrabold tracking-tight">Leads</h1>
        <p className="mt-1 font-dm text-sm" style={{ color:T.t2 }}>Quote requests from the public site.</p>
      </div>

      {leads.length === 0 ? (
        <div className="rounded-2xl border p-8" style={{ background:T.s1, borderColor:T.b1 }}>
          <Inbox size={22} className="mb-4 text-acc" aria-hidden="true" />
          <h2 className="font-syne text-xl font-bold">No quote leads yet</h2>
          <p className="mt-2 max-w-[560px] font-dm text-sm leading-relaxed" style={{ color:T.t2 }}>
            New quote requests will appear here with project type, budget, timeframe, lead quality, and safe detail fields for review.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {leads.map((lead) => (
            <article key={lead.id} className="rounded-2xl border" style={{ background:T.s1, borderColor:T.b1 }}>
              <button
                onClick={() => setOpen(open === lead.id ? null : lead.id)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left"
              >
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-syne text-lg font-bold">{lead.business || lead.name}</h2>
                    <span className="rounded px-2 py-0.5 font-dm text-[10px] font-semibold uppercase tracking-[.06em]" style={{ background:T.s2, color:QUALITY_STYLE[lead.leadQuality] ?? T.t2, border:`1px solid ${T.b2}` }}>
                      {lead.leadQuality} intent
                    </span>
                    <span className="rounded px-2 py-0.5 font-dm text-[10px] font-semibold uppercase tracking-[.06em]" style={{ background:T.s2, color:T.t2, border:`1px solid ${T.b2}` }}>
                      {lead.status}
                    </span>
                    <span className="rounded px-2 py-0.5 font-dm text-[10px] font-semibold uppercase tracking-[.06em]" style={{ background:T.s2, color:lead.emailDeliveryStatus === "failed" ? T.red : lead.emailDeliveryStatus === "sent" ? T.grn : T.amb, border:`1px solid ${T.b2}` }}>
                      email {lead.emailDeliveryStatus}
                    </span>
                  </div>
                  <div className="mt-1 font-dm text-xs" style={{ color:T.t2 }}>
                    {lead.projectType ?? "No project type"} · {lead.budget ?? "No budget"} · {lead.launchTimeframe ?? "No timeframe"} · {new Date(lead.createdAt).toLocaleDateString("en-GB")}
                  </div>
                </div>
                <ChevronDown size={16} className="shrink-0 text-t2" style={{ transform: open === lead.id ? "rotate(180deg)" : "none" }} aria-hidden="true" />
              </button>

              {open === lead.id && (
                <div className="grid gap-4 border-t p-5 md:grid-cols-[0.9fr_1.1fr]" style={{ borderColor:T.b1 }}>
                  <div className="space-y-3 font-dm text-sm">
                    {[
                      ["Contact", `${lead.name} · ${lead.email}`],
                      ["Business type", lead.businessType ?? "Not provided"],
                      ["Website", lead.websiteUrl ?? "Not provided"],
                      ["Care plan", lead.carePlanInterest ?? "Not provided"],
                      ["Preferred contact", lead.preferredContactMethod ?? "Not provided"],
                      ["Required features", lead.needs ?? "Not provided"],
                      ["Email delivery", lead.emailDeliveryStatus === "failed" ? `Failed (${lead.emailFailureReason ?? "delivery"})` : lead.emailDeliveryStatus],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <div className="text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>{label}</div>
                        <div className="mt-0.5" style={{ color:T.t1 }}>{value}</div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="mb-2 font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Goal</div>
                    <p className="mb-5 font-dm text-sm leading-relaxed" style={{ color:T.t2 }}>{lead.mainGoal ?? "Not provided"}</p>
                    <div className="mb-2 font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Brief</div>
                    <p className="font-dm text-sm leading-relaxed" style={{ color:T.t2 }}>{lead.brief}</p>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
