"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { AcademyShell, type PartnerNav } from "./AcademyShell"
import { RequestHelp, ROUTE_LABELS } from "./KnowledgeBase"

type Related = { kind: "resource" | "lesson" | "knowledge"; title: string; href: string }
type Response = {
  itemId: string; slug: string; version: number; title: string; category: string | null; concern: string; clientLine: string; guidance: string
  limitation: string; discoveryQuestions: string[]; escalation: { required: string; condition: string | null; route: string | null }
  sources: string[]; approvedAt: string | null; publishedAt: string | null; reviewBy: string | null; related: Related[]
}
type Result = { query: string | null; category: string | null; mode: "search" | "category" | "recent"; categories: { key: string; count: number }[]; entries: Response[] }

const CATEGORY_LABELS: Record<string, string> = {
  price: "Price", "existing-supplier": "Existing supplier", "competitor-comparison": "Competitor comparison", "website-migration": "Website migration",
  seo: "SEO", "ai-search": "AI search", hosting: "Hosting", maintenance: "Maintenance", "contract-length": "Contract length", "payment-schedules": "Payment schedules",
  "data-security": "Data security", "bespoke-development": "Bespoke development", "delivery-times": "Delivery times", "commercial-eligibility": "Commercial eligibility",
  "decision-timing": "Timing and readiness", ownership: "Ownership", "partner-independence": "Your independence",
}
const categoryLabel = (c: string | null) => (c ? CATEGORY_LABELS[c] ?? c : "General")
const RELATED_LABELS = { resource: "Resource", lesson: "Academy lesson", knowledge: "Knowledge Base" } as const
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—")

function ResponseCard({ r, open }: { r: Response; open: boolean }) {
  const [copied, setCopied] = useState("")
  async function copy() {
    try { await navigator.clipboard.writeText(r.clientLine); setCopied("Copied the client-safe response.") }
    catch { setCopied("Copy was blocked by the browser. Select the text and copy it instead.") }
  }
  const escalate = r.escalation.required !== "never"
  const route = ROUTE_LABELS[r.escalation.route ?? ""] ?? "help"
  return <details className="ac-card ac-entry ac-objection" open={open} data-objection={r.slug}>
    <summary>
      <h3>“{r.concern}”</h3>
      <span className="ac-meta"><span className="ac-chip">{categoryLabel(r.category)}</span><span>Approved v{r.version} · reviewed {day(r.approvedAt)} · next review {r.reviewBy ?? "—"}</span></span>
    </summary>
    <section className="ac-say" aria-label="Recommended response, client-safe">
      <p className="ac-overline">Recommended response · safe to say to the client</p>
      <p className="ac-say-text">{r.clientLine}</p>
      <div className="ac-say-actions">
        <button type="button" className="ac-button ac-secondary" onClick={copy}>Copy response</button>
        <span className="ac-muted" role="status" aria-live="polite">{copied}</span>
      </div>
    </section>
    <div className="ac-partner-only">
      <p className="ac-ribbon">Partner only: do not read out or send to the client</p>
      <h4>Why this response is appropriate</h4><p>{r.guidance}</p>
      {r.discoveryQuestions.length > 0 && <><h4>Discovery questions</h4><ul className="ac-questions">{r.discoveryQuestions.map((q) => <li key={q}>{q}</li>)}</ul></>}
      <h4>Limitations: do not promise</h4><p>{r.limitation}</p>
      <h4>When to bring in ScaleSmiths</h4>
      <p>{r.escalation.required === "always" ? `Always: request ${route}.` : r.escalation.required === "when" ? `When ${r.escalation.condition}: request ${route}.` : "No escalation is needed for this objection on its own."}</p>
      {escalate && <RequestHelp route={r.escalation.route} purpose={`Help with a client objection: ${r.concern}`} context={`Objection response ${r.slug}, approved version ${r.version}.`} />}
    </div>
    {r.related.length > 0 && <nav className="ac-related" aria-label={`Related material for ${r.concern}`}>
      <h4>Related material</h4>
      <ul>{r.related.map((x) => <li key={x.href}><span className="ac-chip">{RELATED_LABELS[x.kind]}</span> <Link href={x.href}>{x.title}</Link></li>)}</ul>
    </nav>}
    <p className="ac-muted ac-sources">Sources: {r.sources.join(" · ")}</p>
  </details>
}

