"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { CalendarClock, CheckCircle2, CircleDollarSign, Clock, Download, FileText, MailPlus, Plus, Save, Send, Target, Wand2, XCircle } from "lucide-react"
import {
  OUTREACH_ACTIVITY_TYPES,
  OUTREACH_DIRECTIONS,
  PROPOSAL_PACKAGE_TYPES,
  PROSPECT_PRIORITIES,
  PROSPECT_SOURCES,
  PROSPECT_STAGES,
  STAGE_LABELS,
  computeSalesMetrics,
  getFollowUpBucket,
  type OutreachActivityType,
  type OutreachDirection,
  type ProposalPackageType,
  type ProposalStatus,
  type ProspectPriority,
  type ProspectSource,
  type ProspectStage,
} from "@/lib/prospects"
import type { LeadScoreFactor, LeadScoreOutcome } from "@/lib/lead-scoring"

const T = { s1:"var(--s1)",s2:"var(--s2)",s3:"var(--s3)",b1:"var(--b1)",b2:"var(--b2)",t1:"var(--t1)",t2:"var(--t2)",t3:"var(--t3)",acc:"var(--acc)",grn:"var(--grn)",amb:"var(--amb)",red:"var(--red)" }

type DateLike = string | Date | null

interface Prospect {
  id: number
  businessName: string
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  websiteUrl: string | null
  location: string | null
  industry: string | null
  source: ProspectSource
  stage: ProspectStage
  estimatedProjectValue: number
  estimatedMonthlyRetainer: number
  priority: ProspectPriority
  revenueScore: number
  trustScore: number
  conversionScore: number
  seoScore: number
  mobileScore: number
  auditSummary: string | null
  painPoints: string | null
  opportunityNotes: string | null
  objectionNotes: string | null
  nextFollowUpAt: DateLike
  lastContactedAt: DateLike
  discoveryCallAt: DateLike
  proposalSentAt: DateLike
  wonAt: DateLike
  lostAt: DateLike
  lostReason: string | null
  convertedClientId: number | null
  createdAt: DateLike
  updatedAt: DateLike
}

interface OutreachActivity {
  id: number
  prospectId: number
  type: OutreachActivityType
  direction: OutreachDirection
  subject: string | null
  body: string | null
  outcome: string | null
  createdAt: string | Date
  createdBy: string | null
}

interface ProposalTracking {
  id: number
  prospectId: number
  packageType: ProposalPackageType
  quotedAmount: number
  monthlyRetainerAmount: number
  status: ProposalStatus
  sentAt: DateLike
  acceptedAt: DateLike
  rejectedAt: DateLike
  notes: string | null
  createdAt: DateLike
  updatedAt: DateLike
}

interface SalesProposal {
  id: number
  prospectId: number | null
  clientId: number | null
  title: string
  summary: string
  htmlContent: string
  status: ProposalStatus
  generatedBy: "forge" | "manual"
  selectedServices: string | null
  buildPrice: number
  retainerPrice: number
  createdAt: DateLike
  updatedAt: DateLike
  sentAt: DateLike
}

interface LeadScoreSnapshot {
  id: number
  prospectId: number
  score: number
  confidence: string
  probabilityOfClosing: number
  estimatedProjectValue: number
  estimatedRetainerPotential: number
  recommendedNextAction: string
  positiveFactors: LeadScoreFactor[]
  negativeFactors: LeadScoreFactor[]
  neutralFactors: LeadScoreFactor[]
  missingInformation: string[]
  affectedData: Array<{ field: string; value: string | number | boolean | null; note: string }>
  modelVersion: string
  overrideScore: number | null
  overrideReason: string | null
  overrideBy: string | null
  overrideAt: DateLike
  outcome: LeadScoreOutcome | null
  outcomeValue: number | null
  outcomeRetainer: number | null
  outcomeNotes: string | null
  outcomeRecordedAt: DateLike
  createdAt: DateLike
}

type SalesMetrics = ReturnType<typeof computeSalesMetrics>

interface ProspectPipelineProps {
  initialProspects: Prospect[]
  initialActivities: OutreachActivity[]
  initialProposals: ProposalTracking[]
  initialSalesProposals: SalesProposal[]
  initialLeadScores: Record<number, LeadScoreSnapshot>
}

const STAGE_COLOR: Record<ProspectStage, string> = {
  found: "#525252",
  audited: "#60a5fa",
  contacted: "#2563EB",
  replied: "#14b8a6",
  discovery_booked: "#f59e0b",
  proposal_sent: "#8b5cf6",
  follow_up_due: "#fb923c",
  won: "#10b981",
  lost: "#ef4444",
}

