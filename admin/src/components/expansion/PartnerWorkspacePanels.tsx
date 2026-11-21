"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { GuidanceList, type GuidanceItem } from "@/components/empower/GuidanceCard"
import "@/components/empower/guidance.css"

type Status = { label: string; meaning: string; tone: string }
const MEETING_TYPES: Record<string, string> = { joint_sales: "Joint sales meeting", technical_scoping: "Technical scoping", bespoke_discovery: "Bespoke discovery", commercial_assistance: "Commercial assistance", proposal_review: "Proposal review", training: "Training", escalation: "Escalation" }
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : null)
export const StatusPill = ({ s }: { s: Status }) => <span className="gd-status" data-tone={s.tone} title={s.meaning}>{s.label}</span>

/** Fetches a workspace view; shows a skeleton, then the data, or a recoverable error. */
function useWorkspace<T>(query: string) {
  const [data, setData] = useState<T | null>(null), [error, setError] = useState(""), [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const c = new AbortController(); setError("")
    fetch(`/api/partner/workspace?${query}`, { cache: "no-store", signal: c.signal })
      .then(async (r) => { const b = await r.json(); if (!r.ok) throw new Error(b.error || "This could not be loaded."); setData(b) })
      .catch((e: Error) => { if (e.name !== "AbortError") setError(e.message) })
    return () => c.abort()
  }, [query, attempt])
  return { data, error, retry: () => setAttempt((n) => n + 1) }
}
const Loading = () => <div className="gd-skeleton" aria-hidden="true"><span /><span /></div>
const Failed = ({ error, retry }: { error: string; retry: () => void }) => <div className="gd-error" role="alert"><p>{error}</p><button type="button" className="gd-button gd-button-quiet" onClick={retry}>Try again</button></div>

type Today = {
  opportunities: { id: string; businessName: string; status: Status; statusKey: string; followUp: string | null }[]
  meetings: { id: string; type: string; businessName: string | null; status: Status; statusKey: string; confirmedStart: string | null; proposedStart: string | null }[]
  continueLearning: { courseTitle: string; lessonTitle: string; href: string }[]
  recentGuidance: GuidanceItem[]
  available: { answers: boolean; resources: boolean; academy: boolean }
}

/** Partner overview: real records only. Every action goes somewhere that exists. */
export function PartnerToday({ onOpenOpportunity, onTab }: { onOpenOpportunity: (id: string) => void; onTab: (tab: string) => void }) {
  const { data, error, retry } = useWorkspace<Today>("view=today")
  return <section className="gd-panel" aria-labelledby="today-heading">
    <p className="gd-overline">Today</p><h2 id="today-heading">Your workspace</h2>
    <nav className="gd-actions" aria-label="Quick actions">
      <button type="button" className="gd-action" onClick={() => onTab("pipeline")}>Register a prospect</button>
      <Link className="gd-action" href="/partner/guidance">Find an answer</Link>
      <button type="button" className="gd-action" onClick={() => onTab("meetings")}>Prepare for a meeting</button>
      <button type="button" className="gd-action" onClick={() => onTab("meetings")}>Request founder help</button>
      <button type="button" className="gd-action" onClick={() => onTab("finance")}>View commission status</button>
    </nav>
    {error ? <Failed error={error} retry={retry} /> : !data ? <Loading /> : <div className="gd-grid">
      <div>
        <h3 className="gd-sub">Open prospects</h3>
        {data.opportunities.length ? <ul className="gd-rows">{data.opportunities.map((o) => <li className="gd-row" key={o.id}>
          <div><strong>{o.businessName}</strong><p>{o.status.meaning}</p></div>
          <div className="gd-actions"><StatusPill s={o.status} /><button type="button" className="gd-action" onClick={() => onOpenOpportunity(o.id)} aria-label={`Open ${o.businessName}`}>Open</button></div>
        </li>)}</ul> : <div className="gd-empty"><p>No open prospects yet.</p><button type="button" className="gd-action" onClick={() => onTab("pipeline")}>Register your first business</button></div>}
      </div>
      <div>
        <h3 className="gd-sub">Meetings and requests</h3>
        {data.meetings.length ? <ul className="gd-rows">{data.meetings.map((m) => <li className="gd-row" key={m.id}>
          <div><strong>{MEETING_TYPES[m.type] ?? m.type}{m.businessName ? ` · ${m.businessName}` : ""}</strong><p>{m.statusKey === "confirmed" ? `Booked for ${when(m.confirmedStart)}` : m.status.meaning}</p></div>
          <StatusPill s={m.status} />
        </li>)}</ul> : <div className="gd-empty"><p>No meetings or open requests.</p></div>}
        {data.continueLearning.length > 0 && <><h3 className="gd-sub">Continue learning</h3><ul className="gd-rows">{data.continueLearning.map((c) => <li className="gd-row" key={c.href}><div><strong>{c.lessonTitle}</strong><p>{c.courseTitle}</p></div><Link className="gd-link" href={c.href}>Continue</Link></li>)}</ul></>}
      </div>
      {data.recentGuidance.length > 0 && <div style={{ gridColumn: "1 / -1" }}><h3 className="gd-sub">Recently approved guidance</h3><GuidanceList items={data.recentGuidance} empty={null} /></div>}
    </div>}
  </section>
}