export function ObjectionHandling({ nav }: { nav: PartnerNav }) {
  const [query, setQuery] = useState("")
  const [submitted, setSubmitted] = useState("")
  const [category, setCategory] = useState("all")
  const [data, setData] = useState<Result | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    // B1.7: unified guidance links here with ?q=<concern>; run that search on arrival, as the Knowledge Base does.
    const q = new URLSearchParams(window.location.search).get("q")?.slice(0, 200).trim()
    if (q) { setQuery(q); setSubmitted(q) }
    input.current?.focus()
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName ?? "")) { e.preventDefault(); input.current?.focus() } }
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey)
  }, [])
  useEffect(() => {
    const controller = new AbortController(), params = new URLSearchParams()
    if (submitted) params.set("q", submitted)
    if (category !== "all") params.set("category", category)
    setLoading(true); setError("")
    fetch(`/api/partner/objections?${params}`, { signal: controller.signal, cache: "no-store" })
      .then(async (r) => { const body = await r.json(); if (!r.ok) throw new Error(body.error || "Objection handling could not be loaded."); setData(body) })
      .catch((e: Error) => { if (e.name !== "AbortError") setError(e.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [submitted, category, attempt])
  const heading = data?.mode === "search" ? `Responses for “${data.query}”` : data?.mode === "category" ? categoryLabel(data.category) : "Recently approved responses"

  return <AcademyShell current="objections" nav={nav} contentState={data || error ? "ready" : "loading"}>
    <section className="ac-hero" aria-labelledby="obj-title">
      <p className="ac-overline">Objection handling</p>
      <h1 id="obj-title">What did the client say?</h1>
      <p>Founder-approved answers for real conversations: the words you can use, why they work, the questions to ask next, what not to promise, and when to bring ScaleSmiths in. Type the objection the way the client put it. Press <kbd>/</kbd> to search from anywhere on this page.</p>
      <form className="ac-filters" role="search" onSubmit={(e) => { e.preventDefault(); setSubmitted(query.trim()); setAttempt((n) => n + 1) }}>
        <label className="ac-field">Search approved responses<input ref={input} type="search" value={query} maxLength={200} onChange={(e) => setQuery(e.target.value)} placeholder="For example: it's too expensive" /></label>
        <button className="ac-button" type="submit">Search</button>
        {(submitted || category !== "all") && <button type="button" className="ac-button ac-secondary" onClick={() => { setQuery(""); setSubmitted(""); setCategory("all") }}>Clear</button>}
      </form>
      {data && data.categories.length > 0 && <div className="ac-meta ac-categories" role="group" aria-label="Filter by category">
        <button type="button" className="ac-chip" aria-pressed={category === "all"} onClick={() => setCategory("all")}>All</button>
        {data.categories.map((c) => <button key={c.key} type="button" className="ac-chip" aria-pressed={category === c.key} onClick={() => setCategory(c.key)}>{categoryLabel(c.key)} <span className="ac-count">{c.count}</span></button>)}
      </div>}
    </section>
    {error && <div className="ac-error" role="alert"><p>{error}</p><button type="button" className="ac-button ac-secondary" onClick={() => setAttempt((n) => n + 1)}>Try again</button></div>}
    <section className="ac-section" aria-labelledby="obj-results" aria-busy={loading}>
      <h2 id="obj-results">{heading}</h2>
      <p className="ac-muted" aria-live="polite">{loading ? "Loading approved responses…" : data ? `${data.entries.length} approved response${data.entries.length === 1 ? "" : "s"}` : ""}</p>
      {loading && !data && <div className="ac-skeleton-list" aria-hidden="true"><span /><span /><span /></div>}
      {data && !data.entries.length && <div className="ac-empty"><p><strong>No approved response yet.</strong> Don&apos;t improvise an answer to a commercial or technical objection: ask ScaleSmiths and they will help you respond properly.</p>
        <RequestHelp route="joint_sales" purpose={`A client raised an objection with no approved response${submitted ? `: ${submitted}` : ""}`} context="Raised from Objection handling after a search with no approved response." /></div>}
      {data && data.entries.length > 0 && <div className="ac-kb-list">{data.entries.map((r, i) => <ResponseCard key={r.slug} r={r} open={i === 0 && data.mode !== "recent"} />)}</div>}
    </section>
  </AcademyShell>
}
