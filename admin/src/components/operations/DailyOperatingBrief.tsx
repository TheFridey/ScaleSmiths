"use client"

import Link from "next/link"
import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import type { OperatingBrief, OperatingBriefRecommendation } from "@/lib/operating-brief"

export function DailyOperatingBrief({ brief }: { brief: OperatingBrief }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>, item: OperatingBriefRecommendation, status: "dismissed" | "completed" | "snoozed") {
    event.preventDefault()
    setBusy(`${status}:${item.key}`)
    setError(null)
    const form = event.currentTarget
    const body = Object.fromEntries(new FormData(form).entries())
    const response = await fetch("/api/operations/brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, key: item.key, evidenceHash: item.evidenceHash, status }),
    })
    setBusy(null)
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null
      setError(payload?.error ?? "Unable to update brief item.")
      return
    }
    router.refresh()
  }

  const highestValue = brief.recommendations.find((item) => item.category === "highest_value_action")

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4">
      <header className="space-y-2">
        <p className="text-sm text-cyan-300">Operations</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-syne text-3xl font-bold">Daily operating brief</h1>
            <p className="max-w-3xl text-sm text-t2">Concise priorities from live admin records. No invented urgency; every recommendation links to evidence.</p>
          </div>
          <div className="rounded border border-b1 bg-s1 px-4 py-3 text-sm text-t2">
            Generated {new Date(brief.generatedAt).toLocaleString("en-GB")}
            {brief.suppressedCount > 0 && <div>{brief.suppressedCount} dismissed/completed/snoozed item(s) hidden</div>}
          </div>
        </div>
      </header>

      <section className="rounded border border-cyan-400/25 bg-cyan-400/10 p-4">
        <h2 className="font-semibold">Today’s highest-value action</h2>
        <p className="mt-1 text-sm text-t2">{highestValue?.title ?? brief.headline}</p>
        {highestValue && <p className="mt-2 text-sm">{highestValue.recommendedAction}</p>}
      </section>

      {error && <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</div>}

      <section className="space-y-3">
        {brief.recommendations.length === 0 ? (
          <div className="rounded border border-b1 bg-s1 p-5 text-sm text-t2">No urgent operating issues were found in current records.</div>
        ) : brief.recommendations.map((item) => (
          <BriefCard key={`${item.key}:${item.evidenceHash}`} item={item} busy={busy} onSubmit={submit} />
        ))}
      </section>

      <section className="rounded border border-b1 bg-s1 p-4">
        <h2 className="font-semibold">What can safely wait</h2>
        <div className="mt-3 space-y-2">
          {brief.safelyWaiting.length === 0 ? <p className="text-sm text-t3">No low-risk wait items were identified.</p> : brief.safelyWaiting.map((item) => (
            <div key={`${item.key}:${item.evidenceHash}`} className="rounded border border-b1 bg-s2 p-3">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-sm text-t2">{item.summary}</p>
                </div>
                <Badge value={`${item.confidence} confidence`} tone="low" />
              </div>
              <EvidenceLinks evidence={item.evidence} />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function BriefCard({ item, busy, onSubmit }: { item: OperatingBriefRecommendation; busy: string | null; onSubmit: (event: FormEvent<HTMLFormElement>, item: OperatingBriefRecommendation, status: "dismissed" | "completed" | "snoozed") => Promise<void> }) {
  return (
    <article className="rounded border border-b1 bg-s1 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge value={item.priority} tone={item.priority} />
            <Badge value={`${item.confidence} confidence`} tone={item.confidence === "high" ? "low" : "medium"} />
            <span className="text-xs text-t3">{item.category.replaceAll("_", " ")}</span>
          </div>
          <h2 className="mt-2 font-syne text-xl font-bold">{item.title}</h2>
          <p className="mt-1 text-sm text-t2">{item.summary}</p>
        </div>
        <div className="text-right text-xs text-t3">Score {item.score}</div>
      </div>

      <p className="mt-3 text-sm font-semibold">{item.recommendedAction}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-t2">
        {item.reasoning.map((reason) => <li key={reason}>{reason}</li>)}
      </ul>
      <EvidenceLinks evidence={item.evidence} />

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        <ActionForm label="Complete" status="completed" item={item} busy={busy} onSubmit={onSubmit} />
        <ActionForm label="Dismiss" status="dismissed" item={item} busy={busy} onSubmit={onSubmit} />
        <ActionForm label="Snooze" status="snoozed" item={item} busy={busy} onSubmit={onSubmit} />
      </div>
    </article>
  )
}

function ActionForm({ label, status, item, busy, onSubmit }: { label: string; status: "dismissed" | "completed" | "snoozed"; item: OperatingBriefRecommendation; busy: string | null; onSubmit: (event: FormEvent<HTMLFormElement>, item: OperatingBriefRecommendation, status: "dismissed" | "completed" | "snoozed") => Promise<void> }) {
  return (
    <form onSubmit={(event) => void onSubmit(event, item, status)} className="rounded border border-b1 bg-s2 p-2">
      {status === "snoozed" && <input name="snoozedUntil" type="date" className="mb-2 w-full rounded border border-b1 bg-s1 px-2 py-1 text-sm" />}
      <input name="reason" placeholder="Optional note" className="mb-2 w-full rounded border border-b1 bg-s1 px-2 py-1 text-sm" />
      <button disabled={busy === `${status}:${item.key}`} className="w-full rounded bg-cyan-300 px-2 py-1.5 text-sm font-bold text-slate-950 disabled:opacity-60">
        {busy === `${status}:${item.key}` ? "Saving..." : label}
      </button>
    </form>
  )
}

function EvidenceLinks({ evidence }: { evidence: OperatingBriefRecommendation["evidence"] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {evidence.map((item) => (
        <Link key={`${item.recordType}:${item.recordId}`} href={item.href} className="rounded border border-b1 bg-s2 px-2 py-1 text-xs text-cyan-200 hover:text-cyan-100">
          {item.label}: {item.summary}
        </Link>
      ))}
    </div>
  )
}

function Badge({ value, tone }: { value: string; tone: string }) {
  const cls = tone === "critical" || tone === "high" ? "border-red-400/30 bg-red-400/10 text-red-100" : tone === "medium" ? "border-amber-400/30 bg-amber-400/10 text-amber-100" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
  return <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${cls}`}>{value}</span>
}
