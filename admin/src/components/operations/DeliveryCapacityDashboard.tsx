"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import type { CapacityForecast, CapacityPeriod, DeliveryWorkItem } from "@/lib/delivery-capacity"

export function DeliveryCapacityDashboard({ forecast }: { forecast: CapacityForecast }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>, action: "capacity_adjustment" | "forecast_actual") {
    event.preventDefault()
    setBusy(action)
    setError(null)
    const form = event.currentTarget
    const body = Object.fromEntries(new FormData(form).entries())
    const response = await fetch("/api/operations/capacity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, action }),
    })
    setBusy(null)
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null
      setError(payload?.error ?? "Unable to save capacity update.")
      return
    }
    form.reset()
    router.refresh()
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <header className="space-y-2">
        <p className="text-sm text-cyan-300">Operations</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-syne text-3xl font-bold">Delivery capacity</h1>
            <p className="max-w-3xl text-sm text-t2">
              Forecasts confirmed work, probable sales work, Forge review effort, manual delivery, retainers and approval bottlenecks. Capacity is a planning signal, not a delivery guarantee.
            </p>
          </div>
          <div className="rounded border border-b1 bg-s1 px-4 py-3 text-sm text-t2">
            Generated {new Date(forecast.assumptions.generatedAt).toLocaleString("en-GB")}
          </div>
        </div>
      </header>

      {forecast.warnings.length > 0 && (
        <section className="rounded border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          <h2 className="font-semibold">Capacity warnings</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {forecast.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </section>
      )}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Active projects" value={forecast.activeProjects.length.toLocaleString()} detail={`${sum(forecast.activeProjects, "remainingHours")}h remaining`} />
        <Metric label="Probable work" value={forecast.probableIncomingWork.length.toLocaleString()} detail="Separated from confirmed commitments" />
        <Metric label="Awaiting clients" value={forecast.workAwaitingClients.length.toLocaleString()} detail={`${sum(forecast.workAwaitingClients, "remainingHours")}h may compress later`} />
        <Metric label="Internal approvals" value={forecast.workAwaitingInternalApproval.length.toLocaleString()} detail="Approval bottlenecks before progress" />
        <Metric label="Retainer obligations" value={`${sum(forecast.retainerObligations, "remainingHours")}h`} detail={`${forecast.retainerObligations.length} active retainers inferred`} />
        <Metric label="Single-person dependencies" value={forecast.singlePersonDependencies.length.toLocaleString()} detail="Needs cover or risk acceptance" />
        <Metric label="Manual workload" value={`${forecast.weekly[0]?.manualHours ?? 0}h`} detail="Current week manual effort" />
        <Metric label="Forge workload" value={`${forecast.weekly[0]?.forgeHours ?? 0}h`} detail="Current week automation/review effort" />
      </section>

      <section className="grid gap-4 2xl:grid-cols-2">
        <ForecastTable title="Weekly forecast" periods={forecast.weekly} />
        <ForecastTable title="Monthly forecast" periods={forecast.monthly} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <WorkList title="Active projects" items={forecast.activeProjects} />
        <WorkList title="Approval/client bottlenecks" items={[...forecast.workAwaitingInternalApproval, ...forecast.workAwaitingClients]} />
        <WorkList title="Probable incoming work" items={forecast.probableIncomingWork} />
        <WorkList title="Retainer obligations" items={forecast.retainerObligations} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={(event) => void submit(event, "capacity_adjustment")} className="rounded border border-b1 bg-s1 p-4">
          <h2 className="font-semibold">Manual capacity adjustment</h2>
          <p className="mt-1 text-sm text-t2">Use this for holidays, contractor capacity, overrides, or commitments not yet represented by Forge/project records.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Week start" name="weekStart" type="date" required />
            <Select label="Type" name="adjustmentType" options={["capacity_override", "time_off", "contractor_capacity", "sales_commitment"]} />
            <Field label="Hours" name="hours" type="number" required />
            <Field label="Staff / dependency" name="staffName" />
            <Field label="Role" name="role" />
            <Select label="Confidence" name="confidence" options={["medium", "high", "low"]} />
          </div>
          <Field label="Reason" name="reason" required />
          <button disabled={busy === "capacity_adjustment"} className="mt-3 rounded bg-cyan-300 px-3 py-2 text-sm font-bold text-slate-950 disabled:opacity-60">
            {busy === "capacity_adjustment" ? "Saving..." : "Save adjustment"}
          </button>
        </form>

        <form onSubmit={(event) => void submit(event, "forecast_actual")} className="rounded border border-b1 bg-s1 p-4">
          <h2 className="font-semibold">Forecast versus actual</h2>
          <p className="mt-1 text-sm text-t2">Record actual delivery to calibrate estimates and expose optimistic planning drift.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Period start" name="periodStart" type="date" required />
            <Select label="Period type" name="periodType" options={["week", "month"]} />
            <Field label="Forecast hours" name="forecastHours" type="number" required />
            <Field label="Actual hours" name="actualHours" type="number" required />
          </div>
          <Field label="Notes" name="notes" />
          <button disabled={busy === "forecast_actual"} className="mt-3 rounded bg-cyan-300 px-3 py-2 text-sm font-bold text-slate-950 disabled:opacity-60">
            {busy === "forecast_actual" ? "Saving..." : "Record actuals"}
          </button>
        </form>
      </section>

      {error && <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</div>}

      <section className="rounded border border-b1 bg-s1 p-4">
        <h2 className="font-semibold">Forecast assumptions</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-t2">
          <li>Default capacity: {forecast.assumptions.defaultWeeklyHumanHours} human delivery hours per week before manual adjustments.</li>
          <li>Forge does not remove human effort: generated work still carries review, approval, QA and repair effort.</li>
          <li>Probable work is weighted by sales stage and kept separate from confirmed commitments.</li>
          <li>Retainer obligations are inferred from active MRR until explicit allocation exists.</li>
        </ul>
      </section>

      {forecast.forecastVsActual.length > 0 && (
        <section className="rounded border border-b1 bg-s1 p-4">
          <h2 className="font-semibold">Forecast versus actual history</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-t3"><tr><th>Period</th><th>Forecast</th><th>Actual</th><th>Variance</th><th>Notes</th></tr></thead>
              <tbody>
                {forecast.forecastVsActual.map((row) => (
                  <tr key={`${row.periodType}:${row.periodStart}`} className="border-t border-b1">
                    <td className="py-2">{new Date(row.periodStart).toLocaleDateString("en-GB")} ({row.periodType})</td>
                    <td>{row.forecastHours}h</td>
                    <td>{row.actualHours}h</td>
                    <td>{row.varianceHours > 0 ? "+" : ""}{row.varianceHours}h {row.variancePercent === null ? "" : `(${row.variancePercent}%)`}</td>
                    <td className="text-t2">{row.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

function ForecastTable({ title, periods }: { title: string; periods: CapacityPeriod[] }) {
  return (
    <section className="min-w-0 rounded-xl border border-b1 bg-s1 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3"><h2 className="font-syne text-base font-bold">{title}</h2><span className="text-xs text-t3">{periods.length} periods</span></div>
      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[680px] text-sm">
          <div className="grid grid-cols-[minmax(10rem,1fr)_repeat(4,4.75rem)_7.5rem] gap-3 border-b border-b1 px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-t3"><span>Period</span><span>Confirmed</span><span>Probable</span><span>Capacity</span><span>Use</span><span>Risk</span></div>
          {periods.map((period) => <div key={period.key} className="border-b border-b1/70 px-2 py-3 last:border-0"><div className="grid grid-cols-[minmax(10rem,1fr)_repeat(4,4.75rem)_7.5rem] items-center gap-3"><div className="min-w-0"><div className="font-semibold">{period.label}</div>{period.warnings.length > 0 && <details className="mt-1"><summary className="cursor-pointer text-xs text-amber-200">{period.warnings.length} planning exception{period.warnings.length === 1 ? "" : "s"}</summary><ul className="mt-1 space-y-1 pr-3 text-xs leading-relaxed text-amber-100/80">{period.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></details>}</div><span className="font-medium">{period.confirmedHours}h</span><span>{period.probableHours}h</span><span>{period.adjustedCapacityHours}h</span><span className={period.utilization >= 100 ? "font-bold text-red-200" : "font-semibold"}>{period.utilization}%</span><Badge value={`${period.risk} / ${period.confidence}`} tone={period.risk === "high" ? "bad" : period.risk === "medium" ? "warn" : "good"} /></div></div>)}
        </div>
      </div>
    </section>
  )
}

function WorkList({ title, items }: { title: string; items: DeliveryWorkItem[] }) {
  return (
    <section className="rounded border border-b1 bg-s1 p-4">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-3 space-y-3">
        {items.length === 0 ? <p className="text-sm text-t3">No matching work.</p> : items.slice(0, 8).map((item) => (
          <article key={item.id} className="rounded border border-b1 bg-s2 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{item.name}</h3>
                <p className="text-xs text-t3">{item.source} · {item.owner ?? "Unassigned"} · {item.deadline ? new Date(item.deadline).toLocaleDateString("en-GB") : "No deadline"}</p>
              </div>
              <Badge value={`${item.remainingHours}h ${item.risk}`} tone={item.risk === "high" ? "bad" : item.risk === "medium" ? "warn" : "good"} />
            </div>
            <p className="mt-2 text-sm text-t2">Manual {item.manualHours}h / Forge {item.forgeHours}h · {Math.round(item.probability * 100)}% probability · {item.confidence} confidence</p>
            {item.blockers.length > 0 && <p className="mt-2 text-xs text-amber-200">{item.blockers.join(" ")}</p>}
            {item.singlePersonDependency && <p className="mt-1 text-xs text-red-200">Single-person dependency: confirm cover before committing dates.</p>}
          </article>
        ))}
      </div>
    </section>
  )
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded border border-b1 bg-s1 p-4"><p className="text-xs uppercase tracking-[0.2em] text-t3">{label}</p><p className="mt-2 font-syne text-2xl font-bold">{value}</p><p className="mt-1 text-sm text-t2">{detail}</p></div>
}

function Badge({ value, tone }: { value: string; tone: "good" | "warn" | "bad" }) {
  const cls = tone === "good" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100" : tone === "warn" ? "border-amber-400/30 bg-amber-400/10 text-amber-100" : "border-red-400/30 bg-red-400/10 text-red-100"
  return <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-1 text-xs font-semibold ${cls}`}>{value}</span>
}

function Field({ label, name, type = "text", required = false }: { label: string; name: string; type?: string; required?: boolean }) {
  return <label className="mt-3 block text-sm text-t2">{label}<input className="mt-1 w-full rounded border border-b1 bg-s2 px-3 py-2 text-t1" name={name} type={type} required={required} /></label>
}

function Select({ label, name, options }: { label: string; name: string; options: string[] }) {
  return <label className="block text-sm text-t2">{label}<select className="mt-1 w-full rounded border border-b1 bg-s2 px-3 py-2 text-t1" name={name}>{options.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}</select></label>
}

function sum(items: DeliveryWorkItem[], key: "remainingHours") {
  return items.reduce((total, item) => total + item[key], 0)
}
