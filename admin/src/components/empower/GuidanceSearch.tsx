"use client"

import { useEffect, useRef, useState } from "react"
import { AcademyShell, type PartnerNav } from "./AcademyShell"
import { GuidanceList, TYPE_LABELS, type GuidanceItem } from "./GuidanceCard"
import "./guidance.css"

type Result = { query: string | null; type: string | null; available: { answers: boolean; resources: boolean; academy: boolean }; results: GuidanceItem[] }
const FILTERS: { key: string; label: string; needs: keyof Result["available"] | null }[] = [
  { key: "all", label: "Everything", needs: null }, { key: "answer", label: "Questions and answers", needs: "answers" },
  { key: "resource", label: "Professional resources", needs: "resources" }, { key: "lesson", label: TYPE_LABELS.lesson + "s", needs: "academy" }, { key: "course", label: TYPE_LABELS.course + "s", needs: "academy" },
]

/** One search across approved answers, resources and learning. Deterministic ranking; no generated text. */
export function GuidanceSearch({ nav }: { nav: PartnerNav }) {
  const [query, setQuery] = useState(""), [submitted, setSubmitted] = useState(""), [type, setType] = useState("all")
  const [data, setData] = useState<Result | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState(""), [attempt, setAttempt] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q")?.slice(0, 200).trim()
    if (q) { setQuery(q); setSubmitted(q) }
    input.current?.focus()
  }, [])
  useEffect(() => {
    const c = new AbortController(), p = new URLSearchParams()
    if (submitted) p.set("q", submitted)
    if (type !== "all") p.set("type", type)
    setLoading(true); setError("")
    fetch(`/api/partner/workspace?${p}`, { cache: "no-store", signal: c.signal })
      .then(async (r) => { const b = await r.json(); if (!r.ok) throw new Error(b.error || "Search is unavailable."); setData(b) })
      .catch((e: Error) => { if (e.name !== "AbortError") setError(e.message) })
      .finally(() => { if (!c.signal.aborted) setLoading(false) })
    return () => c.abort()
  }, [submitted, type, attempt])
  const filters = FILTERS.filter((f) => !f.needs || data?.available[f.needs])
  return <AcademyShell current="guidance" nav={nav}>
    <section className="ac-hero" aria-labelledby="gd-title">
      <p className="ac-overline">Find guidance</p>
      <h1 id="gd-title">What do you need to know?</h1>
      <p>Search every approved answer, resource and Academy course in one place. Results are founder-approved and within their review date; anything marked client-safe can be copied for a client.</p>
      <form className="gd-search" role="search" onSubmit={(e) => { e.preventDefault(); setSubmitted(query.trim()); setAttempt((n) => n + 1) }}>
        <label>Search approved guidance<input ref={input} type="search" value={query} maxLength={200} onChange={(e) => setQuery(e.target.value)} placeholder="For example: do you do hosting?" /></label>
        <button className="gd-button" type="submit">Search</button>
      </form>
      <div className="gd-filters" role="group" aria-label="Filter by type">{filters.map((f) => <button key={f.key} type="button" className="gd-filter" aria-pressed={type === f.key} onClick={() => setType(f.key)}>{f.label}</button>)}</div>
    </section>
    {error && <div className="gd-error" role="alert"><p>{error}</p><button type="button" className="gd-button gd-button-quiet" onClick={() => setAttempt((n) => n + 1)}>Try again</button></div>}
    <section className="ac-section" aria-labelledby="gd-results" aria-busy={loading}>
      <h2 id="gd-results">{data?.query ? `Results for “${data.query}”` : "Recently approved"}</h2>
      <p className="gd-muted" role="status">{loading ? "Searching approved guidance…" : data ? `${data.results.length} result${data.results.length === 1 ? "" : "s"}` : ""}</p>
      {loading && !data ? <div className="gd-skeleton" aria-hidden="true"><span /><span /><span /></div>
        : data && <GuidanceList items={data.results} empty={<p><strong>No approved guidance matches.</strong> Try different words, or ask ScaleSmiths rather than guessing an answer for a client.</p>} />}
    </section>
  </AcademyShell>
}
