"use client"
import { useState } from "react"
import { Download } from "lucide-react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts"
import {
  londonDay,
  londonInputToISO,
  contractMetrics,
  csvCell,
} from "@/lib/command-centre"
import type { Snapshot } from "./CommandCentre"
const money = (value: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
    value / 100,
  )
export function CommercialReports({ data }: { data: Snapshot }) {
  const today = londonDay(data.serverTime)
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`),
    [to, setTo] = useState(today),
    [founder, setFounder] = useState("all")
  const within = (value: string) =>
    londonDay(value) >= from && londonDay(value) <= to
  const activities = data.activities.filter(
    (a) =>
      a.actorUserId &&
      within(a.occurredAt ?? a.createdAt) &&
      (founder === "all" || a.actorUserId === founder),
  )
  const steps = [
    "company_researched",
    "contact_identified",
    "phone_call",
    "meeting_held",
    "proposal",
    "contract_signed",
  ]
  const funnel = steps.map((type) => {
    const ids = [
      ...new Set(
        activities.filter((a) => a.type === type).map((a) => a.prospectId),
      ),
    ]
    return { type: type.replace(/_/g, " "), count: ids.length, ids }
  })
  const won = data.leads.filter(
    (l) =>
      l.wonAt &&
      within(l.wonAt) &&
      (founder === "all" || l.ownerUserId === founder),
  )
  const averageCycle = won.length
    ? Math.round(
        won.reduce(
          (s, l) =>
            s +
            (new Date(l.wonAt!).getTime() - new Date(l.createdAt).getTime()) /
              86400000,
          0,
        ) / won.length,
      )
    : null
  const months = Array.from({ length: 6 }, (_, i) => {
    const date = new Date(`${today.slice(0, 7)}-01T12:00:00Z`)
    date.setUTCMonth(date.getUTCMonth() - (5 - i))
    const month = date.toISOString().slice(0, 7)
    return {
      month,
      calls: data.activities.filter(
        (a) =>
          a.actorUserId &&
          a.type === "phone_call" &&
          londonDay(a.occurredAt ?? a.createdAt).startsWith(month) &&
          (founder === "all" || a.actorUserId === founder),
      ).length,
      emails: data.activities.filter(
        (a) =>
          a.actorUserId &&
          a.type === "email" &&
          londonDay(a.occurredAt ?? a.createdAt).startsWith(month) &&
          (founder === "all" || a.actorUserId === founder),
      ).length,
      mrr: contractMetrics(
        data.contracts,
        i === 5
          ? new Date(data.serverTime)
          : new Date(
              londonInputToISO(
                `${new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10)}T23:59`,
              ),
            ),
      ).mrr,
    }
  })
  const payments = data.payments.filter(
    (p) =>
      within(p.receivedAt) && (founder === "all" || p.actorUserId === founder),
  )
  const pipeline = data.leads
    .filter(
      (l) =>
        !["won", "lost"].includes(l.stage) &&
        (founder === "all" || l.ownerUserId === founder),
    )
    .reduce(
      (sum, l) => sum + Math.round(l.estimatedProjectValue * l.confidence),
      0,
    )
  function download() {
    const rows = [
      ["Metric", "Value"],
      ...funnel.map((r) => [r.type, r.count]),
      ["Average sales cycle days", averageCycle ?? "No won deals"],
      ["Recorded payments pence", payments.reduce((s, p) => s + p.amount, 0)],
      ["Weighted build pipeline pence", pipeline],
    ]
    const url = URL.createObjectURL(
      new Blob([rows.map((r) => r.map(csvCell).join(",")).join("\r\n")], {
        type: "text/csv;charset=utf-8",
      }),
    )
    const link = document.createElement("a")
    link.href = url
    link.download = "scalesmiths-commercial-report.csv"
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <section>
      <div className="cc-toolbar">
        <label>
          From
          <input
            aria-label="Report from date"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          To
          <input
            aria-label="Report to date"
            type="date"
            min={from}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <select
          aria-label="Report founder"
          value={founder}
          onChange={(e) => setFounder(e.target.value)}
        >
          <option value="all">Both founders</option>
          {data.users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.displayName}
            </option>
          ))}
        </select>
        <button onClick={download}>
          <Download size={17} /> Report CSV
        </button>
      </div>
      <h2>Commercial conversion evidence</h2>
      <div className="cc-counts">
        {funnel.map((row, i) => (
          <div key={row.type}>
            <span>{row.type}</span>
            <strong>{row.count}</strong>
            {i > 0 && (
              <small>
                {funnel[i - 1].count
                  ? `${Math.round((row.ids.filter((id) => funnel[i - 1].ids.includes(id)).length / funnel[i - 1].count) * 100)}% progressed from previous step`
                  : "No prior-step evidence"}
              </small>
            )}
          </div>
        ))}
      </div>
      <p>
        Average sales cycle:{" "}
        {averageCycle === null
          ? "No won deals in this period"
          : `${averageCycle} days`}
      </p>
      <h2>Monthly activity</h2>
      <div className="cc-chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={months}>
            <XAxis dataKey="month" stroke="#b5b6ba" />
            <YAxis allowDecimals={false} stroke="#b5b6ba" />
            <Tooltip contentStyle={{ background: "#202123" }} />
            <Bar dataKey="calls" fill="#d1b266" />
            <Bar dataKey="emails" fill="#81b3ac" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {data.actor.canReadFinance && (
        <>
          <h2>Revenue and forecasts</h2>
          <h3>Contracted MRR history</h3>
          <div className="cc-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months}>
                <XAxis dataKey="month" stroke="#b5b6ba" />
                <YAxis tickFormatter={(value) => money(Number(value))} />
                <Tooltip
                  formatter={(value) => money(Number(value))}
                  contentStyle={{ background: "#202123" }}
                />
                <Bar dataKey="mrr" name="Contracted MRR" fill="#81b3ac" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="cc-counts">
            <div>
              <span>Recorded payments in period</span>
              <strong>
                {money(payments.reduce((s, p) => s + p.amount, 0))}
              </strong>
            </div>
            <div>
              <span>New contracted MRR in period</span>
              <strong>
                {money(
                  data.contracts
                    .filter(
                      (c) =>
                        c.status === "confirmed" &&
                        within(c.startsAt) &&
                        (founder === "all" || c.actorUserId === founder),
                    )
                    .reduce((s, c) => s + c.monthlyAmount, 0),
                )}
              </strong>
            </div>
            <div>
              <span>Weighted build pipeline projection</span>
              <strong>{money(pipeline)}</strong>
              <small>
                Build estimates weighted by recorded founder confidence;
                excludes won and lost deals.
              </small>
            </div>
          </div>
          <h3>Contracted value by acquisition source</h3>
          <div className="cc-counts">
            {Array.from(new Set(data.leads.map((l) => l.source))).map(
              (source) => (
                <div key={source}>
                  <span>{source}</span>
                  <strong>
                    {money(
                      data.contracts
                        .filter(
                          (c) =>
                            c.status === "confirmed" &&
                            c.prospectId &&
                            data.leads.find((l) => l.id === c.prospectId)
                              ?.source === source,
                        )
                        .reduce((s, c) => s + c.oneOffAmount, 0),
                    )}{" "}
                    one-off
                  </strong>
                </div>
              ),
            )}
          </div>
        </>
      )}
      <h2>Win / loss reasons</h2>
      {data.leads
        .filter((l) => l.stage === "lost" && l.lostAt && within(l.lostAt))
        .map((l) => (
          <div className="cc-row" key={l.id}>
            <strong>{l.businessName}</strong>
            <span>{l.lostReason ?? "No reason recorded"}</span>
          </div>
        ))}
    </section>
  )
}
