"use client"

import Link from "next/link"
import { useState } from "react"
import "./guidance.css"

export type GuidanceItem = {
  type: "answer" | "resource" | "lesson" | "course"; title: string; summary: string; category: string | null
  audience: "client_facing" | "partner_only"; approvedAt: string | null; reviewBy: string | null; href: string; copy: string | null
}
export const TYPE_LABELS: Record<GuidanceItem["type"], string> = { answer: "Knowledge Base answer", resource: "Resource", lesson: "Academy lesson", course: "Academy course" }
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : null)
const pretty = (s: string | null) => (s ? s.replaceAll("-", " ").replace(/^./, (c) => c.toUpperCase()) : null)

/** One approved item. Copy is offered only when the server marked text as client-safe; nothing else is ever copied. */
export function GuidanceCard({ item }: { item: GuidanceItem }) {
  const [copied, setCopied] = useState("")
  async function copy() {
    if (!item.copy) return
    try { await navigator.clipboard.writeText(item.copy); setCopied("Copied client-safe text.") }
    catch { setCopied("Copy was blocked by the browser. Select the text and copy it instead.") }
  }
  const approved = day(item.approvedAt)
  return <article className="gd-card" data-type={item.type}>
    <div className="gd-meta">
      <span className="gd-type">{TYPE_LABELS[item.type]}</span>
      {item.category && <span className="gd-chip">{pretty(item.category)}</span>}
      <span className={item.audience === "client_facing" ? "gd-aud gd-aud-client" : "gd-aud"}>{item.audience === "client_facing" ? "Client-safe" : "Partner only"}</span>
    </div>
    <h3 className="gd-title"><Link href={item.href}>{item.title}</Link></h3>
    {item.summary && <p className="gd-summary">{item.summary}</p>}
    {item.copy && <div className="gd-copy">
      <p className="gd-copy-label">Client-safe wording</p>
      <p className="gd-copy-text">{item.copy}</p>
      <div className="gd-copy-actions"><button type="button" className="gd-button" onClick={copy}>Copy</button><span role="status" aria-live="polite" className="gd-muted">{copied}</span></div>
    </div>}
    <p className="gd-fresh">{approved ? `Approved ${approved}` : "Approved"}{item.reviewBy ? ` · next review ${item.reviewBy}` : ""}</p>
  </article>
}

export function GuidanceList({ items, empty }: { items: GuidanceItem[]; empty: React.ReactNode }) {
  if (!items.length) return <div className="gd-empty">{empty}</div>
  return <div className="gd-list">{items.map((i) => <GuidanceCard key={`${i.type}:${i.href}`} item={i} />)}</div>
}
