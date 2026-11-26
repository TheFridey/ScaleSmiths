"use client"
import Link from "next/link"
import { useEffect, useState } from "react"
import { AcademyShell, type PartnerNav } from "./AcademyShell"

type Resource = { slug: string; title: string; summary: string; category: string | null; audience: string; version: number | null; approvedAt: string | null; reviewBy: string | null; publishedAt: string | null; legacy: boolean }
export const RESOURCE_CATEGORY_LABELS: Record<string, string> = { brochure: "Brochures", guide: "Guides", checklist: "Checklists", template: "Templates", reference: "References" }
const date = (value: string | null) => value ? new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""
export const audienceLabel = (audience: string) => audience === "client_facing" ? "Client-facing · approved for sharing" : "Partner only · do not share"

function ResourceRow({ r }: { r: Resource }) {
  return <li className="ac-card ac-resource" data-resource={r.slug}>
    <span className="ac-overline">{r.legacy ? "Earlier library" : RESOURCE_CATEGORY_LABELS[r.category ?? ""] ?? "Resource"}</span>
    <h3><Link href={`/partner/resources/${r.slug}`}>{r.title}</Link></h3>
    {r.summary && <p>{r.summary}</p>}
    <div className="ac-meta">
      <span className={`ac-chip ${r.audience === "client_facing" ? "ac-done" : ""}`}>{audienceLabel(r.audience)}</span>
      {r.legacy ? <span className="ac-chip">Legacy, read only</span> : <span>Version {r.version} · approved {date(r.approvedAt)} · review by {r.reviewBy}</span>}
    </div>
  </li>
}

export function ResourceCentre({ nav }: { nav: PartnerNav }) {
  const [query, setQuery] = useState("")
  const [submitted, setSubmitted] = useState("")
  const [category, setCategory] = useState("all")
  const [audience, setAudience] = useState("all")
  const [data, setData] = useState<{ resources: Resource[]; legacy: Resource[] } | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams()
    if (submitted) params.set("q", submitted)
    if (category !== "all") params.set("category", category)
    if (audience !== "all") params.set("audience", audience)
    setBusy(true); setError("")
    fetch(`/api/partner/resources?${params}`, { signal: controller.signal, cache: "no-store" })
      .then(async (r) => { const body = await r.json(); if (!r.ok) throw new Error(body.error || "The Resource Centre could not be loaded."); setData(body) })
      .catch((e: Error) => { if (e.name !== "AbortError") setError(e.message) })
      .finally(() => setBusy(false))
    return () => controller.abort()
  }, [submitted, category, audience])
  const all = data ? [...data.resources, ...data.legacy] : []
  return <AcademyShell current="resources" nav={nav} contentState={data || error ? "ready" : "loading"}>
    <section className="ac-hero" aria-labelledby="resources-title">
      <p className="ac-overline">Resource Centre</p>
      <h1 id="resources-title">Approved material, ready when you need it.</h1>
      <p>Every resource here has been approved by ScaleSmiths. Each one tells you whether you may share it with a client. If what you need is not here, ask ScaleSmiths rather than writing your own.</p>
    </section>
    <section className="ac-section" aria-labelledby="find">
      <h2 id="find">Find a resource</h2>
      <form className="ac-filters" role="search" onSubmit={(e) => { e.preventDefault(); setSubmitted(query.trim()) }}>
        <label className="ac-field">Search approved resources<input type="search" value={query} maxLength={200} onChange={(e) => setQuery(e.target.value)} placeholder="For example: hosting, SSL, migration, follow-up email" /></label>
        <label className="ac-field">Category<select value={category} onChange={(e) => setCategory(e.target.value)}><option value="all">All categories</option>{Object.entries(RESOURCE_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="ac-field">Audience<select value={audience} onChange={(e) => setAudience(e.target.value)}><option value="all">All</option><option value="client_facing">Client-facing</option><option value="partner_only">Partner only</option></select></label>
        <button className="ac-button" type="submit">Search</button>
      </form>
      {error && <p className="ac-error" role="alert">{error}</p>}
      <p className="ac-muted" aria-live="polite">{busy ? "Searching…" : data ? `${all.length} resource${all.length === 1 ? "" : "s"}${submitted ? ` for “${submitted}”` : ""}` : ""}</p>
      {data && !all.length && <div className="ac-empty">{submitted ? "No approved resource matches that search. Try different words, or ask ScaleSmiths." : "No resources have been published yet."}</div>}
      {all.length > 0 && <ul className="ac-grid ac-list-reset">{all.map((r) => <ResourceRow key={r.slug} r={r} />)}</ul>}
    </section>
    <section className="ac-section ac-help" aria-labelledby="resources-help"><h2 id="resources-help">Using resources well</h2>
      <p>Share only resources marked <strong>client-facing</strong>, and always the current version. Partner-only resources are for your preparation. Never edit an approved resource before sending it; if something needs changing, tell ScaleSmiths.</p></section>
  </AcademyShell>
}
