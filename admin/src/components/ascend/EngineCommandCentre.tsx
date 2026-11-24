"use client"
import Link from "next/link"
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react"
import { ACTION_REGISTRY, EXECUTION_STATES, STATE_LABEL, type ExecutionState } from "@/lib/ascend-engine"
import "./command.css"
import "./engine.css"

/* Operation ASCEND B2.8 founder automation command centre. Every figure is read from the engine; every control calls it. */

type Control = { scope: string; suspended: boolean; reason: string; changedAt: string | null; version: number }
type Spec = (typeof ACTION_REGISTRY)[string]
type Definition = { actionType: string; enabled: boolean; intervalSeconds: number | null; cooldownSeconds: number; maxConcurrency: number; maxAttempts: number; timeoutSeconds: number;
  requiresApproval: boolean; approvalTtlSeconds: number; policyVersion: number; marketScope: string[]; expiresAt: string | null; spec: Spec; lastRun: string | null; runsLastWeek: number }
type Worker = { id: string; identity: string; identityActive: boolean; version: string; status: string; maxConcurrency: number; inFlight: number; leases: number; startedAt: string | null; lastHeartbeatAt: string | null; stale: boolean }
type Identity = { id: string; name: string; kind: string; capabilities: string[]; allowedActions: string[]; active: boolean; createdAt: string | null; rotatedAt: string | null; revokedAt: string | null }
type Overview = {
  generatedAt: string; flags: { engine: boolean; scheduler: boolean; agentApi: boolean; maxGlobalConcurrency: number }; controls: Control[]
  queue: { pendingApproval: number; queued: number; active: number; deadLetters: number; ambiguous: number; failed: number }
  throughput: { completedLastHour: number; completedLastDay: number; failedLastDay: number; retriesLastDay: number }
  latency: { sample: number; p50Seconds: number | null; p95Seconds: number | null }
  workers: Worker[]; definitions: Definition[]; identities: Identity[]; controlLog: { event: string; subject: string; occurredAt: string | null }[]
}
type Item = { id: string; correlationId: string; actionType: string; status: ExecutionState; origin: string; attempts: number; maxAttempts: number; failureClass: string | null; error: string | null; createdAt: string | null; completedAt: string | null; approvalRequired: boolean; policyVersion: number; cancelRequested: boolean }
type Finding = { kind: string; count: number; explanation: string; recommendedAction: string; href: string }
type Detail = Item & { payload: Record<string, unknown>; payloadSha256: string; scope: { markets?: string[] }; policyDecision: { rules?: string[]; decision?: string }; approval: { by: string; at: string | null; expiresAt: string | null } | null
  result: { summary?: string; source?: string; findings?: Finding[]; metrics?: Record<string, number> } | null; spec: Spec | null
  events: { event: string; from: string | null; to: string | null; actorKind: string; actorRef: string | null; occurredAt: string | null }[]; related: { id: string; actionType: string; status: string }[] }