type OppGuidance = {
  opportunity: { id: string; businessName: string; status: Status; statusKey: string }
  reasons: { id: string; reason: string }[]; escalation: string | null; discoveryGaps: { field: string; prompt: string }[]
  guidance: GuidanceItem[]
  meetings: { id: string; type: string; status: Status; statusKey: string; confirmedStart: string | null }[]
}

/** Approved guidance for the open prospect, chosen deterministically from what the partner recorded. */
export function ProspectGuidance({ opportunityId, onRequestHelp }: { opportunityId: string; onRequestHelp: () => void }) {
  const { data, error, retry } = useWorkspace<OppGuidance>(`opportunity=${encodeURIComponent(opportunityId)}`)
  return <section className="gd-panel" aria-labelledby={`pg-${opportunityId}`}>
    <p className="gd-overline">Guidance for this prospect</p>
    <h2 id={`pg-${opportunityId}`}>{data ? data.opportunity.businessName : "Loading guidance"}</h2>
    {error ? <Failed error={error} retry={retry} /> : !data ? <Loading /> : <>
      <p><StatusPill s={data.opportunity.status} /> <span className="gd-muted">{data.opportunity.status.meaning}</span></p>
      {data.reasons.length > 0 && <><h3 className="gd-sub">Why this guidance</h3><ul className="gd-reasons">{data.reasons.map((r) => <li key={r.id}>{r.reason}</li>)}</ul></>}
      {data.discoveryGaps.length > 0 && <><h3 className="gd-sub">Questions to cover next</h3><ul className="gd-gaps">{data.discoveryGaps.map((g) => <li key={g.field}>{g.prompt}</li>)}</ul></>}
      <h3 className="gd-sub">Approved material</h3>
      <GuidanceList items={data.guidance} empty={<p>No approved material matches this prospect yet. Do not improvise: ask ScaleSmiths.</p>} />
      {data.meetings.length > 0 && <><h3 className="gd-sub">Meetings for this prospect</h3><ul className="gd-rows">{data.meetings.map((m) => <li className="gd-row" key={m.id}><strong>{MEETING_TYPES[m.type] ?? m.type}</strong><StatusPill s={m.status} /></li>)}</ul></>}
      <div className="gd-actions"><button type="button" className="gd-button" onClick={onRequestHelp}>{data.escalation ? `Request ${MEETING_TYPES[data.escalation]?.toLowerCase() ?? "help"}` : "Request founder help"}</button></div>
    </>}
  </section>
}

type Prep = {
  meeting: { id: string; type: string; status: Status; statusKey: string; purpose: string; confirmedStart: string | null; proposedStart: string | null; timeZone: string; founderNote: string | null }
  opportunity: { id: string; businessName: string; status: Status; recorded: { field: string; value: string }[]; gaps: { field: string; prompt: string }[] } | null
  reasons: { id: string; reason: string }[]; guidance: GuidanceItem[]
}
const FIELD = (k: string) => k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase())

/** Preparation for one of the partner's meetings. A request is never presented as a booking. */
export function MeetingPrep({ meetingId }: { meetingId: string }) {
  const { data, error, retry } = useWorkspace<Prep>(`meeting=${encodeURIComponent(meetingId)}`)
  if (error) return <Failed error={error} retry={retry} />
  if (!data) return <Loading />
  const m = data.meeting
  return <section className="gd-prep" role="region" aria-label="Meeting preparation">
    <p><StatusPill s={m.status} /> <span className="gd-muted">{m.statusKey === "confirmed" ? `Booked for ${when(m.confirmedStart)} (${m.timeZone})` : m.statusKey === "alternative_proposed" ? `ScaleSmiths proposed ${when(m.proposedStart)}` : m.status.meaning}</span></p>
    {data.opportunity ? <>
      <h3 className="gd-sub">{data.opportunity.businessName}: what you have recorded</h3>
      {data.opportunity.recorded.length ? <dl className="gd-recorded">{data.opportunity.recorded.map((r) => <div key={r.field}><dt>{FIELD(r.field)}</dt><dd>{r.value}</dd></div>)}</dl> : <p className="gd-muted">No discovery recorded yet.</p>}
      {data.opportunity.gaps.length > 0 && <><h3 className="gd-sub">Topics to cover</h3><ul className="gd-gaps">{data.opportunity.gaps.map((g) => <li key={g.field}>{g.prompt}</li>)}</ul></>}
    </> : <p className="gd-muted">This request is not linked to a prospect.</p>}
    <h3 className="gd-sub">Approved material for this meeting</h3>
    <GuidanceList items={data.guidance} empty={<p>No approved material for this meeting type yet.</p>} />
  </section>
}

