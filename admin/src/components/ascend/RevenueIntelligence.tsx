"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import { FORECAST_STAGES, gbp, MAX_HORIZON_MONTHS, parseAssumptions, pct, project, SCENARIO_LABELS, SCENARIOS, STAGE_LABELS, type Assumptions, type ForecastStage, type Scenario } from "@/lib/revenue-forecast"
import "./command.css"
import "./revenue.css"

type Projection = ReturnType<typeof project>
type Data = {
  generatedAt: string
  actual: {
    collectedPence: string; reversalsPence: string; partnerAttributedPence: string; recurringCollectedPence: string; oneOffBuildCollectedPence: string
    byCategory: { category: string; pence: string }[]; byMonth: { month: string; pence: string }[]; outstandingInvoicedPence: string; outstandingInvoices: number
    monthlyRecurringPence: string; retainedClients: number; commission: { earnedPence: string; paidPence: string; liabilityPence: string }
  }
  forecastInputs: {
    stageCounts: Record<ForecastStage, number>; history: { basisPoints: number | null; closed: number; reason: string | null }; minClosedOutcomes: number
    acceptedContracts: number; historicalAverageOneOffPence: string | null; commandCentreExpected: { count: number; pence: string; note: string }
  }
  scenarios: { scenario: Scenario; assumptions: Assumptions | null; saved: { version: number; rationale: string; by: string | null; at: string } | null; projection: Projection | null }[]
}
const CATEGORY_LABELS: Record<string, string> = { retainer: "Retainer", premium_partnership: "Premium partnership", website_build: "Website build", growth_audit: "Growth audit", performance: "Performance" }
const monthLabel = (m: string) => new Date(`${m}-01T12:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
const toBp = (v: string) => Math.round(Number(v) * 100)
const toPence = (v: string) => { const m = /^\s*(\d{1,10})(?:\.(\d{1,2}))?\s*$/.exec(v); return m ? (BigInt(m[1]) * BigInt(100) + BigInt((m[2] ?? "0").padEnd(2, "0"))).toString() : "" }
const penceToInput = (p: string) => { const b = BigInt(p); return `${b / BigInt(100)}.${(b % BigInt(100)).toString().padStart(2, "0")}` }

/** Operation Ascend B2.4. Actual figures come from verified records; projections are hypothetical and labelled as such. */
export function RevenueIntelligence() {
  const [data, setData] = useState<Data | null>(null), [error, setError] = useState(""), [n, setN] = useState(0), [tab, setTab] = useState<Scenario>("baseline")
  const reload = useCallback(() => setN((x) => x + 1), [])
  useEffect(() => {
    const c = new AbortController()
    setError("")
    fetch("/api/expansion/revenue", { cache: "no-store", signal: c.signal })
      .then(async (r) => { const b = await r.json(); if (!r.ok) throw new Error(b.error || "Revenue intelligence is unavailable."); setData(b) })
      .catch((e: Error) => { if (e.name !== "AbortError") setError(e.message) })
    return () => c.abort()
  }, [n])
  const maxMonth = useMemo(() => (data ? data.actual.byMonth.reduce((m, r) => (BigInt(r.pence) > m ? BigInt(r.pence) : m), BigInt(0)) : BigInt(0)), [data])

  return <main className="sc rv" aria-labelledby="rv-title">
    <header className="sc-head">
      <div><p className="sc-overline">Operation Ascend</p><h1 id="rv-title">Revenue intelligence</h1>
        <p className="sc-lede">Actual revenue from verified records, kept apart from hypothetical projections. Nothing on this page writes to payments, invoices, contracts or the commission ledger.</p></div>
      <div className="sc-head-actions"><Link className="sc-link" href="/expansion/command">Sales command centre</Link><button type="button" className="sc-button sc-quiet" onClick={reload}>Refresh</button></div>
    </header>
    {error ? <div className="sc-error" role="alert"><p>{error}</p><button type="button" className="sc-button sc-quiet" onClick={reload}>Try again</button></div>
      : !data ? <p className="sc-muted" role="status">Loading…</p> : <>
      <section aria-labelledby="rv-actual" className="sc-panel rv-actual">
        <p className="rv-badge rv-badge-actual">Actual · verified records</p>
        <h2 id="rv-actual" className="sc-h2">Revenue to date</h2>
        <dl className="sc-metrics">
          <div><dt>Verified collected revenue</dt><dd>{gbp(data.actual.collectedPence)}</dd><dd className="sc-note">All recorded payments, net of {gbp(BigInt(data.actual.reversalsPence) < BigInt(0) ? (-BigInt(data.actual.reversalsPence)).toString() : "0")} reversals</dd></div>
          <div><dt>Outstanding invoiced</dt><dd>{gbp(data.actual.outstandingInvoicedPence)}</dd><dd className="sc-note">Issued, not yet paid ({data.actual.outstandingInvoices} {data.actual.outstandingInvoices === 1 ? "invoice" : "invoices"}). Not revenue until collected.</dd></div>
          <div><dt>Recurring collected</dt><dd>{gbp(data.actual.recurringCollectedPence)}</dd><dd className="sc-note">Retainer and premium partnership payments</dd></div>
          <div><dt>One-off builds collected</dt><dd>{gbp(data.actual.oneOffBuildCollectedPence)}</dd><dd className="sc-note">Website build payments</dd></div>
          <div><dt>Partner-attributed collected</dt><dd>{gbp(data.actual.partnerAttributedPence)}</dd><dd className="sc-note">Payments verified against a partner contract</dd></div>
          <div><dt>Contracted monthly recurring</dt><dd>{gbp(data.actual.monthlyRecurringPence)}</dd><dd className="sc-note">Active confirmed contracts ({data.actual.retainedClients} {data.actual.retainedClients === 1 ? "client" : "clients"}); contracted, not collected</dd></div>
          <div><dt>Commission earned</dt><dd>{gbp(data.actual.commission.earnedPence)}</dd><dd className="sc-note">Commission ledger, including adjustments</dd></div>
          <div><dt>Commission paid</dt><dd>{gbp(data.actual.commission.paidPence)}</dd><dd className="sc-note">Settled payouts</dd></div>
          <div><dt>Commission liability</dt><dd>{gbp(data.actual.commission.liabilityPence)}</dd><dd className="sc-note">Earned less paid</dd></div>
        </dl>
        <div className="rv-split">
          <div><h3 className="rv-h3">By service</h3>
            <table className="sc-table rv-table"><thead><tr><th scope="col">Service</th><th scope="col">Collected</th></tr></thead>
              <tbody>{data.actual.byCategory.map((c) => <tr key={c.category}><th scope="row">{CATEGORY_LABELS[c.category] ?? c.category}</th><td>{gbp(c.pence)}</td></tr>)}</tbody></table></div>
          <div><h3 className="rv-h3">By month (last 12, London time)</h3>
            {data.actual.byMonth.length ? <table className="sc-table rv-table"><thead><tr><th scope="col">Month</th><th scope="col">Collected</th><th scope="col"><span className="rv-sr">Share of the largest month</span></th></tr></thead>
              <tbody>{data.actual.byMonth.map((m) => <tr key={m.month}><th scope="row">{monthLabel(m.month)}</th><td>{gbp(m.pence)}</td>
                <td aria-hidden="true"><span className="rv-bar" style={{ width: `${maxMonth > BigInt(0) && BigInt(m.pence) > BigInt(0) ? Number((BigInt(m.pence) * BigInt(100)) / maxMonth) : 0}%` }} /></td></tr>)}</tbody></table>
              : <p className="sc-empty">No payments recorded in the last twelve months.</p>}</div>
        </div>
      </section>

      <section aria-labelledby="rv-forecast" className="sc-panel rv-forecast">
        <p className="rv-badge rv-badge-forecast">Projection · hypothetical, not money earned</p>
        <h2 id="rv-forecast" className="sc-h2">Forecast</h2>
        <p className="sc-muted">Each scenario is pipeline value weighted by your stage assumptions plus contracted recurring revenue reduced by your retention assumption. Every assumption is shown. Changing a figure below updates the projection on this page only; saving records a new version of the assumptions and changes nothing else.</p>
        <dl className="rv-inputs">
          {FORECAST_STAGES.map((s) => <div key={s}><dt>{STAGE_LABELS[s]} now</dt><dd>{data.forecastInputs.stageCounts[s]}</dd></div>)}
          <div><dt>Historical conversion</dt><dd>{data.forecastInputs.history.basisPoints === null ? "Not enough history" : pct(data.forecastInputs.history.basisPoints)}</dd></div>
        </dl>
        {data.forecastInputs.history.reason && <p className="sc-muted">{data.forecastInputs.history.reason} The probabilities below are your assumptions, not observed rates.</p>}
        <p className="sc-muted">{data.forecastInputs.historicalAverageOneOffPence ? `Average one-off value of ${data.forecastInputs.acceptedContracts} accepted partner contracts: ${gbp(data.forecastInputs.historicalAverageOneOffPence)}.` : `Accepted partner contracts so far: ${data.forecastInputs.acceptedContracts}; an average value is shown from ${data.forecastInputs.minClosedOutcomes}.`}</p>
        {data.forecastInputs.commandCentreExpected.count > 0 && <p className="sc-muted">{gbp(data.forecastInputs.commandCentreExpected.pence)} across {data.forecastInputs.commandCentreExpected.count} expected payments. {data.forecastInputs.commandCentreExpected.note}</p>}
        <div role="tablist" aria-label="Scenario" className="rv-tabs">
          {SCENARIOS.map((s) => <button key={s} role="tab" id={`rv-tab-${s}`} aria-selected={tab === s} aria-controls={`rv-panel-${s}`} tabIndex={tab === s ? 0 : -1} type="button"
            onClick={() => setTab(s)} onKeyDown={(e) => { const i = SCENARIOS.indexOf(s); const next = e.key === "ArrowRight" ? SCENARIOS[(i + 1) % 3] : e.key === "ArrowLeft" ? SCENARIOS[(i + 2) % 3] : null; if (next) { e.preventDefault(); setTab(next); document.getElementById(`rv-tab-${next}`)?.focus() } }}>{SCENARIO_LABELS[s]}</button>)}
        </div>
        {SCENARIOS.map((s) => <div key={s} role="tabpanel" id={`rv-panel-${s}`} aria-labelledby={`rv-tab-${s}`} hidden={tab !== s}>
          {tab === s && <ScenarioPanel key={`${s}-${data.scenarios.find((x) => x.scenario === s)?.saved?.version ?? 0}`} data={data} scenario={s} onSaved={reload} />}
        </div>)}
      </section>
    </>}
  </main>
}

function ScenarioPanel({ data, scenario, onSaved }: { data: Data; scenario: Scenario; onSaved: () => void }) {
  const current = data.scenarios.find((x) => x.scenario === scenario)!
  const a = current.assumptions
  const [form, setForm] = useState({
    qualified: a ? String(a.stageBasisPoints.qualified / 100) : "", scope_submitted: a ? String(a.stageBasisPoints.scope_submitted / 100) : "", approved: a ? String(a.stageBasisPoints.approved / 100) : "",
    value: a ? penceToInput(a.averageValuePence) : "", retention: a ? String(a.monthlyRetentionBasisPoints / 100) : "", horizon: a ? String(a.horizonMonths) : "3", rationale: "",
  })
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("")
  const candidate = useMemo(() => parseAssumptions({ scenario, stageBasisPoints: { qualified: toBp(form.qualified), scope_submitted: toBp(form.scope_submitted), approved: toBp(form.approved) },
    averageValuePence: toPence(form.value), monthlyRetentionBasisPoints: toBp(form.retention), horizonMonths: Number(form.horizon) }), [form, scenario])
  const whatIf = candidate.ok ? project({ stageCounts: data.forecastInputs.stageCounts, monthlyRecurringPence: data.actual.monthlyRecurringPence, assumptions: candidate.value }) : null
  const changed = !!a && candidate.ok && JSON.stringify(candidate.value) !== JSON.stringify(a)
  const field = (k: keyof typeof form) => ({ value: form[k], onChange: (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value })) })
  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || !candidate.ok) return
    setBusy(true); setError(""); setNotice("")
    try {
      const r = await fetch("/api/expansion/revenue", { method: "POST", headers: { "content-type": "application/json" }, cache: "no-store", body: JSON.stringify({ action: "save_assumptions", ...candidate.value, rationale: form.rationale }) })
      const b = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(b.error || "The assumptions were not saved.")
      setNotice(`Saved as version ${b.result.version}.`); onSaved()
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }
  return <div className="rv-scenario">
    {current.saved ? <p className="sc-muted">Saved version {current.saved.version}{current.saved.by ? ` by ${current.saved.by}` : ""} on {new Date(current.saved.at).toLocaleDateString("en-GB")}: “{current.saved.rationale}”</p>
      : <p className="sc-muted">No assumptions saved for this scenario. Enter your own to see a projection; ScaleSmiths does not supply default rates.</p>}
    <form className="rv-form" onSubmit={save} aria-label={`${SCENARIO_LABELS[scenario]} assumptions`}>
      {FORECAST_STAGES.map((s) => <label key={s} className="sc-field"><span>{STAGE_LABELS[s]}: chance of acceptance (%)</span><input inputMode="decimal" required {...field(s)} /></label>)}
      <label className="sc-field"><span>Assumed average contract value (£)</span><input inputMode="decimal" required {...field("value")} /></label>
      <label className="sc-field"><span>Recurring revenue kept each month (%)</span><input inputMode="decimal" required {...field("retention")} /></label>
      <label className="sc-field"><span>Horizon (months, 1–{MAX_HORIZON_MONTHS})</span><input inputMode="numeric" required {...field("horizon")} /></label>
      <label className="sc-field sc-grow"><span>Why these assumptions (recorded with the version)</span><input required minLength={3} maxLength={1000} {...field("rationale")} /></label>
      <button type="submit" className="sc-button" disabled={busy || !candidate.ok}>{busy ? "Saving…" : "Save as new version"}</button>
    </form>
    <p className="sc-muted" role="status" aria-live="polite">{busy ? "Saving…" : notice}</p>
    {error && <p className="sc-error" role="alert">{error}</p>}
    {!candidate.ok && Object.values(form).some(Boolean) && <p className="sc-muted">{candidate.problem}</p>}
    {whatIf && <div className="rv-projection" aria-label={`${SCENARIO_LABELS[scenario]} projection`}>
      <p className="rv-total"><span>{changed ? "What-if projection (not saved)" : "Projection"}</span><strong>{gbp(whatIf.totalPence)}</strong></p>
      <table className="sc-table rv-table"><thead><tr><th scope="col">Component</th><th scope="col">Projected</th><th scope="col">How it is calculated</th></tr></thead>
        <tbody>{whatIf.lines.map((l) => <tr key={l.label}><th scope="row">{l.label}</th><td>{gbp(l.pence)}</td><td>{l.explanation}</td></tr>)}</tbody></table>
    </div>}
  </div>
}