export function ProspectPipeline({ initialProspects, initialActivities, initialProposals, initialSalesProposals, initialLeadScores }: ProspectPipelineProps) {
  const router = useRouter()
  const [prospects, setProspects] = useState(initialProspects)
  const [activities, setActivities] = useState(initialActivities)
  const [proposals, setProposals] = useState(initialProposals)
  const [salesProposals, setSalesProposals] = useState(initialSalesProposals)
  const [leadScores, setLeadScores] = useState<Record<number, LeadScoreSnapshot>>(initialLeadScores)
  const [selectedId, setSelectedId] = useState(initialProspects[0]?.id ?? null)
  const [view, setView] = useState<"pipeline" | "followups">("pipeline")
  const [showNew, setShowNew] = useState(initialProspects.length === 0)
  const [dragging, setDragging] = useState<Prospect | null>(null)
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    setProspects(initialProspects)
    setActivities(initialActivities)
    setProposals(initialProposals)
    setSalesProposals(initialSalesProposals)
    setLeadScores(initialLeadScores)
    setSelectedId((current) => current ?? initialProspects[0]?.id ?? null)
  }, [initialProspects, initialActivities, initialProposals, initialSalesProposals, initialLeadScores])

  const selected = prospects.find((prospect) => prospect.id === selectedId) ?? prospects[0] ?? null
  const metrics = useMemo(() => computeSalesMetrics(prospects, activities, proposals), [prospects, activities, proposals])
  const selectedActivities = activities.filter((activity) => activity.prospectId === selected?.id)
  const selectedProposals = proposals.filter((proposal) => proposal.prospectId === selected?.id)
  const selectedSalesProposals = salesProposals.filter((proposal) => proposal.prospectId === selected?.id)
  const selectedLeadScore = selected ? leadScores[selected.id] ?? null : null
  const followUps = useMemo(() => ({
    today: prospects.filter((prospect) => getFollowUpBucket(prospect.nextFollowUpAt) === "today" && !isClosed(prospect)),
    overdue: prospects.filter((prospect) => getFollowUpBucket(prospect.nextFollowUpAt) === "overdue" && !isClosed(prospect)),
    upcoming: prospects.filter((prospect) => getFollowUpBucket(prospect.nextFollowUpAt) === "upcoming" && !isClosed(prospect)).sort(sortByFollowUp),
  }), [prospects])

  async function createProspect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const body = Object.fromEntries(new FormData(form))
    setBusy("create")
    setError("")

    try {
      const json = await api("/api/prospects", { method: "POST", body })
      setProspects((current) => [json.prospect, ...current])
      setSelectedId(json.prospect.id)
      setShowNew(false)
      form.reset()
      router.refresh()
    } catch (err) {
      setError(errorMessage(err, "Unable to create prospect."))
    } finally {
      setBusy("")
    }
  }

  async function updateProspect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return

    const body = Object.fromEntries(new FormData(event.currentTarget))
    await patchProspect(selected.id, body, "details")
  }

  async function moveStage(prospect: Prospect, stage: ProspectStage) {
    let lostReason: string | null = null

    if (stage === "lost" && !prospect.lostReason) {
      lostReason = window.prompt("Lost reason")?.trim() ?? ""
      if (!lostReason) return
    }

    await patchProspect(prospect.id, { action: "moveStage", stage, lostReason }, `stage-${prospect.id}`)
  }

  async function setFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return

    const form = event.currentTarget
    const value = String(new FormData(form).get("nextFollowUpAt") ?? "")
    await patchProspect(selected.id, { action: "setFollowUp", nextFollowUpAt: value ? new Date(value).toISOString() : "" }, "followup")
  }

  async function addActivity(event: FormEvent<HTMLFormElement>, prospectId = selected?.id) {
    event.preventDefault()
    if (!prospectId) return

    const form = event.currentTarget
    const body = Object.fromEntries(new FormData(form))
    setBusy(`activity-${prospectId}`)
    setError("")

    try {
      const json = await api(`/api/prospects/${prospectId}/activities`, { method: "POST", body })
      setActivities((current) => [json.activity, ...current])
      mergeProspect(json.prospect)
      form.reset()
      router.refresh()
    } catch (err) {
      setError(errorMessage(err, "Unable to add activity."))
    } finally {
      setBusy("")
    }
  }

  async function markProposalSent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return

    const form = event.currentTarget
    const body = { action: "markProposalSent", ...Object.fromEntries(new FormData(form)) }
    setBusy("proposal")
    setError("")

    try {
      const json = await api(`/api/prospects/${selected.id}`, { method: "PATCH", body })
      mergeProspect(json.prospect)
      setProposals((current) => [json.proposal, ...current])
      form.reset()
      router.refresh()
    } catch (err) {
      setError(errorMessage(err, "Unable to mark proposal sent."))
    } finally {
      setBusy("")
    }
  }

  async function generateProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return

    const form = event.currentTarget
    const body = { prospectId: selected.id, ...Object.fromEntries(new FormData(form)) }
    setBusy("generate-proposal")
    setError("")

    try {
      const json = await api("/api/proposals", { method: "POST", body })
      setSalesProposals((current) => [json.proposal, ...current])
      form.reset()
      router.refresh()
    } catch (err) {
      setError(errorMessage(err, "Unable to generate proposal."))
    } finally {
      setBusy("")
    }
  }

  async function saveSalesProposal(id: number, body: Record<string, unknown>) {
    setBusy(`sales-proposal-${id}`)
    setError("")

    try {
      const json = await api(`/api/proposals/${id}`, { method: "PATCH", body })
      setSalesProposals((current) => current.map((proposal) => proposal.id === id ? json.proposal : proposal))
      if (body.status === "sent" && selected) {
        mergeProspect({ ...selected, stage: "proposal_sent", proposalSentAt: json.proposal.sentAt, updatedAt: json.proposal.updatedAt })
      }
      router.refresh()
    } catch (err) {
      setError(errorMessage(err, "Unable to save proposal."))
    } finally {
      setBusy("")
    }
  }

  async function markLost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return

    const lostReason = new FormData(event.currentTarget).get("lostReason")
    await patchProspect(selected.id, { action: "markLost", lostReason }, "lost")
  }

  async function refreshLeadScore(prospectId = selected?.id) {
    if (!prospectId) return
    setBusy(`lead-score-${prospectId}`)
    setError("")

    try {
      const json = await api(`/api/prospects/${prospectId}/lead-score`, { method: "POST", body: {} })
      setLeadScores((current) => ({ ...current, [prospectId]: json.snapshot }))
      router.refresh()
    } catch (err) {
      setError(errorMessage(err, "Unable to score lead."))
    } finally {
      setBusy("")
    }
  }

  async function overrideLeadScore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return

    const body = { action: "override", ...Object.fromEntries(new FormData(event.currentTarget)) }
    setBusy("lead-score-override")
    setError("")

    try {
      const json = await api(`/api/prospects/${selected.id}/lead-score`, { method: "PATCH", body })
      setLeadScores((current) => ({ ...current, [selected.id]: json.snapshot }))
      router.refresh()
    } catch (err) {
      setError(errorMessage(err, "Unable to override score."))
    } finally {
      setBusy("")
    }
  }

  async function recordLeadScoreOutcome(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return

    const body = { action: "outcome", ...Object.fromEntries(new FormData(event.currentTarget)) }
    setBusy("lead-score-outcome")
    setError("")

    try {
      const json = await api(`/api/prospects/${selected.id}/lead-score`, { method: "PATCH", body })
      setLeadScores((current) => ({ ...current, [selected.id]: json.snapshot }))
      router.refresh()
    } catch (err) {
      setError(errorMessage(err, "Unable to record outcome."))
    } finally {
      setBusy("")
    }
  }

  async function patchProspect(id: number, body: Record<string, unknown>, busyKey: string) {
    setBusy(busyKey)
    setError("")

    try {
      const json = await api(`/api/prospects/${id}`, { method: "PATCH", body })
      mergeProspect(json.prospect)
      router.refresh()
      return json
    } catch (err) {
      setError(errorMessage(err, "Unable to update prospect."))
      return null
    } finally {
      setBusy("")
    }
  }

  function mergeProspect(prospect: Prospect) {
    setProspects((current) => current.map((item) => item.id === prospect.id ? prospect : item))
  }

  return (
    <div className="mx-auto max-w-[1600px] rounded-[8px] border p-3 sm:p-4 lg:p-5" style={{ background:"rgba(2,6,23,.58)", borderColor:"rgba(56,189,248,.18)", boxShadow:"0 24px 80px rgba(0,0,0,.28)" }}>
      <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="font-syne text-2xl font-extrabold tracking-tight">Prospect Pipeline</h1>
          <p className="mt-1 font-dm text-sm" style={{ color:T.t2 }}>Outbound audits, follow-ups, proposals, retainers, and client conversion.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setView("pipeline")} className="rounded-[8px] border px-3 py-2 font-dm text-sm" style={tabStyle(view === "pipeline")}>Pipeline</button>
          <button onClick={() => setView("followups")} className="rounded-[8px] border px-3 py-2 font-dm text-sm" style={tabStyle(view === "followups")}>Follow-ups</button>
          <button onClick={() => setShowNew((open) => !open)} className="flex items-center gap-1.5 rounded-[8px] px-4 py-2 font-dm text-sm font-medium text-white" style={{ background:T.acc }}>
            <Plus size={15} /> Prospect
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:"rgba(239,68,68,.08)", borderColor:"rgba(239,68,68,.3)", color:T.t1 }}>
          {error}
        </div>
      )}

      <MetricsPanel metrics={metrics} />

      {showNew && (
        <form onSubmit={createProspect} className="mb-5 rounded-[8px] border p-4 sm:p-5" style={{ background:T.s1, borderColor:T.b1 }}>
          <div className="mb-4 flex items-center gap-2">
            <Target size={16} style={{ color:T.acc }} />
            <h2 className="font-syne text-lg font-bold">New Prospect</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="Business" name="businessName" required />
            <Field label="Contact" name="contactName" />
            <Field label="Email" name="contactEmail" type="email" />
            <Field label="Website" name="websiteUrl" type="url" placeholder="https://example.com" />
            <Field label="Location" name="location" />
            <Field label="Industry" name="industry" />
            <Select label="Source" name="source" options={PROSPECT_SOURCES} defaultValue="linkedin" />
            <Select label="Priority" name="priority" options={PROSPECT_PRIORITIES} defaultValue="medium" />
            <Field label="Project value" name="estimatedProjectValue" type="number" min="0" defaultValue="0" />
            <Field label="Monthly retainer" name="estimatedMonthlyRetainer" type="number" min="0" defaultValue="0" />
            <Select label="Stage" name="stage" options={PROSPECT_STAGES} labels={STAGE_LABELS} defaultValue="found" />
            <div className="flex items-end">
              <button disabled={busy === "create"} className="flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 font-dm text-sm font-medium text-white disabled:opacity-60" style={{ background:T.acc }}>
                <Save size={15} /> {busy === "create" ? "Saving..." : "Save Prospect"}
              </button>
            </div>
          </div>
        </form>
      )}

      {view === "followups" ? (
        <FollowUpsView buckets={followUps} onSelect={setSelectedId} onActivity={addActivity} busy={busy} />
      ) : prospects.length === 0 ? (
        <div className="rounded-[8px] border p-6 sm:p-8" style={{ background:T.s1, borderColor:T.b1 }}>
          <Target size={22} className="mb-4 text-acc" />
          <h2 className="font-syne text-xl font-bold">No prospects yet</h2>
          <p className="mt-2 max-w-[560px] font-dm text-sm leading-relaxed" style={{ color:T.t2 }}>
            Add a prospect to start tracking discovery, audits, outreach, proposals, follow-ups, and retainers.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.45fr)_minmax(380px,.75fr)]">
          <KanbanBoard prospects={prospects} selectedId={selected?.id ?? null} dragging={dragging} setDragging={setDragging} onMove={moveStage} onSelect={setSelectedId} />
          <DetailPanel
            prospect={selected}
            activities={selectedActivities}
            proposals={selectedProposals}
            salesProposals={selectedSalesProposals}
            leadScore={selectedLeadScore}
            busy={busy}
            onUpdate={updateProspect}
            onStage={(stage) => selected && moveStage(selected, stage)}
            onFollowUp={setFollowUp}
            onActivity={addActivity}
            onProposal={markProposalSent}
            onGenerateProposal={generateProposal}
            onSaveSalesProposal={saveSalesProposal}
            onRefreshLeadScore={refreshLeadScore}
            onOverrideLeadScore={overrideLeadScore}
            onRecordLeadScoreOutcome={recordLeadScoreOutcome}
            onWon={() => selected && patchProspect(selected.id, { action:"markWon" }, "won")}
            onLost={markLost}
            onConvert={() => selected && patchProspect(selected.id, { action:"convertToClient" }, "convert")}
          />
        </div>
      )}
    </div>
  )
}