type Ops = {
  meetings: { id: string; meeting_type: string; partner_name: string; business_name: string | null; status: Status; created_at: string }[]
  scopes: { id: string; partner_name: string; business_name: string; status: Status }[]
  contentAwaitingDecision: { kind: string; slug: string; title: string; version: number }[]
  contentExpiring: { kind: string; slug: string; title: string; review_by: string }[]
}

/** Founder operations queue over existing records; each line opens the existing workspace where the action lives. */
export function FounderOperations({ ops, onTab }: { ops: Ops | { unavailable: true } | undefined; onTab: (tab: string) => void }) {
  if (!ops) return null
  if ("unavailable" in ops) return <section className="gd-panel" aria-labelledby="ops-heading"><p className="gd-overline">Founder operations</p><h2 id="ops-heading">Needs your attention</h2><p className="gd-error" role="alert">The operations queue could not be loaded. The rest of the workspace is unaffected; reload to try again.</p></section>
  const total = ops.meetings.length + ops.scopes.length + ops.contentAwaitingDecision.length + ops.contentExpiring.length
  return <section className="gd-panel" aria-labelledby="ops-heading">
    <p className="gd-overline">Founder operations</p><h2 id="ops-heading">Needs your attention <span className="gd-status">{total}</span></h2>
    <div className="gd-grid">
      <div><h3 className="gd-sub">Partner meeting and help requests ({ops.meetings.length})</h3>
        {ops.meetings.length ? <ul className="gd-rows">{ops.meetings.slice(0, 6).map((m) => <li className="gd-row" key={m.id}><div><strong>{MEETING_TYPES[m.meeting_type] ?? m.meeting_type}</strong><p>{m.partner_name}{m.business_name ? ` · ${m.business_name}` : ""}</p></div><StatusPill s={m.status} /></li>)}</ul> : <p className="gd-muted">None waiting.</p>}
        {ops.meetings.length > 0 && <button type="button" className="gd-action" onClick={() => onTab("operations")}>Open partner operations</button>}</div>
      <div><h3 className="gd-sub">Scopes to review ({ops.scopes.length})</h3>
        {ops.scopes.length ? <ul className="gd-rows">{ops.scopes.slice(0, 6).map((o) => <li className="gd-row" key={o.id}><div><strong>{o.business_name}</strong><p>{o.partner_name}</p></div><StatusPill s={o.status} /></li>)}</ul> : <p className="gd-muted">None waiting.</p>}
        {ops.scopes.length > 0 && <button type="button" className="gd-action" onClick={() => onTab("pipeline")}>Open prospects and scope</button>}</div>
      <div><h3 className="gd-sub">Content awaiting a decision or publication ({ops.contentAwaitingDecision.length})</h3>
        {ops.contentAwaitingDecision.length ? <ul className="gd-rows">{ops.contentAwaitingDecision.slice(0, 6).map((c) => <li className="gd-row" key={`${c.kind}:${c.slug}:${c.version}`}><div><strong>{c.title}</strong><p>{c.kind} · v{c.version}</p></div></li>)}</ul> : <p className="gd-muted">Nothing waiting.</p>}
        <button type="button" className="gd-action" onClick={() => onTab("content")}>Open Content studio</button></div>
      <div><h3 className="gd-sub">Published content due for review within 30 days ({ops.contentExpiring.length})</h3>
        {ops.contentExpiring.length ? <ul className="gd-rows">{ops.contentExpiring.slice(0, 6).map((c) => <li className="gd-row" key={`${c.kind}:${c.slug}:${c.review_by}`}><div><strong>{c.title}</strong><p>{c.kind} · review by {String(c.review_by).slice(0, 10)}</p></div></li>)}</ul> : <p className="gd-muted">Nothing due.</p>}</div>
    </div>
  </section>
}

/** Loads preparation only when the partner asks for it. */
export function MeetingPrepToggle({ meetingId }: { meetingId: string }) {
  const [open, setOpen] = useState(false)
  return <div>
    <button type="button" className="gd-action" aria-expanded={open} aria-controls={`prep-${meetingId}`} onClick={() => setOpen((o) => !o)}>{open ? "Hide preparation" : "Prepare for this meeting"}</button>
    <div id={`prep-${meetingId}`} aria-live="polite">{open && <MeetingPrep meetingId={meetingId} />}</div>
  </div>
}
