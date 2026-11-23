"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import type { QueueItem } from "@/lib/sales-command"
import "./command.css"

type Assignment = { id: string; assigneeId: string | null; assigneeName: string | null; reason: string; at: string | null } | null
type Item = QueueItem & { ageDays: number; assignment: Assignment }
type Data = {
  generatedAt: string; rules: readonly { kind: string; label: string; rule: string }[]; thresholds: { stalledAfterDays: number; proposalFollowUpAfterDays: number }
  overview: Record<string, number>; queue: Item[]; founders: { id: string; name: string }[]
  partners: { id: string; name: string; status: string; region: string | null; openOpportunities: number; confirmedOutcomes: number; openHelpRequests: number; commission: { earnedPence: string; paidPence: string } }[]
}
const METRICS: { key: string; label: string; note: string }[] = [
  { key: "activeOpportunities", label: "Active opportunities", note: "Open, under review or approved" },
  { key: "awaitingReview", label: "Awaiting scope review", note: "Submitted scopes" },
  { key: "technicalScoping", label: "Need technical scoping", note: "Submitted scopes with technical flags" },
  { key: "meetingsToConfirm", label: "Meetings to decide", note: "Open meeting requests" },
  { key: "assistanceRequests", label: "Partner help requests", note: "Open requests for founder help" },
  { key: "proposalsAwaitingAction", label: "Approved, no contract", note: "Scopes approved, awaiting acceptance" },
  { key: "confirmedOutcomes", label: "Contracts accepted", note: "Recorded commercial outcomes" },
  { key: "stalled", label: "Stalled", note: "No activity within the threshold" },
  { key: "applicationsToReview", label: "Applications to review", note: "Submitted or under review" },
  { key: "invitedNotActivated", label: "Invited, not activated", note: "Onboarding not completed" },
  { key: "failedNotifications", label: "Failed partner emails", note: "Lifecycle emails not delivered" },
]
const gbp = (pence: string) => { const n = Number(BigInt(pence)) / 100; return n.toLocaleString("en-GB", { style: "currency", currency: "GBP" }) }
const day = (v: string) => new Date(v).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })

/** Operation Ascend B2.3. Every number and item comes from existing records; every item opens the place it is decided. */
export function SalesCommandCentre({ handoffsEnabled = false, automationEnabled = false }: { handoffsEnabled?: boolean; automationEnabled?: boolean }) {
  const [data, setData] = useState<Data | null>(null), [error, setError] = useState(""), [n, setN] = useState(0), [kind, setKind] = useState(""), [mine, setMine] = useState("")
  const reload = useCallback(() => setN((x) => x + 1), [])
  useEffect(() => {
    const c = new AbortController()
    setError("")
    fetch("/api/expansion/command", { cache: "no-store", signal: c.signal })
      .then(async (r) => { const b = await r.json(); if (!r.ok) throw new Error(b.error || "The command centre is unavailable."); setData(b) })
      .catch((e: Error) => { if (e.name !== "AbortError") setError(e.message) })
    return () => c.abort()
  }, [n])
  const queue = useMemo(() => (data?.queue ?? []).filter((i) => (!kind || i.kind === kind) && (!mine || (mine === "unassigned" ? i.opportunityId && !i.assignment?.assigneeId : i.assignment?.assigneeId === mine))), [data, kind, mine])

  return <main className="sc" aria-labelledby="sc-title">
    <header className="sc-head">
      <div><p className="sc-overline">Operation Ascend</p><h1 id="sc-title">Sales command centre</h1>
        <p className="sc-lede">What needs a founder now, across every partner. Counts and items are read from the live records; nothing here changes a partner&apos;s ownership or commission.</p></div>
      <div className="sc-head-actions">{automationEnabled && <Link className="sc-link" href="/expansion/automation">Operational signals</Link>}{handoffsEnabled && <Link className="sc-link" href="/expansion/handoffs">Delivery handoffs</Link>}<Link className="sc-link" href="/expansion">Partner network workspace</Link><button type="button" className="sc-button sc-quiet" onClick={reload}>Refresh</button></div>
    </header>
    {error ? <div className="sc-error" role="alert"><p>{error}</p><button type="button" className="sc-button sc-quiet" onClick={reload}>Try again</button></div>
      : !data ? <p className="sc-muted" role="status">Loading…</p> : <>
      <section aria-labelledby="sc-overview"><h2 id="sc-overview" className="sc-h2">Pipeline overview</h2>
        <dl className="sc-metrics">{METRICS.map((m) => <div key={m.key}><dt>{m.label}</dt><dd>{data.overview[m.key] ?? 0}</dd><dd className="sc-note">{m.note}</dd></div>)}</dl>
        <p className="sc-muted">As of {new Date(data.generatedAt).toLocaleString("en-GB")}. Stalled means no recorded activity for {data.thresholds.stalledAfterDays} days; proposal follow-up starts {data.thresholds.proposalFollowUpAfterDays} days after approval.</p>
      </section>

      <section aria-labelledby="sc-queue" className="sc-panel"><h2 id="sc-queue" className="sc-h2">Work queue</h2>
        <details className="sc-rules"><summary>How the queue is ordered</summary><ol>{data.rules.map((r) => <li key={r.kind}><strong>{r.label}:</strong> {r.rule}</li>)}</ol><p>Within each kind, the oldest item comes first. There is no hidden score.</p></details>
        <div className="sc-filters">
          <label className="sc-field"><span>Kind</span><select value={kind} onChange={(e) => setKind(e.target.value)}><option value="">All kinds</option>{data.rules.map((r) => <option key={r.kind} value={r.kind}>{r.label}</option>)}</select></label>
          <label className="sc-field"><span>Handled by</span><select value={mine} onChange={(e) => setMine(e.target.value)}><option value="">Anyone</option><option value="unassigned">Unassigned opportunities</option>{data.founders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
        </div>
        <p className="sc-muted" role="status" aria-live="polite">{queue.length} of {data.queue.length} items</p>
        {queue.length ? <ul className="sc-queue">{queue.map((i) => <QueueRow key={i.id} item={i} label={data.rules.find((r) => r.kind === i.kind)?.label ?? i.kind} founders={data.founders} onChanged={reload} />)}</ul>
          : <p className="sc-empty">{data.queue.length ? "No items match these filters." : "Nothing needs a founder right now."}</p>}
      </section>

      <section aria-labelledby="sc-partners" className="sc-panel"><h2 id="sc-partners" className="sc-h2">Partner oversight</h2>
        <p className="sc-muted">Alphabetical, never ranked. Commission figures come from the Commission centre&apos;s ledger. Learning progress is private and not shown.</p>
        <div className="sc-table-wrap" role="region" aria-label="Partner oversight table" tabIndex={0}><table className="sc-table">
          <thead><tr><th scope="col">Partner</th><th scope="col">Status</th><th scope="col">Region</th><th scope="col">Open opportunities</th><th scope="col">Contracts accepted</th><th scope="col">Open help requests</th><th scope="col">Commission earned</th><th scope="col">Commission paid</th></tr></thead>
          <tbody>{data.partners.map((p) => <tr key={p.id}><th scope="row">{p.name}</th><td>{p.status}</td><td>{p.region ?? "—"}</td><td>{p.openOpportunities}</td><td>{p.confirmedOutcomes}</td><td>{p.openHelpRequests}</td><td>{gbp(p.commission.earnedPence)}</td><td>{gbp(p.commission.paidPence)}</td></tr>)}</tbody>
        </table></div>
        {!data.partners.length && <p className="sc-empty">No partners yet.</p>}
      </section>
    </>}
  </main>
}

function QueueRow({ item, label, founders, onChanged }: { item: Item; label: string; founders: { id: string; name: string }[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("")
  const assign = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (busy) return
    const f = new FormData(e.currentTarget), assigneeId = String(f.get("assignee") ?? "")
    setBusy(true); setError("")
    try {
      const r = await fetch("/api/expansion/command", { method: "POST", headers: { "content-type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ action: "assign", opportunityId: item.opportunityId, assigneeId: assigneeId || null, reason: f.get("reason"), expectedCurrentId: item.assignment?.id ?? null }) })
      const b = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(b.error || "The assignment was not saved.")
      setOpen(false); onChanged()
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }
  return <li className="sc-item" data-kind={item.kind}>
    <div className="sc-item-main">
      <p className="sc-kind">{label}{item.tags.includes("technical") && <span className="sc-tag">Technical scoping</span>}</p>
      <p className="sc-title">{item.title}{item.partnerName ? <span className="sc-partner"> · {item.partnerName}</span> : null}</p>
      <p className="sc-muted">{item.detail ? `${item.detail} · ` : ""}since {day(item.since)} ({item.ageDays} {item.ageDays === 1 ? "day" : "days"})</p>
      {item.opportunityId && <p className="sc-muted">{item.assignment?.assigneeName ? `Handled by ${item.assignment.assigneeName}` : "No founder assigned"}</p>}
    </div>
    <div className="sc-item-actions">
      <Link className="sc-button" href={item.href} aria-label={`Open ${label.toLowerCase()}: ${item.title}`}>Open</Link>
      {item.opportunityId && <button type="button" className="sc-button sc-quiet" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{item.assignment?.assigneeId ? "Reassign" : "Assign"}</button>}
    </div>
    {open && <form className="sc-assign" onSubmit={assign} aria-label={`Assign a founder to ${item.title}`}>
      <label className="sc-field"><span>Founder</span><select name="assignee" defaultValue={item.assignment?.assigneeId ?? ""}>
        <option value="">Nobody (release)</option>{founders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
      <label className="sc-field sc-grow"><span>Reason</span><input name="reason" required minLength={3} maxLength={500} placeholder="Why this founder, for the record" /></label>
      <button type="submit" className="sc-button" disabled={busy}>{busy ? "Saving…" : "Save assignment"}</button>
      <p className="sc-muted sc-full">Internal only: the partner keeps ownership and commission entitlement, and is not notified.</p>
      {error && <p className="sc-error sc-full" role="alert">{error}</p>}
    </form>}
  </li>
}