function MetricsPanel({ metrics }: { metrics: SalesMetrics }) {
  const cards = [
    ["Outreach", metrics.outreachSentThisWeek, "sent this week", MailPlus, T.acc],
    ["Replies", metrics.repliesThisWeek, "this week", CheckCircle2, T.grn],
    ["Calls", metrics.discoveryCallsBooked, "booked", CalendarClock, T.amb],
    ["Proposals", metrics.proposalsSent, "sent this week", FileText, T.acc],
    ["Won", metrics.dealsWonThisMonth, "this month", CheckCircle2, T.grn],
    ["Lost", metrics.dealsLostThisMonth, "this month", XCircle, T.red],
    ["Pipeline", `GBP ${metrics.pipelineValue.toLocaleString()}`, "project value", CircleDollarSign, T.acc],
    ["MRR", `GBP ${metrics.expectedMonthlyRetainerValue.toLocaleString()}`, "projected", Target, T.grn],
  ] as const

  return (
    <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
      {cards.map(([label, value, sub, Icon, color]) => (
        <div key={label} className="rounded-[8px] border p-4" style={{ background:T.s1, borderColor:T.b1 }}>
          <div className="mb-2 flex items-center justify-between">
            <span className="font-dm text-[11px]" style={{ color:T.t2 }}>{label}</span>
            <Icon size={15} style={{ color }} />
          </div>
          <div className="font-syne text-xl font-extrabold">{value}</div>
          <div className="font-dm text-[11px]" style={{ color:T.t3 }}>{sub}</div>
        </div>
      ))}
    </div>
  )
}

