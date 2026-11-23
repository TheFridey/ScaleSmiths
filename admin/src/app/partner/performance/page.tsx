import Link from "next/link"
import { notFound } from "next/navigation"
import { guardPageCapability } from "@/lib/server/rbac"
import { partnerPerformance, partnerPerformanceEnabled } from "@/lib/server/partner-performance"
import { partnerAcademyEnabled, partnerKnowledgeEnabled, partnerResourcesEnabled } from "@/lib/server/empower-partner"
import { partnerWorkspaceEnabled } from "@/lib/server/empower-guidance"
import { partnerObjectionsEnabled } from "@/lib/server/empower-objections"
import { partnerPipelineEnabled } from "@/lib/server/partner-pipeline"
import { AcademyShell } from "@/components/empower/AcademyShell"
import { PERFORMANCE_PERIODS, parsePerformancePeriod } from "@/lib/partner-performance"
import "./performance.css"
export const dynamic = "force-dynamic"
const pounds = (value: string) => { const n = BigInt(value); const abs = n < BigInt(0) ? -n : n; return (n < BigInt(0) ? "−" : "") + "£" + (abs / BigInt(100)).toLocaleString("en-GB") + "." + (abs % BigInt(100)).toString().padStart(2, "0") }
const labels: Record<string, string> = { registered: "Registered", contacted: "Contacted", discovery: "Discovery", qualified: "Qualified", scope_submitted: "Scope submitted", more_information: "Information required", bespoke_required: "Bespoke scoping", deferred: "Deferred", approved: "Approved", contract_accepted: "Contract accepted", closed_lost: "Closed", withdrawn: "Withdrawn" }
export default async function PartnerPerformancePage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await guardPageCapability("expansion.partner")
  if (!partnerPerformanceEnabled()) notFound()
  const params = await searchParams
  let selected: ReturnType<typeof parsePerformancePeriod>
  try { selected = parsePerformancePeriod(params.period) } catch { notFound() }
  const data = await partnerPerformance(selected)
  const metrics = [
    { label: "Prospects registered", value: String(data.metrics.registered), note: "Registered during the selected period" },
    { label: "Active opportunities", value: String(data.metrics.active), note: "Current open stages, all time" },
    { label: "Meetings requested", value: String(data.metrics.requestedMeetings), note: "Requests submitted in the selected period" },
    { label: "Meetings confirmed", value: String(data.metrics.confirmedMeetings), note: "Confirmed meeting starts in the selected period" },
    { label: "Accepted contracts", value: String(data.metrics.acceptedContracts), note: "Acceptance recorded in the selected period" },
    { label: "Commission earned", value: pounds(data.metrics.earnedPence), note: "Authoritative all-time Commission Centre balance" },
    { label: "Commission paid", value: pounds(data.metrics.paidPence), note: "Authoritative all-time completed payouts" },
    { label: "Commission unpaid", value: pounds(data.metrics.outstandingPence), note: "Earned less paid; subject to existing finance rules" },
  ]
  return <AcademyShell current="performance" nav={{
    academy: partnerAcademyEnabled(), resources: partnerResourcesEnabled(),
    knowledge: partnerKnowledgeEnabled(), objections: partnerObjectionsEnabled(),
    guidance: partnerWorkspaceEnabled(), pipeline: partnerPipelineEnabled(), performance: true,
  }}>
    <div className="pf-page">
      <div className="pf-eyebrow">OPERATION ASCEND / B2.5</div>
      <h1>Your performance</h1>
      <p className="pf-intro">Your own recorded business activity and verified commission. No targets, rankings or assumed earnings.</p>
      <nav className="pf-periods" aria-label="Performance time period">
        {PERFORMANCE_PERIODS.map((p) => <Link key={p} href={"/partner/performance?period=" + p}
          aria-current={p === selected ? "page" : undefined} className={p === selected ? "pf-current" : ""}>
          {({ "7d": "7 days", "30d": "30 days", "90d": "90 days", "12m": "12 months", all: "All time" } as const)[p]}
        </Link>)}
      </nav>
      {data.truncated && <p role="status" className="pf-warning">Your history exceeds the current reporting window. These counts may be incomplete; use the Commission Centre for authoritative financial balances.</p>}
      <section aria-labelledby="pf-overview">
        <h2 id="pf-overview">Activity and commission</h2>
        <div className="pf-grid">{metrics.map((m) => <div className="pf-card" key={m.label}><p>{m.label}</p><strong>{m.value}</strong><span>{m.note}</span></div>)}</div>
        <p className="pf-detail">For this period: {pounds(data.metrics.earnedInPeriodPence)} earned and {pounds(data.metrics.paidInPeriodPence)} paid, based on dated ledger and completed payout records. <Link href="/partner?tab=finance">Open Commission Centre</Link></p>
      </section>
      <section aria-labelledby="pf-pipeline">
        <h2 id="pf-pipeline">Pipeline snapshot</h2>
        <p className="pf-detail">Current opportunity states, not a historical conversion funnel. Previous stage transitions are not inferred.</p>
        {data.distribution.total === 0 ? <p>No opportunities recorded yet.</p> :
          <div className="pf-statuses">{data.distribution.stages.map((s) => <div className="pf-stage" key={s.status}><span>{labels[s.status] ?? s.status.replaceAll("_", " ")}</span><strong>{s.count}</strong></div>)}</div>}
        {partnerPipelineEnabled() && <p><Link href="/partner/pipeline">Open your pipeline</Link></p>}
      </section>
      <section aria-labelledby="pf-trends">
        <h2 id="pf-trends">Recorded activity by week</h2>
        <p className="pf-detail">Every row represents dated, recorded activity. A missing week is not displayed as a zero unless the underlying records establish it.</p>
        <div className="pf-table-scroll"><table className="pf-table">
          <caption>Weekly registrations, confirmed meetings, accepted contracts, commission earned and commission paid</caption>
          <thead><tr><th scope="col">Week starting (UTC)</th><th scope="col">Prospects</th><th scope="col">Meetings</th><th scope="col">Contracts</th><th scope="col">Earned</th><th scope="col">Paid</th></tr></thead>
          <tbody>{[...new Set([...data.trends.registered, ...data.trends.meetings, ...data.trends.contracts, ...data.trends.earned, ...data.trends.paid].map((r) => r.week))].sort().map((week) =>
            <tr key={week}><th scope="row">{week}</th><td>{data.trends.registered.find((r) => r.week === week)?.count ?? 0}</td>
            <td>{data.trends.meetings.find((r) => r.week === week)?.count ?? 0}</td>
            <td>{data.trends.contracts.find((r) => r.week === week)?.count ?? 0}</td><td>{pounds(data.trends.earned.find((r) => r.week === week)?.pence ?? "0")}</td><td>{pounds(data.trends.paid.find((r) => r.week === week)?.pence ?? "0")}</td></tr>)}</tbody>
        </table></div>
        <p className="pf-detail">Amounts earned and paid for the selected period are shown above; the Commission Centre provides the complete transaction history.</p>
      </section>
      <section aria-labelledby="pf-attention">
        <h2 id="pf-attention">Where to focus</h2>
        <p>{data.attention.followUpsDue === 0 ? "No overdue follow-ups in your current pipeline." : data.attention.followUpsDue + " follow-up(s) are due based on recorded dates."}</p>
        <p className="pf-detail">Suggestions are optional, based only on your own saved opportunity data.</p>
      </section>
      <section aria-labelledby="pf-recognition">
        <h2 id="pf-recognition">Recognition</h2>
        <p>{data.recognition.qualifiedClients} founder-qualified client(s).</p>
        {data.recognition.programmeApproved ? <div className="pf-grid">{data.recognition.milestones.map((m) =>
          <div className="pf-card" key={m.clients}><p>{m.label}</p><strong>{m.reached ? "Milestone reached" : m.clients + " qualifying clients"}</strong><span>{m.reward ? "Recorded reward: " + String(m.reward.status).replaceAll("_", " ") : "No reward approved or recorded"}</span>{Boolean(m.reward?.fulfilled_at) && <span>Fulfilled {new Date(String(m.reward.fulfilled_at)).toLocaleDateString("en-GB", { timeZone: "Europe/London" })}</span>}</div>)}</div>
          : <p>No founder-approved recognition programme is active. Proposed milestones are not rewards.</p>}
      </section>
      <p className="pf-detail">Generated {new Date(data.generatedAt).toLocaleString("en-GB", { timeZone: "Europe/London" })}. Your Academy learning history is private and is not used here.</p>
    </div>
  </AcademyShell>
}
