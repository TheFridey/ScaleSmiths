"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import type { ClientAnalyticsSummary } from "@/lib/client-analytics"
import type { ContinuousOptimisationProposal, StoredOptimisationProposal } from "@/lib/continuous-optimisation"
import type { WebsiteOutcomeEvaluation, WebsiteOutcomeFinding } from "@/lib/website-outcome-evaluator"

export function ClientAnalyticsDashboard({ clientId, summary, outcome, optimisation }: { clientId: number; summary: ClientAnalyticsSummary; outcome?: WebsiteOutcomeEvaluation | null; optimisation?: { generated: ContinuousOptimisationProposal[]; stored: StoredOptimisationProposal[] } | null }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function addConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy("config")
    setError(null)
    const form = event.currentTarget
    const data = Object.fromEntries(new FormData(form).entries())
    const response = await fetch(`/api/clients/${clientId}/analytics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: data.provider,
        displayName: data.displayName,
        propertyId: data.propertyId,
        sourceAttribution: data.sourceAttribution,
        retentionDays: data.retentionDays,
        consentGranted: data.consentGranted === "on",
        enabled: data.enabled === "on",
        consentNotes: data.consentNotes,
        credentials: data.manualMetricDate ? { metrics: [{ metricDate: data.manualMetricDate, sessions: Number(data.sessions || 0), conversionEvents: Number(data.conversionEvents || 0), formSubmissions: Number(data.formSubmissions || 0), phoneClicks: Number(data.phoneClicks || 0), ctaClicks: Number(data.ctaClicks || 0), rawSummary: { provider: "manual", note: "Manual seed metric" } }] } : null,
      }),
    })
    setBusy(null)
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null
      setError(payload?.error ?? "Unable to save analytics connection.")
      return
    }
    form.reset()
    router.refresh()
  }

  async function ingest(configId: number) {
    setBusy(`ingest:${configId}`)
    setError(null)
    const response = await fetch(`/api/clients/${clientId}/analytics`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "ingest", configId }) })
    setBusy(null)
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null
      setError(payload?.error ?? "Unable to ingest analytics.")
      return
    }
    router.refresh()
  }

  async function optimisationAction(body: Record<string, unknown>) {
    setBusy(String(body.action))
    setError(null)
    const response = await fetch(`/api/clients/${clientId}/analytics`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    setBusy(null)
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null
      setError(payload?.error ?? "Unable to update optimisation proposal.")
      return
    }
    router.refresh()
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4">
      <header>
        <h1 className="font-syne text-3xl font-bold">Client analytics</h1>
        <p className="mt-1 max-w-3xl text-sm text-t2">Privacy-conscious daily rollups only. No unknown tracking beacon is installed by ScaleSmiths from this screen.</p>
      </header>
      {error && <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</div>}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Sessions" value={maybe(summary.totals.sessions)} />
        <Metric label="Conversions" value={maybe(summary.totals.conversionEvents)} />
        <Metric label="Forms / phone / CTA" value={`${maybe(summary.totals.formSubmissions)} / ${maybe(summary.totals.phoneClicks)} / ${maybe(summary.totals.ctaClicks)}`} />
        <Metric label="Search clicks" value={maybe(summary.totals.searchClicks)} />
        <Metric label="Search impressions" value={maybe(summary.totals.searchImpressions)} />
        <Metric label="Uptime" value={summary.totals.uptimePercent === null ? "Missing" : `${summary.totals.uptimePercent}%`} />
        <Metric label="LCP / INP" value={`${summary.totals.lcpP75Ms ?? "—"} / ${summary.totals.inpP75Ms ?? "—"} ms`} />
        <Metric label="Errors" value={maybe(summary.totals.errorCount)} />
      </section>

      {summary.missingData.length > 0 && <section className="rounded border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100"><h2 className="font-semibold">Missing data</h2><ul className="mt-2 list-disc pl-5">{summary.missingData.map((item) => <li key={item}>{item}</li>)}</ul></section>}

      <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded border border-b1 bg-s1 p-4">
          <h2 className="font-semibold">Connected sources</h2>
          <div className="mt-3 space-y-3">
            {summary.configs.length === 0 ? <p className="text-sm text-t3">No analytics sources configured.</p> : summary.configs.map((config) => (
              <article key={config.id} className="rounded border border-b1 bg-s2 p-3">
                <div className="flex flex-wrap justify-between gap-2">
                  <div><p className="font-semibold">{config.displayName}</p><p className="text-xs text-t3">{config.provider} · {config.sourceAttribution}</p></div>
                  <span className={`rounded-full border px-2 py-1 text-xs ${config.enabled && config.consentGranted ? "border-emerald-400/30 text-emerald-100" : "border-amber-400/30 text-amber-100"}`}>{config.enabled && config.consentGranted ? "enabled" : "disabled/no consent"}</span>
                </div>
                <p className="mt-2 text-sm text-t2">Retention {config.retentionDays} days · credentials {config.hasCredentials ? "stored encrypted" : "not stored"} · last ingest {config.lastIngestedAt ? new Date(config.lastIngestedAt).toLocaleString("en-GB") : "never"}</p>
                <button onClick={() => void ingest(config.id)} disabled={busy === `ingest:${config.id}` || !config.enabled || !config.consentGranted} className="mt-2 rounded bg-cyan-300 px-3 py-1.5 text-sm font-bold text-slate-950 disabled:opacity-60">{busy === `ingest:${config.id}` ? "Ingesting..." : "Run ingest"}</button>
              </article>
            ))}
          </div>
        </div>

        <form onSubmit={(event) => void addConfig(event)} className="rounded border border-b1 bg-s1 p-4">
          <h2 className="font-semibold">Add analytics source</h2>
          <p className="mt-1 text-sm text-t2">Use manual seed metrics or connect a provider adapter. Credentials are never returned to the browser.</p>
          <Select name="provider" label="Provider" options={["manual", "google_search_console", "google_analytics", "plausible", "uptime", "core_web_vitals", "custom"]} />
          <Field name="displayName" label="Display name" required />
          <Field name="propertyId" label="Property / site id" />
          <Field name="sourceAttribution" label="Source attribution" required placeholder="e.g. Manual import from client GA4 screenshot" />
          <Field name="retentionDays" label="Retention days" type="number" defaultValue="395" />
          <label className="mt-3 flex gap-2 text-sm"><input name="consentGranted" type="checkbox" /> Consent granted</label>
          <label className="mt-1 flex gap-2 text-sm"><input name="enabled" type="checkbox" /> Enable ingestion</label>
          <Field name="consentNotes" label="Consent notes" />
          <div className="mt-4 rounded border border-b1 bg-s2 p-3">
            <p className="text-sm font-semibold">Optional manual seed metric</p>
            <Field name="manualMetricDate" label="Date" type="date" />
            <Field name="sessions" label="Sessions" type="number" />
            <Field name="conversionEvents" label="Conversions" type="number" />
            <Field name="formSubmissions" label="Forms" type="number" />
            <Field name="phoneClicks" label="Phone clicks" type="number" />
            <Field name="ctaClicks" label="CTA clicks" type="number" />
          </div>
          <button disabled={busy === "config"} className="mt-3 rounded bg-cyan-300 px-3 py-2 text-sm font-bold text-slate-950 disabled:opacity-60">{busy === "config" ? "Saving..." : "Save source"}</button>
        </form>
      </section>

      <section className="rounded border border-b1 bg-s1 p-4">
        <h2 className="font-semibold">Source attribution</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm"><thead className="text-t3"><tr><th>Source</th><th>Attribution</th><th>Sessions</th><th>Conversions</th><th>Last metric</th></tr></thead><tbody>{summary.bySource.map((row) => <tr key={`${row.source}:${row.attribution}`} className="border-t border-b1"><td className="py-2">{row.source}</td><td>{row.attribution}</td><td>{maybe(row.sessions)}</td><td>{maybe(row.conversions)}</td><td>{row.lastMetricAt ? new Date(row.lastMetricAt).toLocaleDateString("en-GB") : "—"}</td></tr>)}</tbody></table>
        </div>
      </section>

      {outcome && (
        <section className="space-y-4">
          <div className="rounded border border-cyan-400/25 bg-cyan-400/10 p-4">
            <h2 className="font-semibold">Website outcome evaluation</h2>
            <p className="mt-1 text-sm text-t2">Overall confidence: {outcome.overallConfidence}. No causal claims are made; findings are tied to approved post-launch records.</p>
            <p className="mt-2 text-sm">Intended conversion strategy: {outcome.intendedConversionStrategy ?? "Not confirmed"}</p>
          </div>
          <OutcomeGroup title="Strong evidence" items={outcome.strongEvidence} />
          <OutcomeGroup title="Weak signals" items={outcome.weakSignals} />
          <OutcomeGroup title="Hypotheses" items={outcome.hypotheses} />
          <OutcomeGroup title="Recommended investigations" items={outcome.recommendedInvestigations} />
          <OutcomeGroup title="Suggested improvements" items={outcome.suggestedImprovements} />
          <OutcomeGroup title="Required client decisions" items={outcome.requiredClientDecisions} />
          <OutcomeGroup title="Incomplete or biased data" items={outcome.incompleteOrBiasedData} />
        </section>
      )}

      {optimisation && (
        <section className="space-y-4">
          <div className="rounded border border-b1 bg-s1 p-4">
            <h2 className="font-semibold">Continuous optimisation proposals</h2>
            <p className="mt-1 text-sm text-t2">Controlled retainer proposals only. Accepting a proposal records approval; it does not alter the live website.</p>
          </div>
          <OptimisationList
            title="New generated proposals"
            generated={optimisation.generated}
            stored={[]}
            busy={busy}
            onAction={optimisationAction}
          />
          <OptimisationList
            title="Tracked proposals"
            generated={[]}
            stored={optimisation.stored}
            busy={busy}
            onAction={optimisationAction}
          />
        </section>
      )}
    </div>
  )
}

function OptimisationList({ title, generated, stored, busy, onAction }: { title: string; generated: ContinuousOptimisationProposal[]; stored: StoredOptimisationProposal[]; busy: string | null; onAction: (body: Record<string, unknown>) => Promise<void> }) {
  const items = [...generated, ...stored]
  return (
    <section className="rounded border border-b1 bg-s1 p-4">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-3 space-y-3">
        {items.length === 0 ? <p className="text-sm text-t3">No proposals in this category.</p> : items.map((item) => {
          const storedItem = isStoredProposal(item) ? item : null
          return (
            <article key={item.key} className="rounded border border-b1 bg-s2 p-3">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-xs text-t3">{item.confidence} confidence · {item.estimatedEffort} · {item.risk} risk · metric {item.targetMetric}</p>
                </div>
                {storedItem && <span className="rounded-full border border-b1 px-2 py-1 text-xs text-t2">{storedItem.status}{storedItem.improved !== null ? storedItem.improved ? " · improved" : " · no improvement" : ""}</span>}
              </div>
              <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                <Info label="Evidence" value={item.evidence.map((evidence) => `${evidence.label}: ${evidence.value ?? evidence.sourceAttribution}`).join("; ") || "Evidence gap noted."} />
                <Info label="Expected impact" value={item.expectedImpact} />
                <Info label="Proposed change" value={item.proposedChange} />
                <Info label="Validation" value={item.validationMethod} />
                <Info label="Rollback" value={item.rollbackPlan} />
                <Info label="Approval" value={item.requiredApproval} />
              </dl>
              <p className="mt-2 text-xs text-t3">Relevant pages: {item.relevantPages.join(", ")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {!storedItem ? (
                  <button disabled={busy === "store_optimisation"} onClick={() => void onAction({ action: "store_optimisation", key: item.key })} className="rounded bg-cyan-300 px-3 py-1.5 text-sm font-bold text-slate-950 disabled:opacity-60">Track proposal</button>
                ) : (
                  <>
                    <button onClick={() => void onAction({ action: "optimisation_status", proposalId: storedItem.id, status: "accepted" })} className="rounded bg-emerald-300 px-3 py-1.5 text-sm font-bold text-slate-950">Accept</button>
                    <button onClick={() => void onAction({ action: "optimisation_status", proposalId: storedItem.id, status: "rejected" })} className="rounded bg-amber-300 px-3 py-1.5 text-sm font-bold text-slate-950">Reject</button>
                    <button onClick={() => void onAction({ action: "optimisation_status", proposalId: storedItem.id, status: "completed" })} className="rounded bg-cyan-300 px-3 py-1.5 text-sm font-bold text-slate-950">Mark completed</button>
                    <MeasureForm proposal={storedItem} onAction={onAction} />
                  </>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function isStoredProposal(item: ContinuousOptimisationProposal | StoredOptimisationProposal): item is StoredOptimisationProposal {
  return "id" in item
}

function MeasureForm({ proposal, onAction }: { proposal: StoredOptimisationProposal; onAction: (body: Record<string, unknown>) => Promise<void> }) {
  return (
    <form onSubmit={(event) => {
      event.preventDefault()
      const data = Object.fromEntries(new FormData(event.currentTarget).entries())
      void onAction({ action: "optimisation_measure", proposalId: proposal.id, measuredValue: data.measuredValue, notes: data.notes })
      event.currentTarget.reset()
    }} className="flex flex-wrap gap-2">
      <input name="measuredValue" type="number" step="0.0001" placeholder="Measured value" className="rounded border border-b1 bg-s1 px-2 py-1 text-sm" />
      <input name="notes" placeholder="Outcome notes" className="rounded border border-b1 bg-s1 px-2 py-1 text-sm" />
      <button className="rounded bg-white px-3 py-1.5 text-sm font-bold text-slate-950">Record outcome</button>
    </form>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs uppercase tracking-[0.16em] text-t3">{label}</dt><dd className="mt-1 text-t2">{value}</dd></div>
}

function OutcomeGroup({ title, items }: { title: string; items: WebsiteOutcomeFinding[] }) {
  return (
    <section className="rounded border border-b1 bg-s1 p-4">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-3 space-y-3">
        {items.length === 0 ? <p className="text-sm text-t3">No findings in this category.</p> : items.map((item, index) => (
          <article key={`${item.category}:${index}`} className="rounded border border-b1 bg-s2 p-3">
            <div className="flex flex-wrap justify-between gap-2">
              <p className="font-semibold">{item.conclusion}</p>
              <span className="rounded-full border border-b1 px-2 py-1 text-xs text-t2">{item.severity} · {item.confidence}</span>
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-t2">{item.reasoning.map((reason) => <li key={reason}>{reason}</li>)}</ul>
            <div className="mt-3 flex flex-wrap gap-2">
              {item.evidence.map((evidence) => <a key={`${evidence.recordType}:${evidence.recordId}:${evidence.metric ?? ""}`} href={evidence.href} className="rounded border border-b1 px-2 py-1 text-xs text-cyan-200">{evidence.label}: {evidence.value ?? evidence.sourceAttribution}</a>)}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded border border-b1 bg-s1 p-4"><p className="text-xs uppercase tracking-[0.18em] text-t3">{label}</p><p className="mt-2 font-syne text-2xl font-bold">{value}</p></div> }
function Field({ label, name, type = "text", required = false, defaultValue, placeholder }: { label: string; name: string; type?: string; required?: boolean; defaultValue?: string; placeholder?: string }) { return <label className="mt-3 block text-sm text-t2">{label}<input className="mt-1 w-full rounded border border-b1 bg-s2 px-3 py-2 text-t1" name={name} type={type} required={required} defaultValue={defaultValue} placeholder={placeholder} /></label> }
function Select({ label, name, options }: { label: string; name: string; options: string[] }) { return <label className="mt-3 block text-sm text-t2">{label}<select className="mt-1 w-full rounded border border-b1 bg-s2 px-3 py-2 text-t1" name={name}>{options.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}</select></label> }
function maybe(value: number | null) { return value === null ? "Missing" : value.toLocaleString("en-GB") }