function KanbanBoard({ prospects, selectedId, dragging, setDragging, onMove, onSelect }: {
  prospects: Prospect[]
  selectedId: number | null
  dragging: Prospect | null
  setDragging: (prospect: Prospect | null) => void
  onMove: (prospect: Prospect, stage: ProspectStage) => void
  onSelect: (id: number) => void
}) {
  const [over, setOver] = useState<ProspectStage | null>(null)

  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid min-w-[1320px] grid-cols-9 gap-3">
        {PROSPECT_STAGES.map((stage) => {
          const stageProspects = prospects.filter((prospect) => prospect.stage === stage)

          return (
            <section
              key={stage}
              onDragOver={(event) => { event.preventDefault(); setOver(stage) }}
              onDrop={() => { if (dragging) onMove(dragging, stage); setDragging(null); setOver(null) }}
              className="min-h-[520px] rounded-[8px] border p-3"
              style={{ background:over === stage ? "rgba(37,99,235,.05)" : T.s1, borderColor:over === stage ? "var(--acc-b)" : T.b1 }}
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background:STAGE_COLOR[stage] }} />
                <h2 className="font-dm text-[12px] font-semibold">{STAGE_LABELS[stage]}</h2>
                <span className="ml-auto rounded px-1.5 py-0.5 font-syne text-[11px] font-bold" style={{ background:T.s3, color:T.t2 }}>{stageProspects.length}</span>
              </div>
              <div className="space-y-2">
                {stageProspects.length === 0 && <div className="rounded-lg border border-dashed p-3 font-dm text-xs" style={{ borderColor:T.b1, color:T.t3 }}>Empty</div>}
                {stageProspects.map((prospect) => (
                  <button
                    key={prospect.id}
                    draggable
                    onDragStart={() => setDragging(prospect)}
                    onDragEnd={() => { setDragging(null); setOver(null) }}
                    onClick={() => onSelect(prospect.id)}
                    className="w-full rounded-lg border p-3 text-left transition-colors"
                    style={{ background:selectedId === prospect.id ? T.s3 : T.s2, borderColor:selectedId === prospect.id ? T.b2 : T.b1, opacity:dragging?.id === prospect.id ? .55 : 1 }}
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="font-dm text-[13px] font-semibold leading-snug">{prospect.businessName}</div>
                      <span className="rounded px-1.5 py-0.5 font-dm text-[10px]" style={{ background:priorityBg(prospect.priority), color:priorityColor(prospect.priority) }}>{prospect.priority}</span>
                    </div>
                    <div className="space-y-1 font-dm text-[11px]" style={{ color:T.t2 }}>
                      <div>{prospect.industry ?? "No industry"} / {prospect.location ?? "No location"}</div>
                      <div>{prospect.source} / GBP {prospect.estimatedProjectValue.toLocaleString()} / GBP {prospect.estimatedMonthlyRetainer.toLocaleString()} MRR</div>
                      <div style={{ color:followUpColor(prospect.nextFollowUpAt) }}>{formatDate(prospect.nextFollowUpAt, "No follow-up")}</div>
                      <div>Audit R{prospect.revenueScore} T{prospect.trustScore} C{prospect.conversionScore} S{prospect.seoScore} M{prospect.mobileScore}</div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function DetailPanel({ prospect, activities, proposals, salesProposals, leadScore, busy, onUpdate, onStage, onFollowUp, onActivity, onProposal, onGenerateProposal, onSaveSalesProposal, onRefreshLeadScore, onOverrideLeadScore, onRecordLeadScoreOutcome, onWon, onLost, onConvert }: {
  prospect: Prospect | null
  activities: OutreachActivity[]
  proposals: ProposalTracking[]
  salesProposals: SalesProposal[]
  leadScore: LeadScoreSnapshot | null
  busy: string
  onUpdate: (event: FormEvent<HTMLFormElement>) => void
  onStage: (stage: ProspectStage) => void
  onFollowUp: (event: FormEvent<HTMLFormElement>) => void
  onActivity: (event: FormEvent<HTMLFormElement>) => void
  onProposal: (event: FormEvent<HTMLFormElement>) => void
  onGenerateProposal: (event: FormEvent<HTMLFormElement>) => void
  onSaveSalesProposal: (id: number, body: Record<string, unknown>) => void
  onRefreshLeadScore: () => void
  onOverrideLeadScore: (event: FormEvent<HTMLFormElement>) => void
  onRecordLeadScoreOutcome: (event: FormEvent<HTMLFormElement>) => void
  onWon: () => void
  onLost: (event: FormEvent<HTMLFormElement>) => void
  onConvert: () => void
}) {
  const [stage, setStage] = useState<ProspectStage>(prospect?.stage ?? "found")

  useEffect(() => {
    setStage(prospect?.stage ?? "found")
  }, [prospect?.id, prospect?.stage])

  if (!prospect) {
    return <div className="rounded-[8px] border p-6 font-dm text-sm" style={{ background:T.s1, borderColor:T.b1, color:T.t2 }}>Select a prospect to inspect the revenue audit and activity timeline.</div>
  }

  return (
    <aside className="space-y-3">
      <LeadScorePanel
        score={leadScore}
        busy={busy}
        onRefresh={onRefreshLeadScore}
        onOverride={onOverrideLeadScore}
        onOutcome={onRecordLeadScoreOutcome}
      />

      <div className="rounded-[8px] border p-4 sm:p-5" style={{ background:T.s1, borderColor:T.b1 }}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-syne text-xl font-extrabold">{prospect.businessName}</h2>
            <p className="mt-1 font-dm text-xs" style={{ color:T.t2 }}>{prospect.industry ?? "No industry"} / {prospect.location ?? "No location"}</p>
          </div>
          <span className="rounded px-2 py-1 font-dm text-[10px] font-semibold uppercase tracking-[.06em]" style={{ background:T.s2, border:`1px solid ${T.b2}`, color:STAGE_COLOR[prospect.stage] }}>{STAGE_LABELS[prospect.stage]}</span>
        </div>

        <form onSubmit={onUpdate} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Business" name="businessName" defaultValue={prospect.businessName} required />
            <Field label="Contact" name="contactName" defaultValue={prospect.contactName ?? ""} />
            <Field label="Email" name="contactEmail" type="email" defaultValue={prospect.contactEmail ?? ""} />
            <Field label="Phone" name="contactPhone" defaultValue={prospect.contactPhone ?? ""} />
            <Field label="Website" name="websiteUrl" type="url" defaultValue={prospect.websiteUrl ?? ""} />
            <Field label="Location" name="location" defaultValue={prospect.location ?? ""} />
            <Field label="Industry" name="industry" defaultValue={prospect.industry ?? ""} />
            <Select label="Source" name="source" options={PROSPECT_SOURCES} defaultValue={prospect.source} />
            <Select label="Priority" name="priority" options={PROSPECT_PRIORITIES} defaultValue={prospect.priority} />
            <Field label="Project value" name="estimatedProjectValue" type="number" min="0" defaultValue={String(prospect.estimatedProjectValue)} />
            <Field label="Monthly retainer" name="estimatedMonthlyRetainer" type="number" min="0" defaultValue={String(prospect.estimatedMonthlyRetainer)} />
            <Field label="Discovery call" name="discoveryCallAt" type="datetime-local" defaultValue={dateTimeValue(prospect.discoveryCallAt)} />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Field label="Revenue" name="revenueScore" type="number" min="0" max="10" defaultValue={String(prospect.revenueScore)} />
            <Field label="Trust" name="trustScore" type="number" min="0" max="10" defaultValue={String(prospect.trustScore)} />
            <Field label="Conversion" name="conversionScore" type="number" min="0" max="10" defaultValue={String(prospect.conversionScore)} />
            <Field label="SEO" name="seoScore" type="number" min="0" max="10" defaultValue={String(prospect.seoScore)} />
            <Field label="Mobile" name="mobileScore" type="number" min="0" max="10" defaultValue={String(prospect.mobileScore)} />
          </div>
          <TextArea label="Audit summary" name="auditSummary" defaultValue={prospect.auditSummary ?? ""} />
          <TextArea label="Pain points" name="painPoints" defaultValue={prospect.painPoints ?? ""} />
          <TextArea label="Opportunity notes" name="opportunityNotes" defaultValue={prospect.opportunityNotes ?? ""} />
          <TextArea label="Objection notes" name="objectionNotes" defaultValue={prospect.objectionNotes ?? ""} />
          <button disabled={busy === "details"} className="flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2 font-dm text-sm font-medium text-white disabled:opacity-60" style={{ background:T.acc }}>
            <Save size={15} /> {busy === "details" ? "Saving..." : "Save Details"}
          </button>
        </form>
      </div>

      <div className="rounded-[8px] border p-4 sm:p-5" style={{ background:T.s1, borderColor:T.b1 }}>
        <h3 className="mb-3 font-syne text-[15px] font-bold">Sales Audit Framework</h3>
        <div className="space-y-2">
          <AuditRow label="Revenue" question="Where are they losing money?" score={prospect.revenueScore} detail={prospect.painPoints ?? prospect.auditSummary} />
          <AuditRow label="Trust" question="Why would visitors leave?" score={prospect.trustScore} detail={prospect.objectionNotes ?? prospect.auditSummary} />
          <AuditRow label="Conversion" question="Why are visitors not contacting them?" score={prospect.conversionScore} detail={prospect.opportunityNotes ?? prospect.auditSummary} />
          <AuditRow label="SEO" question="Why are they not being found?" score={prospect.seoScore} detail={prospect.auditSummary} />
          <AuditRow label="Mobile" question="What is broken?" score={prospect.mobileScore} detail={prospect.auditSummary} />
        </div>
      </div>

      <div className="rounded-[8px] border p-4 sm:p-5" style={{ background:T.s1, borderColor:T.b1 }}>
        <h3 className="mb-3 font-syne text-[15px] font-bold">Actions</h3>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <select value={stage} onChange={(event) => setStage(event.target.value as ProspectStage)} className="font-dm text-sm">
            {PROSPECT_STAGES.map((item) => <option key={item} value={item}>{STAGE_LABELS[item]}</option>)}
          </select>
          <button onClick={() => onStage(stage)} disabled={busy.startsWith("stage")} className="rounded-lg px-3 py-2 font-dm text-sm text-white disabled:opacity-60" style={{ background:T.acc }}>Move</button>
        </div>

        <form onSubmit={onFollowUp} className="mt-3 grid grid-cols-[1fr_auto] gap-2">
          <input name="nextFollowUpAt" type="datetime-local" defaultValue={dateTimeValue(prospect.nextFollowUpAt)} />
          <button disabled={busy === "followup"} className="rounded-lg px-3 py-2 font-dm text-sm text-white disabled:opacity-60" style={{ background:T.amb }}>Set</button>
        </form>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={onWon} disabled={busy === "won"} className="rounded-lg px-3 py-2 font-dm text-sm font-medium text-white disabled:opacity-60" style={{ background:T.grn }}>Mark Won</button>
          <button onClick={onConvert} disabled={busy === "convert" || Boolean(prospect.convertedClientId)} className="rounded-lg px-3 py-2 font-dm text-sm font-medium text-white disabled:opacity-60" style={{ background:T.acc }}>
            {prospect.convertedClientId ? "Converted" : "Convert to Client"}
          </button>
        </div>
        <form onSubmit={onLost} className="mt-2 grid grid-cols-[1fr_auto] gap-2">
          <input name="lostReason" placeholder="Lost reason" defaultValue={prospect.lostReason ?? ""} />
          <button disabled={busy === "lost"} className="rounded-lg px-3 py-2 font-dm text-sm text-white disabled:opacity-60" style={{ background:T.red }}>Lost</button>
        </form>
      </div>

      <div className="rounded-[8px] border p-4 sm:p-5" style={{ background:T.s1, borderColor:T.b1 }}>
        <h3 className="mb-3 font-syne text-[15px] font-bold">Add Activity</h3>
        <ActivityForm onSubmit={onActivity} busy={busy === `activity-${prospect.id}`} />
        <div className="mt-5 space-y-3">
          {activities.length === 0 && <div className="font-dm text-sm" style={{ color:T.t2 }}>No outreach logged yet.</div>}
          {activities.map((activity) => (
            <div key={activity.id} className="rounded-lg border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="font-dm text-xs font-semibold">{labelize(activity.type)} / {activity.direction}</div>
                <div className="font-dm text-[11px]" style={{ color:T.t3 }}>{formatDate(activity.createdAt)}</div>
              </div>
              {activity.subject && <div className="font-dm text-sm">{activity.subject}</div>}
              {activity.body && <p className="mt-1 font-dm text-xs leading-relaxed" style={{ color:T.t2 }}>{activity.body}</p>}
              {activity.outcome && <div className="mt-2 font-dm text-[11px]" style={{ color:T.grn }}>{activity.outcome}</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[8px] border p-4 sm:p-5" style={{ background:T.s1, borderColor:T.b1 }}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-syne text-[15px] font-bold">Proposal Generator</h3>
          <span className="rounded px-2 py-1 font-dm text-[10px] uppercase tracking-[.06em]" style={{ background:T.s2, border:`1px solid ${T.b2}`, color:T.t2 }}>Draft first</span>
        </div>
        {prospect.stage === "proposal_sent" && salesProposals.length === 0 && (
          <div className="mb-3 rounded-lg border px-3 py-2 font-dm text-xs" style={{ background:"rgba(245,158,11,.1)", borderColor:"rgba(245,158,11,.35)", color:T.t1 }}>
            This prospect is at proposal stage but has no generated proposal draft yet.
          </div>
        )}
        <form onSubmit={onGenerateProposal} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Field label="Build price" name="buildPrice" type="number" min="0" defaultValue={String(prospect.estimatedProjectValue)} />
          <Field label="Retainer price" name="retainerPrice" type="number" min="0" defaultValue={String(prospect.estimatedMonthlyRetainer)} />
          <div className="sm:col-span-2">
            <TextArea label="Selected services" name="selectedServices" placeholder="Website rebuild, SEO foundations, care plan..." defaultValue="" />
          </div>
          <button disabled={busy === "generate-proposal"} className="flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 font-dm text-sm font-medium text-white disabled:opacity-60 sm:col-span-2" style={{ background:T.acc }}>
            <Wand2 size={15} /> {busy === "generate-proposal" ? "Generating..." : "Generate Draft Proposal"}
          </button>
        </form>
        <div className="mt-4 space-y-4">
          {salesProposals.length === 0 && <div className="font-dm text-sm" style={{ color:T.t2 }}>No generated proposals yet.</div>}
          {salesProposals.map((proposal) => (
            <SalesProposalEditor
              key={proposal.id}
              proposal={proposal}
              busy={busy === `sales-proposal-${proposal.id}`}
              onSave={onSaveSalesProposal}
            />
          ))}
        </div>
      </div>

      <div className="rounded-[8px] border p-4 sm:p-5" style={{ background:T.s1, borderColor:T.b1 }}>
        <h3 className="mb-3 font-syne text-[15px] font-bold">Proposal Tracking</h3>
        <form onSubmit={onProposal} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Select label="Package" name="packageType" options={PROPOSAL_PACKAGE_TYPES} defaultValue="custom" />
          <Field label="Quoted amount" name="quotedAmount" type="number" min="0" defaultValue={String(prospect.estimatedProjectValue)} />
          <Field label="Monthly retainer" name="monthlyRetainerAmount" type="number" min="0" defaultValue={String(prospect.estimatedMonthlyRetainer)} />
          <label className="font-dm text-sm">
            <span className="mb-1 block text-[11px]" style={{ color:T.t2 }}>Sent at</span>
            <input name="sentAt" type="datetime-local" />
          </label>
          <div className="sm:col-span-2">
            <TextArea label="Notes" name="notes" />
          </div>
          <button disabled={busy === "proposal"} className="flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 font-dm text-sm font-medium text-white disabled:opacity-60 sm:col-span-2" style={{ background:T.acc }}>
            <FileText size={15} /> {busy === "proposal" ? "Saving..." : "Mark Proposal Sent"}
          </button>
        </form>
        <div className="mt-4 space-y-2">
          {proposals.length === 0 && <div className="font-dm text-sm" style={{ color:T.t2 }}>No proposals tracked yet.</div>}
          {proposals.map((proposal) => (
            <div key={proposal.id} className="rounded-lg border p-3 font-dm text-xs" style={{ background:T.s2, borderColor:T.b1 }}>
              <div className="flex justify-between gap-2">
                <span>{proposal.packageType} / {proposal.status}</span>
                <span style={{ color:T.t2 }}>GBP {proposal.quotedAmount.toLocaleString()} / GBP {proposal.monthlyRetainerAmount.toLocaleString()} MRR</span>
              </div>
              <div className="mt-1" style={{ color:T.t3 }}>Sent {formatDate(proposal.sentAt, "not sent")}</div>
              {proposal.notes && <p className="mt-2 leading-relaxed" style={{ color:T.t2 }}>{proposal.notes}</p>}
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}

function LeadScorePanel({ score, busy, onRefresh, onOverride, onOutcome }: {
  score: LeadScoreSnapshot | null
  busy: string
  onRefresh: () => void
  onOverride: (event: FormEvent<HTMLFormElement>) => void
  onOutcome: (event: FormEvent<HTMLFormElement>) => void
}) {
  const effectiveScore = score?.overrideScore ?? score?.score ?? null
  const positive = score?.positiveFactors ?? []
  const negative = score?.negativeFactors ?? []
  const missing = score?.missingInformation ?? []

  return (
    <div className="rounded-[8px] border p-4 sm:p-5" style={{ background:T.s1, borderColor:T.b1 }}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-syne text-[15px] font-bold">Lead Score</h3>
          <p className="mt-1 font-dm text-xs leading-relaxed" style={{ color:T.t2 }}>Explainable scoring from pipeline data only. No protected personal characteristics are used.</p>
        </div>
        <button type="button" onClick={onRefresh} disabled={busy.startsWith("lead-score")} className="rounded-lg px-3 py-2 font-dm text-xs font-medium text-white disabled:opacity-60" style={{ background:T.acc }}>
          {busy.startsWith("lead-score-") ? "Scoring..." : score ? "Rescore" : "Score"}
        </button>
      </div>

      {!score ? (
        <div className="rounded-lg border border-dashed p-3 font-dm text-sm" style={{ borderColor:T.b1, color:T.t2 }}>No score snapshot yet.</div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <ScoreTile label="Score" value={effectiveScore === null ? "?" : `${effectiveScore}/100`} tone={scoreTone(effectiveScore ?? 0)} />
            <ScoreTile label="Confidence" value={score.confidence} tone={score.confidence === "high" ? T.grn : score.confidence === "medium" ? T.amb : T.red} />
            <ScoreTile label="Close Prob." value={`${score.probabilityOfClosing}%`} tone={scoreTone(score.probabilityOfClosing)} />
          </div>
          {score.overrideScore !== null && (
            <div className="rounded-lg border px-3 py-2 font-dm text-xs leading-relaxed" style={{ background:"rgba(245,158,11,.08)", borderColor:"rgba(245,158,11,.28)", color:T.t1 }}>
              Human override: {score.overrideScore}/100 by {score.overrideBy ?? "admin"} - {score.overrideReason}
            </div>
          )}
          <div className="rounded-lg border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
            <div className="font-dm text-[11px] uppercase tracking-[.06em]" style={{ color:T.t3 }}>Recommended next action</div>
            <p className="mt-1 font-dm text-sm leading-relaxed" style={{ color:T.t1 }}>{score.recommendedNextAction}</p>
            <div className="mt-2 font-dm text-[11px]" style={{ color:T.t2 }}>
              Est. value GBP {score.estimatedProjectValue.toLocaleString()} / retainer GBP {score.estimatedRetainerPotential.toLocaleString()}
            </div>
          </div>
          <FactorList title="Positive factors" factors={positive} tone={T.grn} />
          <FactorList title="Negative factors" factors={negative} tone={T.red} />
          {missing.length > 0 && (
            <div>
              <div className="mb-1 font-dm text-[11px] uppercase tracking-[.06em]" style={{ color:T.t3 }}>Missing information</div>
              <div className="flex flex-wrap gap-1.5">
                {missing.map((item) => <span key={item} className="rounded border px-2 py-1 font-dm text-[11px]" style={{ borderColor:T.b1, color:T.t2 }}>{item}</span>)}
              </div>
            </div>
          )}
          <form onSubmit={onOverride} className="grid grid-cols-[88px_1fr] gap-2">
            <Field label="Override" name="overrideScore" type="number" min="0" max="100" defaultValue={String(effectiveScore ?? score.score)} />
            <Field label="Reason" name="reason" placeholder="Why human judgment differs" />
            <button disabled={busy === "lead-score-override"} className="col-span-2 rounded-lg px-3 py-2 font-dm text-xs font-medium text-white disabled:opacity-60" style={{ background:T.amb }}>Save Override</button>
          </form>
          <form onSubmit={onOutcome} className="grid grid-cols-2 gap-2">
            <Select label="Outcome" name="outcome" options={["won", "lost", "no_decision", "disqualified"]} defaultValue={score.outcome ?? "no_decision"} />
            <Field label="Outcome value" name="outcomeValue" type="number" min="0" defaultValue={String(score.outcomeValue ?? score.estimatedProjectValue)} />
            <Field label="Outcome retainer" name="outcomeRetainer" type="number" min="0" defaultValue={String(score.outcomeRetainer ?? score.estimatedRetainerPotential)} />
            <Field label="Notes" name="notes" defaultValue={score.outcomeNotes ?? ""} />
            <button disabled={busy === "lead-score-outcome"} className="col-span-2 rounded-lg px-3 py-2 font-dm text-xs font-medium text-white disabled:opacity-60" style={{ background:T.grn }}>Record Outcome</button>
          </form>
          <div className="font-dm text-[10px] leading-relaxed" style={{ color:T.t3 }}>
            Snapshot {score.id} / {score.modelVersion} / created {formatDate(score.createdAt)}
          </div>
        </div>
      )}
    </div>
  )
}

function ScoreTile({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg border p-2" style={{ background:T.s2, borderColor:T.b1 }}>
      <div className="font-dm text-[10px]" style={{ color:T.t3 }}>{label}</div>
      <div className="mt-1 font-syne text-lg font-extrabold" style={{ color:tone }}>{value}</div>
    </div>
  )
}

function FactorList({ title, factors, tone }: { title: string; factors: LeadScoreFactor[]; tone: string }) {
  if (!factors.length) return null

  return (
    <div>
      <div className="mb-1 font-dm text-[11px] uppercase tracking-[.06em]" style={{ color:T.t3 }}>{title}</div>
      <div className="space-y-1.5">
        {factors.slice(0, 4).map((factor) => (
          <div key={`${factor.category}-${factor.label}`} className="rounded border px-2 py-1.5 font-dm text-xs leading-relaxed" style={{ borderColor:T.b1, background:T.s2 }}>
            <div className="flex justify-between gap-2">
              <span>{factor.label}</span>
              <span style={{ color:tone }}>{factor.points > 0 ? "+" : ""}{factor.points}</span>
            </div>
            <div className="mt-0.5" style={{ color:T.t3 }}>{factor.evidence[0]}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SalesProposalEditor({ proposal, busy, onSave }: {
  proposal: SalesProposal
  busy: boolean
  onSave: (id: number, body: Record<string, unknown>) => void
}) {
  const [title, setTitle] = useState(proposal.title)
  const [summary, setSummary] = useState(proposal.summary)
  const [htmlContent, setHtmlContent] = useState(proposal.htmlContent)
  const [previewOpen, setPreviewOpen] = useState(true)

  useEffect(() => {
    setTitle(proposal.title)
    setSummary(proposal.summary)
    setHtmlContent(proposal.htmlContent)
  }, [proposal.id, proposal.title, proposal.summary, proposal.htmlContent])

  const payload = { title, summary, htmlContent }

  return (
    <div className="rounded-lg border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-dm text-xs font-semibold">{proposal.status} / {proposal.generatedBy}</div>
          <div className="mt-1 font-dm text-[11px]" style={{ color:T.t3 }}>Updated {formatDate(proposal.updatedAt)}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/proposals/${proposal.id}`} className="flex items-center gap-1 rounded-lg border px-3 py-2 font-dm text-xs" style={{ borderColor:T.b2, color:T.t1 }}>
            <Download size={13} /> HTML
          </a>
          <button type="button" onClick={() => setPreviewOpen((open) => !open)} className="rounded-lg border px-3 py-2 font-dm text-xs" style={{ borderColor:T.b2 }}>
            {previewOpen ? "Hide Preview" : "Preview"}
          </button>
        </div>
      </div>
      <div className="grid gap-2">
        <Field label="Title" name={`title-${proposal.id}`} value={title} onChange={(event) => setTitle(event.target.value)} />
        <TextArea label="Summary" name={`summary-${proposal.id}`} value={summary} onChange={(event) => setSummary(event.target.value)} />
        <label className="font-dm text-sm">
          <span className="mb-1 block text-[11px]" style={{ color:T.t2 }}>Editable HTML</span>
          <textarea
            value={htmlContent}
            onChange={(event) => setHtmlContent(event.target.value)}
            rows={10}
            className="font-mono text-xs"
          />
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onSave(proposal.id, { ...payload, status: "draft" })}
            className="flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 font-dm text-sm font-medium text-white disabled:opacity-60"
            style={{ background:T.acc }}
          >
            <Save size={15} /> {busy ? "Saving..." : "Save Draft"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onSave(proposal.id, { ...payload, status: "sent" })}
            className="flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 font-dm text-sm font-medium text-white disabled:opacity-60"
            style={{ background:T.grn }}
          >
            <Send size={15} /> Mark Sent
          </button>
        </div>
        {previewOpen && (
          <iframe
            title={`${proposal.title} preview`}
            srcDoc={htmlContent}
            sandbox=""
            className="h-[420px] w-full rounded-lg border bg-white"
            style={{ borderColor:T.b1 }}
          />
        )}
      </div>
    </div>
  )
}

function FollowUpsView({ buckets, onSelect, onActivity, busy }: {
  buckets: { today: Prospect[]; overdue: Prospect[]; upcoming: Prospect[] }
  onSelect: (id: number) => void
  onActivity: (event: FormEvent<HTMLFormElement>, prospectId: number) => void
  busy: string
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {([
        ["Overdue", buckets.overdue, T.red],
        ["Due Today", buckets.today, T.amb],
        ["Upcoming", buckets.upcoming, T.acc],
      ] as const).map(([label, rows, color]) => (
        <section key={label} className="rounded-[8px] border p-4" style={{ background:T.s1, borderColor:T.b1 }}>
          <div className="mb-3 flex items-center gap-2">
            <Clock size={15} style={{ color }} />
            <h2 className="font-syne text-lg font-bold">{label}</h2>
            <span className="ml-auto rounded px-2 py-0.5 font-syne text-xs font-bold" style={{ background:T.s3 }}>{rows.length}</span>
          </div>
          <div className="space-y-3">
            {rows.length === 0 && <div className="rounded-lg border border-dashed p-4 font-dm text-sm" style={{ borderColor:T.b1, color:T.t2 }}>No follow-ups here.</div>}
            {rows.map((prospect) => (
              <div key={prospect.id} className="rounded-lg border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
                <button onClick={() => onSelect(prospect.id)} className="w-full text-left">
                  <div className="font-dm text-sm font-semibold">{prospect.businessName}</div>
                  <div className="mt-1 font-dm text-xs" style={{ color }}>{formatDate(prospect.nextFollowUpAt)}</div>
                  <div className="font-dm text-[11px]" style={{ color:T.t2 }}>{prospect.contactName ?? "No contact"} / {prospect.source}</div>
                </button>
                <form onSubmit={(event) => onActivity(event, prospect.id)} className="mt-3 grid gap-2">
                  <input type="hidden" name="type" value="follow_up" />
                  <input type="hidden" name="direction" value="outbound" />
                  <input name="subject" placeholder="Quick follow-up note" />
                  <button disabled={busy === `activity-${prospect.id}`} className="rounded-lg px-3 py-2 font-dm text-xs font-medium text-white disabled:opacity-60" style={{ background:T.acc }}>Log follow-up</button>
                </form>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function ActivityForm({ onSubmit, busy }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <Select label="Type" name="type" options={OUTREACH_ACTIVITY_TYPES} defaultValue="email" />
      <Select label="Direction" name="direction" options={OUTREACH_DIRECTIONS} defaultValue="outbound" />
      <div className="sm:col-span-2">
        <Field label="Subject" name="subject" />
      </div>
      <div className="sm:col-span-2">
        <TextArea label="Body" name="body" />
      </div>
      <div className="sm:col-span-2">
        <Field label="Outcome" name="outcome" />
      </div>
      <button disabled={busy} className="flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 font-dm text-sm font-medium text-white disabled:opacity-60 sm:col-span-2" style={{ background:T.acc }}>
        <MailPlus size={15} /> {busy ? "Saving..." : "Add Activity"}
      </button>
    </form>
  )
}

function Field({ label, name, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  return (
    <label className="font-dm text-sm">
      <span className="mb-1 block text-[11px]" style={{ color:T.t2 }}>{label}</span>
      <input name={name} {...props} />
    </label>
  )
}

function TextArea({ label, name, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; name: string }) {
  return (
    <label className="font-dm text-sm">
      <span className="mb-1 block text-[11px]" style={{ color:T.t2 }}>{label}</span>
      <textarea name={name} rows={3} {...props} />
    </label>
  )
}

function Select<TValue extends string>({ label, name, options, labels, defaultValue }: { label: string; name: string; options: readonly TValue[]; labels?: Partial<Record<TValue, string>>; defaultValue?: TValue }) {
  return (
    <label className="font-dm text-sm">
      <span className="mb-1 block text-[11px]" style={{ color:T.t2 }}>{label}</span>
      <select name={name} defaultValue={defaultValue}>
        {options.map((option) => <option key={option} value={option}>{labels?.[option] ?? labelize(option)}</option>)}
      </select>
    </label>
  )
}

function AuditRow({ label, question, score, detail }: { label: string; question: string; score: number; detail?: string | null }) {
  return (
    <div className="rounded-lg border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="font-dm text-xs font-semibold">{label}</div>
        <div className="font-syne text-sm font-bold" style={{ color:score >= 7 ? T.grn : score >= 4 ? T.amb : T.red }}>{score}/10</div>
      </div>
      <div className="font-dm text-[11px]" style={{ color:T.t2 }}>{question}</div>
      <p className="mt-2 font-dm text-xs leading-relaxed" style={{ color:T.t2 }}>{detail || "No notes yet."}</p>
    </div>
  )
}

async function api(url: string, { method, body }: { method: string; body?: Record<string, unknown> }) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await response.json().catch(() => ({}))

  if (!response.ok || json.ok === false) {
    throw new Error(json.error || "Request failed.")
  }

  return json
}

function tabStyle(active: boolean) {
  return {
    background: active ? T.s2 : "transparent",
    borderColor: active ? T.b2 : T.b1,
    color: active ? T.t1 : T.t2,
  }
}

function isClosed(prospect: Prospect) {
  return prospect.stage === "won" || prospect.stage === "lost"
}

function sortByFollowUp(a: Prospect, b: Prospect) {
  return dateMs(a.nextFollowUpAt) - dateMs(b.nextFollowUpAt)
}

function dateMs(value: DateLike) {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : Number.MAX_SAFE_INTEGER
}

function formatDate(value: DateLike, fallback = "No date") {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toLocaleString("en-GB", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })
}

function dateTimeValue(value: DateLike) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60 * 1000)
  return local.toISOString().slice(0, 16)
}

function followUpColor(value: DateLike) {
  const bucket = getFollowUpBucket(value)
  if (bucket === "overdue") return T.red
  if (bucket === "today") return T.amb
  if (bucket === "upcoming") return T.grn
  return T.t3
}

function scoreTone(score: number) {
  if (score >= 75) return T.grn
  if (score >= 50) return T.amb
  return T.red
}

function priorityColor(priority: ProspectPriority) {
  if (priority === "high") return T.red
  if (priority === "low") return T.grn
  return T.amb
}

function priorityBg(priority: ProspectPriority) {
  if (priority === "high") return "rgba(239,68,68,.1)"
  if (priority === "low") return "rgba(16,185,129,.1)"
  return "rgba(245,158,11,.1)"
}

function labelize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}
