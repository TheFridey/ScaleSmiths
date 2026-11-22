"use client"

import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react"
import { AcademyShell, type PartnerNav } from "@/components/empower/AcademyShell"
import { ProspectGuidance } from "@/components/expansion/PartnerWorkspacePanels"
import { filterPipeline, INTERACTION_KINDS, type PipelineCard, type PipelineFilter, type TimelineEntry } from "@/lib/partner-pipeline"
import { explain, MEETING_STATUS } from "@/lib/partner-guidance"
import type { Qualification } from "@/lib/partner-qualification"
import { QualificationChecklist } from "./QualificationChecklist"
import "@/components/empower/guidance.css"
import "./pipeline.css"

type Column = { key: string; label: string; meaning: string }
type Pipeline = { columns: Column[]; cards: PipelineCard[]; truncated: boolean }
type Detail = {
  opportunity: { id: string; businessName: string; website: string | null; industry: string | null; region: string | null; status: string; statusLabel: string; statusMeaning: string; column: string | null; createdAt: string | null; followUp: string | null; missingForScope: string[] }
  transitions: { allowed: { to: string; label: string }[]; blocked: { to: string; label: string; reason: string }[] }
  meetings: { id: string; status: string; meetingType: string; confirmedStart: string | null; proposedStart: string | null; createdAt: string }[]
  interactions: { id: string; kind: string; summary: string; occurredOn: string; createdAt: string | null }[]
  timeline: TimelineEntry[]
  qualification: Qualification | null
}
type View = "board" | "table" | "list"

const date = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—")
const today = () => new Date().toISOString().slice(0, 10)
const ASSISTANCE = [
  { key: "commercial_assistance", label: "Commercial help (pricing, terms, objections)" }, { key: "technical_scoping", label: "Technical scoping" },
  { key: "bespoke_discovery", label: "Bespoke discovery" }, { key: "escalation", label: "Something else needs a founder" },
] as const
const MEETING_TYPES: Record<string, string> = { joint_sales: "Joint sales meeting", technical_scoping: "Technical scoping", bespoke_discovery: "Bespoke discovery", commercial_assistance: "Commercial assistance", proposal_review: "Proposal review", training: "Training", escalation: "Escalation" }
const FIELD_LABELS: Record<string, string> = { objectives: "Objectives", pages: "Pages", functionality: "Functionality", budget: "Budget", timescale: "Timescale", decisionProcess: "Decision process" }

async function send(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store" })
  const b = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(b.error || "That change could not be saved.")
  return b
}

