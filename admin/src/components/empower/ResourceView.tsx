"use client"
import Link from "next/link"
import { useEffect, useState } from "react"
import { AcademyShell, type PartnerNav } from "./AcademyShell"
import { RESOURCE_CATEGORY_LABELS, audienceLabel } from "./ResourceCentre"
import { SafeMarkdown } from "./SafeMarkdown"

type Resource = { slug: string; title: string; summary: string; category: string | null; audience: string; version: number | null; approvedAt: string | null; reviewBy: string | null; legacy: boolean; body: string; sources: string[]; related: { kind: string; title: string; href: string }[] }

export function ResourceView({ slug, nav }: { slug: string; nav: PartnerNav }) {
  const [r, setR] = useState<Resource | null>(null)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState("")
  useEffect(() => {
    fetch(`/api/partner/resources?slug=${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then(async (res) => { const body = await res.json(); if (!res.ok) throw new Error(body.error || "This resource could not be loaded."); setR(body) })
      .catch((e: Error) => setError(e.message))
  }, [slug])
  async function copy() {
    if (!r) return
    try { await navigator.clipboard.writeText(r.body); setCopied("Copied. Paste it unchanged; it is the approved version.") } catch { setCopied("Copy was blocked by the browser. Use the download instead.") }
  }
  const shareable = r?.audience === "client_facing"
  return <AcademyShell current="resources" nav={nav}>
    <p><Link href="/partner/resources">← Back to the Resource Centre</Link></p>
    {error && <p className="ac-error" role="alert">{error}</p>}
    {!r && !error && <p className="ac-muted" role="status">Loading…</p>}
    {r && <article className="ac-lesson" aria-labelledby="resource-title">
      <span className="ac-ribbon">{audienceLabel(r.audience)}</span>
      <p className="ac-overline">{r.legacy ? "Earlier library" : RESOURCE_CATEGORY_LABELS[r.category ?? ""] ?? "Resource"}</p>
      <h1 id="resource-title" className="ac-resource-title">{r.title}</h1>
      <p className="ac-muted">{r.legacy ? "Legacy resource from the earlier library, shown read-only." : `Approved version ${r.version} · approved ${r.approvedAt?.slice(0, 10)} · review by ${r.reviewBy}`}</p>
      {r.summary && <p>{r.summary}</p>}
      <div className="ac-lesson-actions">
        <a className="ac-button ac-secondary" href={`/api/partner/resources?download=${encodeURIComponent(r.slug)}`} download>Download (text)</a>
        {shareable && <button type="button" className="ac-button" onClick={copy}>Copy for a client</button>}
      </div>
      <p className="ac-muted" aria-live="polite">{copied}</p>
      {r.legacy ? <p className="ac-prose" style={{ whiteSpace: "pre-wrap" }}>{r.body}</p> : <SafeMarkdown className="ac-prose" source={r.body} />}
      {r.sources.length > 0 && <p className="ac-muted">Sources: {r.sources.join(" · ")}</p>}
      {r.related.length > 0 && <section className="ac-section" aria-labelledby="related"><h2 id="related">Related</h2><ul>{r.related.map((x) => <li key={x.href}><Link href={x.href}>{x.title}</Link> <span className="ac-muted">({x.kind === "lesson" ? "Academy lesson" : "resource"})</span></li>)}</ul></section>}
    </article>}
  </AcademyShell>
}
