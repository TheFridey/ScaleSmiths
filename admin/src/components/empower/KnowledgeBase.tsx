"use client"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { AcademyShell, type PartnerNav } from "./AcademyShell"

type Entry = {
  itemId: string; slug: string; audience: string; version: number; question: string; answer: string; clientExplanation: string | null; limitations: string
  escalation: { required: string; condition: string | null; route: string | null }; topic: string | null; sources: string[]; approvedAt: string | null; reviewBy: string | null
  related: { title: string; href: string }[]
}
const ROUTE_LABELS: Record<string, string> = { technical_scoping: "Technical scoping", bespoke_discovery: "Bespoke discovery", commercial_assistance: "Commercial assistance", joint_sales: "Joint sales meeting", proposal_review: "Proposal review", training: "Training", escalation: "Escalation" }
const topicLabel = (t: string) => t.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()).replace(/\bseo\b/i, "SEO").replace(/\bdns\b/i, "DNS").replace(/\bcrm\b/i, "CRM").replace(/\bai\b/i, "AI")

/** Sends an ordinary partner meeting request. Nothing is booked until ScaleSmiths confirms a time. */
function RequestHelp({ route, purpose, context }: { route: string | null; purpose: string; context: string }) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState(route ?? "technical_scoping")
  const [when, setWhen] = useState("")
  const [note, setNote] = useState("")
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  async function send(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setState(null)
    try {
      const r = await fetch("/api/partner", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "request_meeting", meetingType: type, preferredSlots: [new Date(when).toISOString()], timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London", purpose: purpose.slice(0, 2000), context: [context, note].filter(Boolean).join("\n").slice(0, 4000) }) })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body.error || "The request was not sent.")
      setState({ ok: true, text: "Request sent. ScaleSmiths will confirm a time, suggest another or ask for more information. Nothing is booked yet." })
    } catch (err) { setState({ ok: false, text: (err as Error).message }) } finally { setBusy(false) }
  }
  if (!open) return <button type="button" className="ac-button ac-secondary" onClick={() => setOpen(true)}>Request help from ScaleSmiths</button>
  return <form className="ac-check" onSubmit={send} aria-label="Request help from ScaleSmiths">
    <label className="ac-field">Type of help<select value={type} onChange={(e) => setType(e.target.value)}>{Object.entries(ROUTE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
    <label className="ac-field">A time that suits you<input type="datetime-local" required value={when} onChange={(e) => setWhen(e.target.value)} /></label>
    <label className="ac-field">Anything ScaleSmiths should know (optional)<input value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder="Business name, what the client asked, any deadline" /></label>
    <button className="ac-button" type="submit" disabled={busy || !when}>{busy ? "Sending…" : "Send request"}</button>
    {state && <p className={state.ok ? "ac-feedback ac-right" : "ac-error"} role={state.ok ? "status" : "alert"}>{state.text}</p>}
  </form>
}

function EntryCard({ e, open }: { e: Entry; open: boolean }) {
  const [copied, setCopied] = useState("")
  const shareable = e.audience === "client_facing" && !!e.clientExplanation
  const escalate = e.escalation.required !== "never"
  return <details className="ac-card ac-entry" open={open} data-entry={e.slug}>
    <summary><h3>{e.question}</h3><span className="ac-meta"><span className="ac-chip">{e.topic ? topicLabel(e.topic) : "General"}</span><span>Approved v{e.version} · review by {e.reviewBy}</span></span></summary>
    {e.clientExplanation ? <section className="ac-say" aria-label="Say to the client">
      <p className="ac-overline">{shareable ? "Say to the client" : "Partner only: do not share"}</p>
      <p className="ac-say-text">{e.clientExplanation}</p>
      {shareable && <button type="button" className="ac-button ac-secondary" onClick={async () => { try { await navigator.clipboard.writeText(e.clientExplanation!); setCopied("Copied.") } catch { setCopied("Copy was blocked by the browser.") } }}>Copy</button>}
      <span className="ac-muted" aria-live="polite">{copied}</span>
    </section> : <p className="ac-ribbon">Partner only: do not discuss with clients</p>}
    <h4>The precise answer</h4><p>{e.answer}</p>
    <h4>Limitation</h4><p>{e.limitations}</p>
    <h4>When to escalate</h4>
    <p>{e.escalation.required === "always" ? `Always: request ${ROUTE_LABELS[e.escalation.route ?? ""] ?? "help"}.` : e.escalation.required === "when" ? `When ${e.escalation.condition}: request ${ROUTE_LABELS[e.escalation.route ?? ""] ?? "help"}.` : "No escalation needed for this question."}</p>
    {escalate && <RequestHelp route={e.escalation.route} purpose={`Help with a client question: ${e.question}`} context={`Knowledge entry ${e.slug}, approved version ${e.version}.`} />}
    {e.related.length > 0 && <p>Related: {e.related.map((r, i) => <span key={r.href}>{i ? ", " : ""}<Link href={r.href}>{r.title}</Link></span>)}</p>}
    <p className="ac-muted">Sources: {e.sources.join(" · ")}</p>
  </details>
}

export function KnowledgeBase({ nav }: { nav: PartnerNav }) {
  const [query, setQuery] = useState("")
  const [submitted, setSubmitted] = useState("")
  const [topic, setTopic] = useState("all")
  const [data, setData] = useState<{ entries: Entry[]; topics: string[] } | null>(null)
  const [error, setError] = useState("")
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { input.current?.focus() }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") { e.preventDefault(); input.current?.focus() } }
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey)
  }, [])
  useEffect(() => {
    const controller = new AbortController(), params = new URLSearchParams()
    if (submitted) params.set("q", submitted)
    if (topic !== "all") params.set("topic", topic)
    setError("")
    fetch(`/api/partner/knowledge?${params}`, { signal: controller.signal, cache: "no-store" })
      .then(async (r) => { const body = await r.json(); if (!r.ok) throw new Error(body.error || "The Knowledge Base could not be loaded."); setData(body) })
      .catch((e: Error) => { if (e.name !== "AbortError") setError(e.message) })
    return () => controller.abort()
  }, [submitted, topic])
  return <AcademyShell current="knowledge" nav={nav}>
    <section className="ac-hero" aria-labelledby="kb-title">
      <p className="ac-overline">Knowledge Base</p>
      <h1 id="kb-title">What is the client asking?</h1>
      <p>Approved answers to the questions prospects actually ask: what to say, what not to stretch it to mean, and when to bring ScaleSmiths in. Type the question the way the client asked it. Press <kbd>/</kbd> to search from anywhere on this page.</p>
      <form className="ac-filters" role="search" onSubmit={(e) => { e.preventDefault(); setSubmitted(query.trim()) }}>
        <label className="ac-field">Search approved answers<input ref={input} type="search" value={query} maxLength={200} onChange={(e) => setQuery(e.target.value)} placeholder="For example: do you do hosting?" /></label>
        <button className="ac-button" type="submit">Search</button>
      </form>
      {data && data.topics.length > 0 && <div className="ac-meta" role="group" aria-label="Filter by topic">
        <button type="button" className="ac-chip" aria-pressed={topic === "all"} onClick={() => setTopic("all")}>All topics</button>
        {data.topics.map((t) => <button key={t} type="button" className="ac-chip" aria-pressed={topic === t} onClick={() => setTopic(t)}>{topicLabel(t)}</button>)}
      </div>}
    </section>
    {error && <p className="ac-error" role="alert">{error}</p>}
    <section className="ac-section" aria-labelledby="kb-results"><h2 id="kb-results" className="sr-only">Results</h2>
      <p className="ac-muted" aria-live="polite">{data ? `${data.entries.length} approved answer${data.entries.length === 1 ? "" : "s"}${submitted ? ` for “${submitted}”` : ""}` : "Loading…"}</p>
      {data && !data.entries.length && <div className="ac-empty"><p><strong>No approved answer yet.</strong> Do not improvise: ask ScaleSmiths and they will give you a proper answer.</p>
        <RequestHelp route="technical_scoping" purpose={`A client asked a question with no approved answer${submitted ? `: ${submitted}` : ""}`} context="Raised from the Knowledge Base after a search with no approved answer." /></div>}
      {data && data.entries.length > 0 && <div className="ac-kb-list">{data.entries.map((e, i) => <EntryCard key={e.slug} e={e} open={i === 0} />)}</div>}
    </section>
  </AcademyShell>
}