/** Operation Ascend B2.1. Every status shown comes from the server; every change goes through the server's authorised commands. */
export function PartnerPipeline({ nav, guidance }: { nav: PartnerNav; guidance: boolean }) {
  const [data, setData] = useState<Pipeline | null>(null), [error, setError] = useState(""), [attempt, setAttempt] = useState(0)
  const [view, setView] = useState<View>("board"), [filter, setFilter] = useState<PipelineFilter>({ sort: "activity" })
  const [openId, setOpenId] = useState<string | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  const reload = useCallback(() => setAttempt((a) => a + 1), [])
  useEffect(() => { if (window.matchMedia("(max-width: 719px)").matches) setView("list") }, [])
  useEffect(() => {
    const c = new AbortController()
    setError("")
    fetch("/api/partner/pipeline", { cache: "no-store", signal: c.signal })
      .then(async (r) => { const b = await r.json(); if (!r.ok) throw new Error(b.error || "The pipeline is unavailable."); setData(b) })
      .catch((e: Error) => { if (e.name !== "AbortError") setError(e.message) })
    return () => c.abort()
  }, [attempt])
  const cards = useMemo(() => (data ? filterPipeline(data.cards, filter) : []), [data, filter])
  const open = (id: string, from: HTMLElement) => { opener.current = from; setOpenId(id) }
  const close = () => { setOpenId(null); requestAnimationFrame(() => opener.current?.focus()) }
  const set = (patch: Partial<PipelineFilter>) => setFilter((f) => ({ ...f, ...patch }))
  const attentionCount = data?.cards.filter((c) => c.attention.length > 0).length ?? 0

  return <AcademyShell current="pipeline" nav={nav}>
    <section className="ac-hero" aria-labelledby="pl-title">
      <p className="ac-overline">Your pipeline</p>
      <h1 id="pl-title">Every business you have introduced</h1>
      <p>Stages come from ScaleSmiths&apos; records. You can move a prospect only where the approved workflow allows; scope decisions, contracts and commission are recorded by ScaleSmiths.</p>
    </section>

    {data && <dl className="pl-summary" aria-label="Pipeline summary">
      <div><dt>Open</dt><dd>{data.cards.filter((c) => c.column !== "closed" && c.column !== "won").length}</dd></div>
      <div><dt>Need your action</dt><dd>{attentionCount}</dd></div>
      <div><dt>With ScaleSmiths</dt><dd>{data.cards.filter((c) => c.column === "review" || c.column === "information").length}</dd></div>
      <div><dt>Contracts accepted</dt><dd>{data.cards.filter((c) => c.column === "won").length}</dd></div>
    </dl>}

    <form className="pl-toolbar" role="search" aria-label="Filter your pipeline" onSubmit={(e) => e.preventDefault()}>
      <label className="pl-field pl-search"><span>Search</span><input type="search" value={filter.q ?? ""} onChange={(e) => set({ q: e.target.value })} placeholder="Business or sector" maxLength={120} /></label>
      <label className="pl-field"><span>Stage</span><select value={filter.column ?? ""} onChange={(e) => set({ column: e.target.value || undefined })}>
        <option value="">All stages</option>{data?.columns.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label>
      <label className="pl-field"><span>Meetings</span><select value={filter.meeting ?? ""} onChange={(e) => set({ meeting: e.target.value || undefined })}>
        <option value="">Any</option><option value="awaiting_you">Needs your reply</option><option value="pending">Requested</option><option value="confirmed">Confirmed</option><option value="none">No open meeting</option></select></label>
      <label className="pl-field"><span>Sort</span><select value={filter.sort} onChange={(e) => set({ sort: e.target.value as PipelineFilter["sort"] })}>
        <option value="activity">Latest activity</option><option value="created">Date added</option><option value="follow_up">Next follow-up</option><option value="name">Business name</option></select></label>
      <label className="pl-check"><input type="checkbox" checked={!!filter.attention} onChange={(e) => set({ attention: e.target.checked || undefined })} /><span>Needs my action</span></label>
      <div className="pl-views" role="group" aria-label="View">
        {(["board", "table", "list"] as const).map((v) => <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>{v === "board" ? "Board" : v === "table" ? "Table" : "List"}</button>)}
      </div>
    </form>

    <p className="pl-live" role="status" aria-live="polite">{data ? `${cards.length} of ${data.cards.length} opportunities shown` : ""}</p>
    {error ? <div className="gd-error" role="alert"><p>{error}</p><button type="button" className="gd-button gd-button-quiet" onClick={reload}>Try again</button></div>
      : !data ? <div className="gd-skeleton" aria-hidden="true"><span /><span /></div>
      : data.cards.length === 0 ? <div className="gd-empty pl-empty"><p>You have not registered a business yet.</p><a className="gd-link" href="/partner">Register a prospect in your workspace</a></div>
      : cards.length === 0 ? <div className="gd-empty"><p>No opportunities match these filters.</p><button type="button" className="gd-button gd-button-quiet" onClick={() => setFilter({ sort: filter.sort })}>Clear filters</button></div>
      : view === "board" ? <Board columns={data.columns} cards={cards} onOpen={open} />
      : view === "table" ? <Table cards={cards} onOpen={open} />
      : <List cards={cards} onOpen={open} />}
    {data?.truncated && <p className="gd-muted">Showing your 500 most recent opportunities.</p>}
    {openId && <OpportunityDialog id={openId} guidance={guidance} onClose={close} onChanged={reload} />}
  </AcademyShell>
}

function Flags({ c }: { c: PipelineCard }) {
  return <>
    {c.meetingLabel && <span className="pl-flag" data-tone={c.meeting === "awaiting_you" ? "action" : c.meeting === "confirmed" ? "done" : "progress"}>{c.meetingLabel}</span>}
    {c.attention.map((a) => <span key={a.key} className="pl-flag" data-tone="action">{a.label}</span>)}
  </>
}
function Board({ columns, cards, onOpen }: { columns: Column[]; cards: PipelineCard[]; onOpen: (id: string, el: HTMLElement) => void }) {
  return <div className="pl-board" aria-label="Pipeline board">
    {columns.map((col) => { const items = cards.filter((c) => c.column === col.key); return <section key={col.key} className="pl-column" aria-labelledby={`col-${col.key}`}>
      <header><h2 id={`col-${col.key}`}>{col.label} <span className="pl-count">{items.length}</span></h2><p>{col.meaning}</p></header>
      {items.length ? <ul>{items.map((c) => <li key={c.id}><button type="button" className="pl-card" onClick={(e) => onOpen(c.id, e.currentTarget)} aria-label={`Open ${c.businessName}, ${c.statusLabel}`}>
        <strong>{c.businessName}</strong><span className="pl-status">{c.statusLabel}</span>
        <span className="pl-meta">{c.industry ? `${c.industry} · ` : ""}Last activity {date(c.lastActivity)}</span>
        <span className="pl-flags"><Flags c={c} /></span>
      </button></li>)}</ul> : <p className="pl-none">None</p>}
    </section> })}
  </div>
}
function Table({ cards, onOpen }: { cards: PipelineCard[]; onOpen: (id: string, el: HTMLElement) => void }) {
  return <div className="pl-table-wrap" role="region" aria-label="Pipeline table" tabIndex={0}><table className="pl-table">
    <thead><tr><th scope="col">Business</th><th scope="col">Stage</th><th scope="col">Meeting</th><th scope="col">Needs action</th><th scope="col">Follow-up</th><th scope="col">Added</th><th scope="col">Last activity</th></tr></thead>
    <tbody>{cards.map((c) => <tr key={c.id}>
      <th scope="row"><button type="button" className="pl-rowlink" onClick={(e) => onOpen(c.id, e.currentTarget)}>{c.businessName}</button></th>
      <td>{c.statusLabel}</td><td>{c.meetingLabel ?? "—"}</td><td>{c.attention.length ? c.attention.map((a) => a.label).join("; ") : "—"}</td>
      <td>{date(c.followUp)}</td><td>{date(c.createdAt)}</td><td>{date(c.lastActivity)}</td>
    </tr>)}</tbody>
  </table></div>
}
function List({ cards, onOpen }: { cards: PipelineCard[]; onOpen: (id: string, el: HTMLElement) => void }) {
  return <ul className="pl-list" aria-label="Pipeline list">{cards.map((c) => <li key={c.id}>
    <button type="button" className="pl-card" onClick={(e) => onOpen(c.id, e.currentTarget)} aria-label={`Open ${c.businessName}, ${c.statusLabel}`}>
      <strong>{c.businessName}</strong><span className="pl-status">{c.statusLabel}</span><span className="pl-flags"><Flags c={c} /></span>
    </button>
  </li>)}</ul>
}

function OpportunityDialog({ id, guidance, onClose, onChanged }: { id: string; guidance: boolean; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<Detail | null>(null), [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false), [n, setN] = useState(0)
  const panel = useRef<HTMLDivElement>(null), assist = useRef<HTMLSelectElement>(null), titleId = useId()
  useEffect(() => {
    const c = new AbortController()
    fetch(`/api/partner/pipeline?id=${encodeURIComponent(id)}`, { cache: "no-store", signal: c.signal })
      .then(async (r) => { const b = await r.json(); if (!r.ok) throw new Error(b.error || "This opportunity is unavailable."); setD(b) })
      .catch((e: Error) => { if (e.name !== "AbortError") setError(e.message) })
    return () => c.abort()
  }, [id, n])
  useEffect(() => { panel.current?.focus() }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose() }
      if (e.key === "Tab" && panel.current) {
        const f = [...panel.current.querySelectorAll<HTMLElement>("button,a[href],input,select,textarea,summary,[tabindex]:not([tabindex='-1'])")].filter((el) => !el.hasAttribute("disabled"))
        if (!f.length) return
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus() }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus() }
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])
  const run = async (label: string, url: string, body: unknown) => {
    if (busy) return false
    setBusy(true); setError(""); setNotice("")
    try { await send(url, body); setNotice(label); setN((x) => x + 1); onChanged(); return true }
    catch (e) { setError((e as Error).message); return false }
    finally { setBusy(false) }
  }
  const move = (to: string, label: string) => { if (window.confirm(`${label}? This is recorded in the opportunity's history.`)) void run("Stage updated.", "/api/partner", { action: "stage", id, status: to }) }
  const followUp = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const v = String(new FormData(e.currentTarget).get("date") ?? ""); void run(v ? "Follow-up date saved." : "Follow-up date cleared.", "/api/partner/pipeline", { action: "schedule_follow_up", opportunityId: id, date: v }) }
  const interaction = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = e.currentTarget, f = new FormData(form)
    if (await run("Interaction recorded.", "/api/partner/pipeline", { action: "record_interaction", opportunityId: id, kind: f.get("kind"), summary: f.get("summary"), occurredOn: f.get("occurredOn") })) form.reset()
  }
  const assistance = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = e.currentTarget, f = new FormData(form), slot = String(f.get("slot") ?? "")
    const body = { action: "request_meeting", opportunityId: id, meetingType: f.get("type"), purpose: f.get("purpose"), preferredSlots: slot ? [new Date(slot).toISOString()] : [], timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London" }
    if (await run("Request sent to ScaleSmiths. It appears in the founders' queue.", "/api/partner", body)) form.reset()
  }

  return <div className="pl-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
    <div className="pl-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panel} tabIndex={-1}>
      <header className="pl-dialog-head">
        <div><p className="gd-overline">Opportunity</p><h2 id={titleId}>{d?.opportunity.businessName ?? "Loading…"}</h2></div>
        <button type="button" className="gd-button gd-button-quiet" onClick={onClose}>Close</button>
      </header>
      <p className="pl-live" role="status" aria-live="polite">{busy ? "Saving…" : notice}</p>
      {error && <div className="gd-error" role="alert"><p>{error}</p></div>}
      {!d ? (!error && <div className="gd-skeleton" aria-hidden="true"><span /><span /></div>) : <>
        <section className="pl-block" aria-label="Current stage">
          <p><span className="gd-status" data-tone="progress">{d.opportunity.statusLabel}</span> <span className="gd-muted">{d.opportunity.statusMeaning}</span></p>
          <p className="gd-muted">{[d.opportunity.industry, d.opportunity.region, d.opportunity.website?.replace(/^https?:\/\//, "")].filter(Boolean).join(" · ")}{d.opportunity.createdAt ? ` · Added ${date(d.opportunity.createdAt)}` : ""}</p>
          {d.opportunity.missingForScope.length > 0 && !["closed", "won", "approved", "review"].includes(String(d.opportunity.column)) && <><p className="gd-muted">Before the scope can be submitted, discovery still needs: {d.opportunity.missingForScope.map((k) => FIELD_LABELS[k] ?? k).join(", ")}.</p><a className="gd-link" href="/partner">Update discovery in your workspace</a></>}
        </section>

        {d.qualification && <section className="pl-block" aria-labelledby={`${titleId}-qa`}>
          <h3 id={`${titleId}-qa`} className="gd-sub">Qualification readiness</h3>
          <QualificationChecklist q={d.qualification} headingId={`${titleId}-qa`} onEscalate={d.opportunity.column === "closed" ? undefined : (route) => { if (assist.current) { assist.current.value = route; assist.current.focus() } }} />
        </section>}

        <section className="pl-block" aria-labelledby={`${titleId}-stage`}>
          <h3 id={`${titleId}-stage`} className="gd-sub">Move stage</h3>
          {d.transitions.allowed.length ? <div className="pl-actions">{d.transitions.allowed.map((t) => <button key={t.to} type="button" className="gd-button gd-button-quiet" disabled={busy} onClick={() => move(t.to, t.label)}>{t.label}</button>)}</div>
            : <p className="gd-muted">There is no stage you can choose from here.</p>}
          {d.transitions.blocked.length > 0 && <details className="pl-why"><summary>Why can&apos;t I choose other stages?</summary>
            <ul>{d.transitions.blocked.map((b) => <li key={b.to}><strong>{b.label}:</strong> {b.reason}</li>)}</ul></details>}
        </section>

        {d.opportunity.column !== "closed" && <div className="pl-forms">
          <form className="pl-block pl-form" onSubmit={followUp} aria-labelledby={`${titleId}-fu`}>
            <h3 id={`${titleId}-fu`} className="gd-sub">Follow-up reminder</h3>
            <p className="gd-muted">A private reminder for you; nothing is sent to anyone.</p>
            <label className="pl-field"><span>Date</span><input type="date" name="date" min={today()} defaultValue={d.opportunity.followUp?.slice(0, 10) ?? ""} key={d.opportunity.followUp ?? "none"} /></label>
            <button type="submit" className="gd-button" disabled={busy}>Save follow-up</button>
          </form>
          <form className="pl-block pl-form" onSubmit={interaction} aria-labelledby={`${titleId}-int`}>
            <h3 id={`${titleId}-int`} className="gd-sub">Record an interaction</h3>
            <label className="pl-field"><span>Type</span><select name="kind" required defaultValue="call">{INTERACTION_KINDS.map((k) => <option key={k} value={k}>{k[0].toUpperCase() + k.slice(1)}</option>)}</select></label>
            <label className="pl-field"><span>Date</span><input type="date" name="occurredOn" required max={today()} defaultValue={today()} /></label>
            <label className="pl-field"><span>Summary</span><textarea name="summary" required maxLength={2000} rows={3} placeholder="What was discussed and what happens next. Avoid personal details you do not need." /></label>
            <button type="submit" className="gd-button" disabled={busy}>Record interaction</button>
          </form>
          <form className="pl-block pl-form" onSubmit={assistance} aria-labelledby={`${titleId}-help`}>
            <h3 id={`${titleId}-help`} className="gd-sub">Ask a founder for help</h3>
            <label className="pl-field"><span>What do you need?</span><select name="type" ref={assist} required>{ASSISTANCE.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}</select></label>
            <label className="pl-field"><span>A time that suits you</span><input type="datetime-local" name="slot" required /></label>
            <label className="pl-field"><span>What should the founder know?</span><textarea name="purpose" required maxLength={2000} rows={3} /></label>
            <button type="submit" className="gd-button" disabled={busy}>Send request</button>
          </form>
        </div>}

        {/* Keyed by status so the guidance re-reads after a stage move in this dialog. */}
        {guidance && <ProspectGuidance key={`${id}-${d.opportunity.status}`} opportunityId={id} onRequestHelp={() => assist.current?.focus()} />}

        <section className="pl-block" aria-labelledby={`${titleId}-meet`}>
          <h3 id={`${titleId}-meet`} className="gd-sub">Meetings</h3>
          {d.meetings.length ? <ul className="gd-rows">{d.meetings.map((m) => <li className="gd-row" key={m.id}><div><strong>{MEETING_TYPES[m.meetingType] ?? m.meetingType}</strong><p className="gd-muted">{explain(MEETING_STATUS, m.status).label}{m.confirmedStart ? ` · ${new Date(m.confirmedStart).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}` : ""}</p></div></li>)}</ul>
            : <p className="gd-muted">No meetings for this opportunity.</p>}
        </section>
        <section className="pl-block" aria-labelledby={`${titleId}-int-list`}>
          <h3 id={`${titleId}-int-list`} className="gd-sub">Your interactions</h3>
          {d.interactions.length ? <ul className="pl-interactions">{d.interactions.map((i) => <li key={i.id}><p className="gd-muted">{date(i.occurredOn)} · {i.kind}</p><p className="pl-text">{i.summary}</p></li>)}</ul>
            : <p className="gd-muted">Nothing recorded yet.</p>}
        </section>
        <section className="pl-block" aria-labelledby={`${titleId}-tl`}>
          <h3 id={`${titleId}-tl`} className="gd-sub">History</h3>
          {d.timeline.length ? <ol className="pl-timeline">{d.timeline.map((t, i) => <li key={`${t.at}-${i}`}><time dateTime={t.at}>{date(t.at)}</time><span>{t.label}</span><span className="pl-who">{t.actor === "you" ? "You" : "ScaleSmiths"}</span></li>)}</ol>
            : <p className="gd-muted">No recorded events yet.</p>}
        </section>
      </>}
    </div>
  </div>
}