const API = "/api/expansion/automation/engine"
const TONE: Partial<Record<ExecutionState, string>> = { completed: "good", running: "active", leased: "active", queued: "wait", retry_scheduled: "wait", pending_approval: "wait", approved: "wait", scheduled: "wait", failed: "bad", dead_lettered: "bad", ambiguous: "bad" }
const when = (v: string | null) => (v ? new Date(v).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—")
const ago = (v: string | null) => { if (!v) return "never"; const s = Math.round((Date.now() - Date.parse(v)) / 1000); return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} d ago` }
const seconds = (n: number | null) => (n == null ? "—" : n < 60 ? `${n}s` : n < 3600 ? `${Math.round(n / 60)} min` : `${Math.round(n / 3600)} h`)
const title = (t: string) => ACTION_REGISTRY[t]?.title ?? t
const Badge = ({ status }: { status: ExecutionState }) => <span className="ae-badge" data-tone={TONE[status] ?? "muted"}>{STATE_LABEL[status] ?? status}</span>

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || "The command centre could not complete that action.")
  return j.result as T
}

/** Accessible confirmation: native modal dialog, focus moves in, Esc cancels, focus returns to the trigger. */
function useConfirm() {
  const ref = useRef<HTMLDialogElement>(null)
  const [req, setReq] = useState<null | { heading: string; body: ReactNode; confirm: string; danger?: boolean; needsReason: boolean; run: (reason: string) => Promise<void> }>(null)
  const [reason, setReason] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState("")
  const opener = useRef<HTMLElement | null>(null)
  useEffect(() => { if (req && ref.current && !ref.current.open) ref.current.showModal() }, [req])
  const close = () => { ref.current?.close(); setReq(null); setReason(""); setErr(""); opener.current?.focus() }
  const ask = (r: NonNullable<typeof req>) => { opener.current = document.activeElement as HTMLElement; setReq(r) }
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (!req) return
    if (req.needsReason && reason.trim().length < 3) { setErr("Give a short reason; it is recorded in the audit history."); return }
    setBusy(true); setErr("")
    try { await req.run(reason.trim()); close() } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }
  const dialog = <dialog ref={ref} className="ae-dialog" aria-labelledby="ae-dialog-title" onCancel={(e) => { e.preventDefault(); if (!busy) close() }}>
    {req && <form onSubmit={submit}>
      <h2 id="ae-dialog-title">{req.heading}</h2>
      <div className="sc-muted">{req.body}</div>
      {req.needsReason && <label className="sc-field"><span>Reason (recorded in the audit history)</span><textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} aria-required="true" aria-invalid={err ? true : undefined} aria-describedby={err ? "ae-dialog-error" : undefined} autoFocus /></label>}
      {err && <p id="ae-dialog-error" className="sc-error" role="alert">{err}</p>}
      <div className="ae-dialog-actions"><button type="button" className="sc-button sc-quiet" onClick={close} disabled={busy}>Cancel</button>
        <button type="submit" className={`sc-button${req.danger ? " ae-danger" : ""}`} disabled={busy} autoFocus={!req.needsReason}>{busy ? "Working…" : req.confirm}</button></div>
    </form>}
  </dialog>
  return { ask, dialog }
}

export function EngineCommandCentre() {
  const [data, setData] = useState<Overview | null>(null)
  const [tab, setTab] = useState<"overview" | "executions" | "automations" | "workers">("overview")
  const [error, setError] = useState(""), [notice, setNotice] = useState("")
  const [selected, setSelected] = useState<string | null>(null)
  const [filter, setFilter] = useState({ status: "", actionType: "", q: "", from: "", to: "" })
  const [list, setList] = useState<{ items: Item[]; next: string | null } | null>(null)
  const [pending, setPending] = useState<Item[]>([])
  const { ask, dialog } = useConfirm()

  const reload = useCallback(async () => {
    setError("")
    try {
      const [o, p] = await Promise.all([fetch(`${API}?view=overview`, { cache: "no-store" }), fetch(`${API}?view=executions&status=pending_approval&limit=20`, { cache: "no-store" })])
      const oj = await o.json(); const pj = await p.json()
      if (!o.ok) throw new Error(oj.error || "The automation engine is unavailable.")
      setData(oj); setPending(p.ok ? pj.items : [])
    } catch (e) { setError((e as Error).message) }
  }, [])
  const loadList = useCallback(async (before?: string) => {
    const params = new URLSearchParams({ view: "executions", limit: "50", ...Object.fromEntries(Object.entries(filter).filter(([, v]) => v)) })
    if (before) params.set("before", before)
    const r = await fetch(`${API}?${params}`, { cache: "no-store" }); const j = await r.json()
    if (!r.ok) { setError(j.error || "Executions are unavailable."); return }
    setList((cur) => (before && cur ? { items: [...cur.items, ...j.items], next: j.next } : j))
  }, [filter])

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("status")
    if (status && (EXECUTION_STATES as readonly string[]).includes(status)) { setFilter((f) => ({ ...f, status })); setTab("executions") }
    if (window.location.hash === "#workers") setTab("workers")
    reload()
  }, [reload])
  useEffect(() => { if (tab === "executions") loadList() }, [tab, loadList])
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(""), 6000); return () => clearTimeout(t) }, [notice])

  const done = async (message: string) => { setNotice(message); await reload(); if (tab === "executions") await loadList() }
  const global = data?.controls.find((c) => c.scope === "global")
  const stopped = global?.suspended ?? true

  const toggleGlobal = () => ask({
    heading: stopped ? "Resume automation" : "Emergency stop",
    body: stopped ? "Workers may start queued executions again. Approvals, policy and market checks still apply to each one." : "No new execution will start. Queued work stays queued and recoverable; work already running finishes and is reported truthfully.",
    confirm: stopped ? "Resume automation" : "Stop all automation", danger: !stopped, needsReason: true,
    run: async (reason) => { await call({ action: "control", scope: "global", suspended: !stopped, reason, expectedVersion: global?.version }); await done(stopped ? "Automation resumed." : "Emergency stop is active.") },
  })

  return <main className="sc" aria-labelledby="ae-title">
    <header className="sc-head">
      <div><p className="sc-overline">Operation Ascend · B2.8</p><h1 id="ae-title">Automation command centre</h1>
        <p className="sc-lede">Every automated operation, why it exists, who approved it and what happened. Automation here only analyses and prepares internal reviews; it never contacts anyone, moves money or changes a partner&apos;s commission.</p></div>
      <div className="sc-head-actions"><Link className="sc-link" href="/expansion/automation/review">Review inbox</Link><Link className="sc-link" href="/expansion/command">Sales command</Link><button type="button" className="sc-button sc-quiet" onClick={reload}>Refresh</button></div>
    </header>
    {notice && <p className="ae-toast" role="status">{notice}</p>}
    {error && <div className="sc-error" role="alert"><p>{error}</p><button type="button" className="sc-button sc-quiet" onClick={reload}>Try again</button></div>}
    {!data ? (!error && <p className="sc-muted" role="status">Loading the automation engine…</p>) : <>
      <section className="ae-banner" data-stopped={stopped} aria-labelledby="ae-stop">
        <div><h2 id="ae-stop"><span className="ae-pulse" aria-hidden="true" />{stopped ? "Emergency stop is active" : "Automation is running"}</h2>
          <p>{global ? `${global.reason} · ${when(global.changedAt)}` : "No control recorded."}</p>
          <ul className="ae-flags" aria-label="Server switches">
            <li data-on={data.flags.scheduler}>Scheduler {data.flags.scheduler ? "on" : "off"}</li>
            <li data-on={data.flags.agentApi}>Agent interface {data.flags.agentApi ? "on" : "off"}</li>
            <li data-on="true">Global concurrency {data.flags.maxGlobalConcurrency}</li></ul></div>
        <button type="button" className={`sc-button${stopped ? "" : " ae-danger"}`} onClick={toggleGlobal}>{stopped ? "Resume automation…" : "Emergency stop…"}</button>
      </section>

      <div className="ae-tabs" role="tablist" aria-label="Command centre views">
        {([["overview", "Overview"], ["executions", "Executions"], ["automations", "Automations"], ["workers", "Workers & identities"]] as const).map(([k, label]) =>
          <button key={k} type="button" role="tab" id={`ae-tab-${k}`} aria-controls={`ae-panel-${k}`} aria-selected={tab === k} className="ae-tab" onClick={() => setTab(k)}>{label}</button>)}
      </div>

      {tab === "overview" && <div role="tabpanel" id="ae-panel-overview" aria-labelledby="ae-tab-overview">
        <dl className="sc-metrics" style={{ marginTop: 16 }}>
          {[["Awaiting approval", data.queue.pendingApproval, "Founder decision needed"], ["Queued", data.queue.queued, "Due or backing off"], ["Running", data.queue.active, "Leased by a worker"],
            ["Dead letters", data.queue.deadLetters, "Retries exhausted"], ["Needs reconciliation", data.queue.ambiguous, "Outcome unknown"], ["Completed 24 h", data.throughput.completedLastDay, `${data.throughput.completedLastHour} in the last hour`],
            ["Failed 24 h", data.throughput.failedLastDay, `${data.throughput.retriesLastDay} retries scheduled`], ["Queue latency", data.latency.p50Seconds == null ? "—" : seconds(data.latency.p50Seconds), data.latency.sample ? `p95 ${seconds(data.latency.p95Seconds)} · ${data.latency.sample} runs, no approval wait` : "No unattended runs in 24 h"]]
            .map(([l, v, n]) => <div key={String(l)}><dt>{l}</dt><dd>{v}</dd><dd className="sc-note">{n}</dd></div>)}
        </dl>
        <p className="sc-muted">As of {when(data.generatedAt)}.</p>
        {data.workers.some((w) => w.stale) && <p className="sc-error" role="alert">A worker has not reported for over five minutes. Check its process and identity under Workers &amp; identities.</p>}
        <div className="ae-split">
          <section className="sc-panel" aria-labelledby="ae-pending"><h2 id="ae-pending" className="sc-h2">Awaiting your approval</h2>
            {pending.length === 0 ? <p className="sc-empty">Nothing is waiting for approval.</p> : <ul className="sc-queue">{pending.map((p) =>
              <li key={p.id} className="sc-item"><div><p className="sc-kind">{p.origin === "agent" ? "Requested by an agent" : p.origin === "schedule" ? "Scheduled" : "Requested by a founder"}</p>
                <p className="sc-title">{title(p.actionType)}</p><p className="sc-muted">Requested {ago(p.createdAt)} · policy v{p.policyVersion}</p></div>
                <div className="sc-item-actions"><button type="button" className="sc-button" onClick={() => { setSelected(p.id); setTab("executions") }}>Review</button></div></li>)}</ul>}
          </section>
          <section className="sc-panel" aria-labelledby="ae-log"><h2 id="ae-log" className="sc-h2">Control history</h2>
            {data.controlLog.length === 0 ? <p className="sc-empty">No control changes recorded yet.</p> : <ol className="ae-timeline">{data.controlLog.slice(0, 10).map((c, i) =>
              <li key={i}><strong>{c.event.replaceAll("_", " ")}</strong> · {c.subject.replace(/^action:/, "")}<time>{when(c.occurredAt)}</time></li>)}</ol>}
          </section>
        </div>
      </div>}

      {tab === "executions" && <div role="tabpanel" id="ae-panel-executions" aria-labelledby="ae-tab-executions">
        {selected ? <ExecutionPanel id={selected} onBack={() => setSelected(null)} ask={ask} onDone={done} />
          : <section className="sc-panel" aria-labelledby="ae-explorer"><h2 id="ae-explorer" className="sc-h2">Execution explorer</h2>
            <form className="sc-filters" onSubmit={(e) => { e.preventDefault(); loadList() }}>
              <label className="sc-field"><span>Status</span><select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}><option value="">Any status</option>{EXECUTION_STATES.map((s) => <option key={s} value={s}>{STATE_LABEL[s]}</option>)}</select></label>
              <label className="sc-field"><span>Automation</span><select value={filter.actionType} onChange={(e) => setFilter({ ...filter, actionType: e.target.value })}><option value="">Any automation</option>{Object.values(ACTION_REGISTRY).map((s) => <option key={s.type} value={s.type}>{s.title}</option>)}</select></label>
              <label className="sc-field sc-grow"><span>Execution or correlation ID (prefix)</span><input value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value.trim() })} placeholder="e.g. 3f2a" pattern="[0-9a-fA-F-]{4,36}" /></label>
              <label className="sc-field"><span>From</span><input type="date" value={filter.from} onChange={(e) => setFilter({ ...filter, from: e.target.value })} /></label>
              <label className="sc-field"><span>To</span><input type="date" value={filter.to} onChange={(e) => setFilter({ ...filter, to: e.target.value })} /></label>
              <div className="sc-field" style={{ justifyContent: "flex-end" }}><button type="submit" className="sc-button">Apply</button></div>
            </form>
            {!list ? <p className="sc-muted" role="status">Loading executions…</p> : list.items.length === 0 ? <p className="sc-empty">No executions match these filters.</p> : <>
              <div className="sc-table-wrap"><table className="sc-table"><caption className="sc-muted" style={{ textAlign: "left", padding: "8px 12px" }}>{list.items.length} shown, newest first</caption>
                <thead><tr><th scope="col">Execution</th><th scope="col">Automation</th><th scope="col">Status</th><th scope="col">Origin</th><th scope="col">Attempts</th><th scope="col">Created</th><th scope="col">Last error</th></tr></thead>
                <tbody>{list.items.map((i) => <tr key={i.id} className="ae-row" onClick={() => setSelected(i.id)}>
                  <td><button type="button" className="ae-rowlink ae-mono" title={i.id} onClick={(e) => { e.stopPropagation(); setSelected(i.id) }}>{i.id.slice(0, 8)}</button></td>
                  <td>{title(i.actionType)}</td><td><Badge status={i.status} /></td><td>{i.origin}</td><td>{i.attempts}/{i.maxAttempts}</td><td>{when(i.createdAt)}</td>
                  <td>{i.failureClass ? <span className="ae-err" title={i.error ?? undefined}><strong>{i.failureClass.replaceAll("_", " ")}</strong>{i.error ? ` · ${i.error}` : ""}</span> : "—"}</td></tr>)}</tbody></table></div>
              {list.next && <p><button type="button" className="sc-button sc-quiet" onClick={() => loadList(list.next!)}>Load older executions</button></p>}</>}
          </section>}
      </div>}

      {tab === "automations" && <div role="tabpanel" id="ae-panel-automations" aria-labelledby="ae-tab-automations">
        <p className="sc-muted" style={{ margin: "16px 0" }}>Only these registered automations can run. Payment, commission, agreement, activation, permission, retention and outbound-communication actions are refused by the engine and the database.</p>
        <div className="ae-cards">{data.definitions.map((d) => <DefinitionCard key={d.actionType} def={d} control={data.controls.find((c) => c.scope === `action:${d.actionType}`)} ask={ask} onDone={done} />)}</div>
      </div>}

      {tab === "workers" && <div role="tabpanel" id="ae-panel-workers" aria-labelledby="ae-tab-workers"><WorkersPanel data={data} ask={ask} onDone={done} /></div>}
    </>}
    {dialog}
  </main>
}

type Ask = ReturnType<typeof useConfirm>["ask"]

function ExecutionPanel({ id, onBack, ask, onDone }: { id: string; onBack: () => void; ask: Ask; onDone: (m: string) => Promise<void> }) {
  const [d, setD] = useState<Detail | null>(null), [err, setErr] = useState("")
  const load = useCallback(async () => {
    const r = await fetch(`${API}?view=execution&id=${encodeURIComponent(id)}`, { cache: "no-store" }); const j = await r.json()
    if (!r.ok) setErr(j.error || "This execution is unavailable."); else setD(j)
  }, [id])
  useEffect(() => { load() }, [load])
  const act = (heading: string, body: ReactNode, confirm: string, action: Record<string, unknown>, needsReason: boolean, message: string, danger = false) =>
    ask({ heading, body, confirm, danger, needsReason, run: async (reason) => { await call({ ...action, id, reason, note: reason }); await load(); await onDone(message) } })
  if (err) return <div className="sc-error" role="alert"><p>{err}</p><button type="button" className="sc-button sc-quiet" onClick={onBack}>Back to executions</button></div>
  if (!d) return <p className="sc-muted" role="status">Loading execution…</p>
  return <section className="sc-panel" aria-labelledby="ae-detail">
    <p><button type="button" className="sc-link" style={{ background: "none", border: 0, padding: 0 }} onClick={onBack}>← All executions</button></p>
    <div className="sc-head" style={{ marginBottom: 12 }}><div><p className="sc-overline">{d.spec?.category === "review_preparation" ? "Review preparation" : "Analysis"}</p>
      <h2 id="ae-detail" className="sc-h2" style={{ fontSize: 22 }}>{d.spec?.title ?? d.actionType}</h2><p className="sc-muted">{d.spec?.description}</p></div><Badge status={d.status} /></div>
    <div className="sc-head-actions" style={{ marginBottom: 16 }}>
      {d.status === "pending_approval" && <>
        <button type="button" className="sc-button" onClick={() => act("Approve this operation", <>You are approving <strong>{d.spec?.title}</strong> exactly as shown: payload digest <span className="ae-mono">{d.payloadSha256.slice(0, 16)}…</span>, policy v{d.policyVersion}, markets {d.scope.markets?.join(", ")}. Any change to these invalidates the approval. Effects: {d.spec?.effects}</>, "Approve", { action: "approve", payloadSha256: d.payloadSha256, policyVersion: d.policyVersion }, false, "Approved and queued.")}>Approve…</button>
        <button type="button" className="sc-button sc-quiet" onClick={() => act("Reject this request", "The requester sees that it was rejected, with your reason.", "Reject", { action: "reject" }, true, "Request rejected.")}>Reject…</button></>}
      {["pending_approval", "approved", "scheduled", "queued", "retry_scheduled", "leased", "running"].includes(d.status) &&
        <button type="button" className="sc-button sc-quiet" onClick={() => act("Cancel this execution", d.status === "running" ? "It is running now. It will be asked to stop; if it finishes first it is reported as completed, never falsely as cancelled." : "It will not run.", "Cancel execution", { action: "cancel" }, true, d.status === "running" ? "Stop requested." : "Execution cancelled.", true)}>{d.cancelRequested ? "Stop requested" : "Cancel…"}</button>}
      {(d.status === "failed" || d.status === "dead_lettered") && d.failureClass !== "invalid_payload" &&
        <button type="button" className="sc-button" onClick={() => act("Retry under current policy", "The same execution re-enters today's policy: if approval is required it returns to your approval queue first. Its idempotency key is unchanged.", "Retry", { action: "retry" }, false, "Retry requested.")}>Retry…</button>}
      {d.status === "ambiguous" && <>
        <button type="button" className="sc-button" onClick={() => act("Record as completed", "Confirm you checked the underlying records and the operation did take effect.", "Record completed", { action: "reconcile", outcome: "completed" }, true, "Reconciled as completed.")}>Reconcile: completed…</button>
        <button type="button" className="sc-button sc-quiet" onClick={() => act("Record as failed", "Confirm you checked and the operation did not take effect.", "Record failed", { action: "reconcile", outcome: "failed" }, true, "Reconciled as failed.")}>Reconcile: failed…</button></>}
    </div>
    {d.error && <p className="sc-error" role="note"><strong>{d.failureClass?.replaceAll("_", " ")}</strong>: {d.error}</p>}
    <div className="ae-split">
      <div>
        <dl className="ae-kv">
          <dt>Execution</dt><dd className="ae-mono">{d.id}</dd><dt>Correlation</dt><dd className="ae-mono">{d.correlationId}</dd>
          <dt>Origin</dt><dd>{d.origin}</dd><dt>Attempts</dt><dd>{d.attempts} of {d.maxAttempts}</dd><dt>Policy</dt><dd>v{d.policyVersion} · {d.policyDecision.rules?.join("; ")}</dd>
          <dt>Markets</dt><dd>{d.scope.markets?.join(", ") ?? "—"}</dd>
          <dt>Approval</dt><dd>{d.approval ? `${d.approval.by}, ${when(d.approval.at)} (valid until ${when(d.approval.expiresAt)})` : d.approvalRequired ? "Not yet approved" : "Not required by policy"}</dd>
          <dt>Created</dt><dd>{when(d.createdAt)}</dd><dt>Finished</dt><dd>{when(d.completedAt)}</dd>
        </dl>
        <h3 className="sc-h2" style={{ marginTop: 20 }}>Payload</h3><pre className="ae-pre">{JSON.stringify(d.payload, null, 2)}</pre>
        {d.result && <><h3 className="sc-h2" style={{ marginTop: 20 }}>Outcome</h3><p>{d.result.summary}</p><p className="sc-muted">Source: {d.result.source}</p>
          {d.result.findings?.length ? <ul className="ae-findings">{d.result.findings.map((f, i) => <li key={i}><strong>{f.count}</strong> · {f.explanation} <br />{f.recommendedAction} <Link className="sc-link" href={f.href}>Open</Link></li>)}</ul> : null}</>}
      </div>
      <div><h3 className="sc-h2">Timeline</h3><ol className="ae-timeline">{d.events.map((e, i) =>
        <li key={i}><strong>{e.event.replaceAll("_", " ")}</strong>{e.to && e.from !== e.to ? ` → ${STATE_LABEL[e.to as ExecutionState] ?? e.to}` : ""} <span className="sc-muted">by {e.actorKind === "founder" ? "a founder" : e.actorRef ?? e.actorKind}</span><time>{when(e.occurredAt)}</time></li>)}</ol>
        {d.related.length > 0 && <><h3 className="sc-h2" style={{ marginTop: 20 }}>Same correlation</h3><ul className="sc-muted">{d.related.map((r) => <li key={r.id} className="ae-mono">{r.id.slice(0, 8)} · {title(r.actionType)} · {r.status}</li>)}</ul></>}</div>
    </div>
  </section>
}

function DefinitionCard({ def, control, ask, onDone }: { def: Definition; control?: Control; ask: Ask; onDone: (m: string) => Promise<void> }) {
  const [form, setForm] = useState({ intervalMinutes: def.intervalSeconds ? String(def.intervalSeconds / 60) : "", cooldownSeconds: String(def.cooldownSeconds), maxConcurrency: String(def.maxConcurrency), maxAttempts: String(def.maxAttempts), requiresApproval: def.requiresApproval, markets: def.marketScope.join(", ") })
  const [err, setErr] = useState("")
  const suspended = control?.suspended ?? false
  const save = (e: FormEvent) => {
    e.preventDefault(); setErr("")
    const patch = { intervalSeconds: form.intervalMinutes ? Math.round(Number(form.intervalMinutes) * 60) : null, cooldownSeconds: Number(form.cooldownSeconds), maxConcurrency: Number(form.maxConcurrency), maxAttempts: Number(form.maxAttempts),
      requiresApproval: form.requiresApproval, marketScope: form.markets.split(/[\s,]+/).filter(Boolean).map((m) => m.toUpperCase()) }
    ask({ heading: `Change ${def.spec.title}`, body: "Saving creates a new policy version. Any execution approved under the old version will be refused before it runs and must be requested again.", confirm: "Save new policy", needsReason: false,
      run: async () => { await call({ action: "definition", actionType: def.actionType, patch }); await onDone("Policy saved as a new version.") } })
  }
  return <article className="ae-card" aria-labelledby={`def-${def.actionType}`}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><h3 id={`def-${def.actionType}`}>{def.spec.title}</h3>
      <span className="ae-badge" data-tone={suspended ? "bad" : def.enabled ? "good" : "muted"}>{suspended ? "Suspended" : def.enabled ? "Enabled" : "Disabled"}</span></div>
    <p className="sc-muted">{def.spec.description}</p><p className="sc-muted"><strong>Effects:</strong> {def.spec.effects}</p>
    <dl className="ae-kv"><dt>Schedule</dt><dd>{def.intervalSeconds ? `every ${seconds(def.intervalSeconds)}` : "On request only"}</dd><dt>Approval</dt><dd>{def.requiresApproval ? `Required (valid ${seconds(def.approvalTtlSeconds)})` : "Not required"}</dd>
      <dt>Limits</dt><dd>{def.maxConcurrency} at once · {def.maxAttempts} attempts · {def.timeoutSeconds}s timeout · {seconds(def.cooldownSeconds)} cooldown</dd><dt>Markets</dt><dd>{def.marketScope.join(", ")}</dd>
      <dt>Policy</dt><dd>v{def.policyVersion}</dd><dt>Last run</dt><dd>{ago(def.lastRun)} · {def.runsLastWeek} this week</dd></dl>
    <div className="sc-head-actions">
      <button type="button" className="sc-button sc-quiet" onClick={() => ask({ heading: def.enabled ? "Disable automation" : "Enable automation", body: def.enabled ? "No new request or schedule will be accepted." : "Requests and schedules will be accepted under the current policy.", confirm: def.enabled ? "Disable" : "Enable", needsReason: false,
        run: async () => { await call({ action: "definition", actionType: def.actionType, patch: { enabled: !def.enabled } }); await onDone(def.enabled ? "Automation disabled." : "Automation enabled.") } })}>{def.enabled ? "Disable" : "Enable"}</button>
      <button type="button" className="sc-button sc-quiet" onClick={() => ask({ heading: suspended ? "Resume this automation" : "Suspend this automation", body: suspended ? "Its queued work may start again." : "No execution of this automation will start; queued work waits.", confirm: suspended ? "Resume" : "Suspend", danger: !suspended, needsReason: true,
        run: async (reason) => { await call({ action: "control", scope: `action:${def.actionType}`, suspended: !suspended, reason, expectedVersion: control?.version }); await onDone(suspended ? "Automation resumed." : "Automation suspended.") } })}>{suspended ? "Resume…" : "Suspend…"}</button>
      <button type="button" className="sc-button" disabled={!def.enabled} title={def.enabled ? undefined : "Enable the automation first"} onClick={() => ask({ heading: `Run ${def.spec.title} now`, body: `It runs with default settings in ${def.marketScope.join(", ")}.${def.requiresApproval ? " It will wait for founder approval first." : ""}`, confirm: "Request run", needsReason: false,
        run: async () => { await call({ action: "submit", actionType: def.actionType }); await onDone(def.requiresApproval ? "Requested; awaiting approval." : "Queued for the next worker.") } })}>Request a run…</button>
    </div>
    <details className="sc-rules"><summary>Edit policy</summary>
      <form className="ae-form" onSubmit={save}>
        <label className="sc-field"><span>Every (minutes, blank = on request)</span><input inputMode="numeric" value={form.intervalMinutes} onChange={(e) => setForm({ ...form, intervalMinutes: e.target.value })} /></label>
        <label className="sc-field"><span>Cooldown (seconds)</span><input inputMode="numeric" value={form.cooldownSeconds} onChange={(e) => setForm({ ...form, cooldownSeconds: e.target.value })} /></label>
        <label className="sc-field"><span>At once (1-8)</span><input inputMode="numeric" value={form.maxConcurrency} onChange={(e) => setForm({ ...form, maxConcurrency: e.target.value })} /></label>
        <label className="sc-field"><span>Attempts (1-10)</span><input inputMode="numeric" value={form.maxAttempts} onChange={(e) => setForm({ ...form, maxAttempts: e.target.value })} /></label>
        <label className="sc-field"><span>Markets</span><input value={form.markets} onChange={(e) => setForm({ ...form, markets: e.target.value })} /></label>
        <label className="ae-check"><input type="checkbox" checked={form.requiresApproval} onChange={(e) => setForm({ ...form, requiresApproval: e.target.checked })} />Founder approval required</label>
        {err && <p className="sc-error sc-full" role="alert">{err}</p>}
        <div><button type="submit" className="sc-button">Save policy…</button></div>
      </form></details>
  </article>
}

function WorkersPanel({ data, ask, onDone }: { data: Overview; ask: Ask; onDone: (m: string) => Promise<void> }) {
  const [form, setForm] = useState({ name: "", kind: "worker" as "worker" | "agent", actions: [] as string[] })
  const [secret, setSecret] = useState<{ name: string; token: string } | null>(null), [err, setErr] = useState("")
  const create = async (e: FormEvent) => {
    e.preventDefault(); setErr("")
    try {
      const capabilities = form.kind === "worker" ? ["worker.execute"] : ["operations.submit", "operations.read", "operations.cancel"]
      const r = await call<{ name: string; token: string }>({ action: "identity_create", name: form.name, kind: form.kind, capabilities, allowedActions: form.actions })
      setSecret({ name: r.name, token: r.token }); setForm({ name: "", kind: "worker", actions: [] }); await onDone("Identity created. Copy its token now.")
    } catch (x) { setErr((x as Error).message) }
  }
  return <>
    <section className="sc-panel" aria-labelledby="ae-workers"><h2 id="ae-workers" className="sc-h2">Workers</h2>
      {data.workers.length === 0 ? <p className="sc-empty">No worker has reported yet. Start the ASCEND worker process with a worker identity (see the B2.8 runbook).</p> :
        <div className="sc-table-wrap"><table className="sc-table"><thead><tr><th scope="col">Worker</th><th scope="col">Identity</th><th scope="col">Version</th><th scope="col">Health</th><th scope="col">Last heartbeat</th><th scope="col">Load</th></tr></thead>
          <tbody>{data.workers.map((w) => <tr key={w.id}><td className="ae-mono">{w.id}</td><td>{w.identity}{!w.identityActive && " (revoked)"}</td><td>{w.version}</td>
            <td><span className="ae-badge" data-tone={!w.identityActive ? "bad" : w.stale ? "bad" : w.status === "active" ? "good" : "muted"}>{!w.identityActive ? "Revoked" : w.stale ? "Stale" : w.status}</span></td>
            <td>{ago(w.lastHeartbeatAt)}</td><td>{w.inFlight}/{w.maxConcurrency} lanes · {w.leases} lease(s)</td></tr>)}</tbody></table></div>}
    </section>
    <section className="sc-panel" aria-labelledby="ae-ids"><h2 id="ae-ids" className="sc-h2">Service identities</h2>
      <p className="sc-muted">Machine identities for the worker and future TITAN OS or Jarvis agents. None can approve work, change controls or manage identities. Tokens are shown once and stored only as a digest.</p>
      {secret && <div className="ae-secret" role="status"><strong>Token for {secret.name}. Copy it now: it will not be shown again.</strong><code className="ae-mono">{secret.token}</code>
        <div className="sc-head-actions"><button type="button" className="sc-button" onClick={() => navigator.clipboard?.writeText(secret.token)}>Copy token</button><button type="button" className="sc-button sc-quiet" onClick={() => setSecret(null)}>I have stored it</button></div></div>}
      {data.identities.length === 0 ? <p className="sc-empty">No service identities yet.</p> : <ul className="sc-queue">{data.identities.map((i) =>
        <li key={i.id} className="sc-item"><div><p className="sc-kind">{i.kind} <span className="ae-badge" data-tone={i.active ? "good" : "bad"}>{i.active ? "Active" : "Revoked"}</span></p><p className="sc-title">{i.name}</p>
          <p className="sc-muted">{i.capabilities.join(", ")} · {i.allowedActions.length ? `${i.kind === "worker" ? "may execute" : "may request"}: ${i.allowedActions.map(title).join(", ")}` : i.kind === "worker" ? "may execute nothing (no automations assigned)" : "may request nothing"} · created {when(i.createdAt)}{i.rotatedAt ? ` · rotated ${when(i.rotatedAt)}` : ""}</p></div>
          {i.active && <div className="sc-item-actions">
            <button type="button" className="sc-button sc-quiet" onClick={() => ask({ heading: `Rotate ${i.name}`, body: "The current token stops working immediately. Update the worker or agent configuration with the new token.", confirm: "Rotate token", needsReason: false,
              run: async () => { const r = await call<{ name: string; token: string }>({ action: "identity_rotate", id: i.id }); setSecret({ name: r.name, token: r.token }); await onDone("Token rotated. Copy the new token now.") } })}>Rotate…</button>
            <button type="button" className="sc-button sc-quiet" onClick={() => ask({ heading: `Revoke ${i.name}`, body: "Revocation is immediate and permanent. Its workers stop and its pending operations will not run.", confirm: "Revoke identity", danger: true, needsReason: true,
              run: async (reason) => { await call({ action: "identity_revoke", id: i.id, reason }); await onDone("Identity revoked.") } })}>Revoke…</button></div>}</li>)}</ul>}
      <form onSubmit={create} style={{ marginTop: 20 }}><h3 className="sc-h2">Create an identity</h3>
        <div className="ae-form">
          <label className="sc-field"><span>Name</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase() })} pattern="[a-z][a-z0-9-]{2,62}" required placeholder="ascend-worker-1" /></label>
          <label className="sc-field"><span>Kind</span><select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as "worker" | "agent" })}><option value="worker">Worker (executes work)</option><option value="agent">Agent (requests work)</option></select></label>
        </div>
        <fieldset style={{ border: 0, padding: 0, margin: "10px 0" }}><legend className="sc-muted">{form.kind === "worker" ? "Automations this worker may execute (at least one; it claims nothing else)" : "Automations this agent may request"}</legend>
          {Object.values(ACTION_REGISTRY).map((s) => <label key={s.type} className="ae-check"><input type="checkbox" checked={form.actions.includes(s.type)} onChange={(e) => setForm({ ...form, actions: e.target.checked ? [...form.actions, s.type] : form.actions.filter((a) => a !== s.type) })} />{s.title}</label>)}</fieldset>
        {err && <p className="sc-error" role="alert">{err}</p>}
        <p><button type="submit" className="sc-button">Create identity</button></p>
      </form>
    </section>
  </>
}
