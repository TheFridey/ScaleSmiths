import "server-only"
import { sql, type SQL } from "drizzle-orm"
import { db, type AdminDatabaseTransaction } from "@/lib/db"
import { ExpansionError } from "@/lib/expansion"
import { currentStageDistribution, eventCount, eventSumPence, inPeriod, parsePerformancePeriod, periodStart, weeklySeries, type PerformancePeriod } from "@/lib/partner-performance"
import { partnerGuard } from "./empower-partner"
import { requireCapability } from "./rbac"
import { getPartnerFinance } from "./expansion-finance"
import { getProgrammeOverview } from "./expansion-programme"

/** B2.5 partner-only read projection. Does not write an operational, financial or learning row. */
type Row = Record<string, unknown>
type Executor = Pick<AdminDatabaseTransaction, "execute">
const rows = async (tx: Executor, statement: SQL) => (await tx.execute(statement)).rows as Row[]
export const partnerPerformanceEnabled = () => process.env.PARTNER_PERFORMANCE_ENABLED === "true"
const MAX_EVENTS = 5000
const iso = (value: unknown) => new Date(String(value)).toISOString()

export async function partnerPerformance(periodInput: unknown = "30d", now = new Date()) {
  if (!partnerPerformanceEnabled()) throw new ExpansionError("Performance is not available yet.", 404)
  let period: PerformancePeriod
  try { period = parsePerformancePeriod(periodInput) }
  catch { throw new ExpansionError("Choose a valid performance period.", 400) }
  const start = periodStart(period, now)
  const actor = await requireCapability("expansion.partner")
  const activity = await db.transaction(async (tx) => {
    await tx.execute(sql`set transaction isolation level repeatable read`)
    const partnerId = await partnerGuard(tx, actor)
    const [totals] = await rows(tx, sql`select (select count(*) from expansion_opportunities o left join expansion_research_candidates rc on rc.id=o.research_candidate_id where o.partner_id=${partnerId} and (o.research_candidate_id is null or (rc.status='allocated' and rc.allocated_partner_id=o.partner_id)))::int opportunity_count,
      (select count(*) from expansion_meeting_requests where partner_id=${partnerId})::int meeting_count,
      (select count(*) from expansion_contracts c join expansion_opportunities o on o.id=c.opportunity_id left join expansion_research_candidates rc on rc.id=o.research_candidate_id where o.partner_id=${partnerId} and c.accepted_at is not null and (o.research_candidate_id is null or (rc.status='allocated' and rc.allocated_partner_id=o.partner_id)))::int contract_count`)
    const opportunities = await rows(tx, sql`select o.id,o.status,o.created_at,o.research_candidate_id,p.next_follow_up_at
      from expansion_opportunities o join prospects p on p.id=o.prospect_id left join expansion_research_candidates rc on rc.id=o.research_candidate_id
      where o.partner_id=${partnerId} and (o.research_candidate_id is null or (rc.status='allocated' and rc.allocated_partner_id=o.partner_id)) order by o.created_at desc limit ${MAX_EVENTS}`)
    const meetings = await rows(tx, sql`select status,created_at,confirmed_start from expansion_meeting_requests where partner_id=${partnerId}
      order by created_at desc limit ${MAX_EVENTS}`)
    const contracts = await rows(tx, sql`select a.accepted_at from (
      select distinct on (c.opportunity_id) c.accepted_at from expansion_contracts c
      join expansion_opportunities o on o.id=c.opportunity_id left join expansion_research_candidates rc on rc.id=o.research_candidate_id
      where o.partner_id=${partnerId} and c.accepted_at is not null and (o.research_candidate_id is null or (rc.status='allocated' and rc.allocated_partner_id=o.partner_id))
      order by c.opportunity_id,c.accepted_at desc
    ) a order by a.accepted_at desc limit ${MAX_EVENTS}`)
    return { opportunities, meetings, contracts, truncated: [totals?.opportunity_count, totals?.meeting_count, totals?.contract_count].some((count) => Number(count ?? 0) > MAX_EVENTS) }
  })
  // Both services enforce the same active partner and session; the Commission centre remains the only source for money.
  const [finance, programme] = await Promise.all([getPartnerFinance(), getProgrammeOverview()])
  const opportunities = activity.opportunities
  const meetingRequests = activity.meetings.map((r) => ({ at: iso(r.created_at) }))
  const meetingConfirmed = activity.meetings.filter((r) => r.status === "confirmed" || r.status === "completed")
    .filter((r) => r.confirmed_start).map((r) => ({ at: iso(r.confirmed_start) }))
  const accepted = activity.contracts.map((r) => ({ at: iso(r.accepted_at) }))
  const ledger = finance.ledger.map((r) => ({ at: iso(r.created_at), amountPence: String(r.amount_pence) }))
  const payouts = finance.payouts.filter((r) => r.status === "paid" && r.paid_at)
    .map((r) => ({ at: iso(r.paid_at), amountPence: String(r.amount_pence) }))
  // Research-allocated opportunities are not prospects the partner registered.
  const registered = opportunities.filter((r) => !r.research_candidate_id).map((r) => ({ at: iso(r.created_at) }))
  const status = new Map<string, number>()
  for (const o of opportunities) status.set(String(o.status), (status.get(String(o.status)) ?? 0) + 1)
  const followUps = opportunities.filter((r) => r.next_follow_up_at && inPeriod(iso(r.next_follow_up_at), null, now))
  const active = opportunities.filter((r) => !["contract_accepted", "closed_lost", "withdrawn"].includes(String(r.status))).length
  const historicalCount = registered.filter((e) => inPeriod(e.at, start, now)).length
  return {
    period, generatedAt: now.toISOString(), truncated: activity.truncated,
    definitions: {
      conversion: "Current opportunity states only. Historical stage transitions are not inferred.",
      finance: "Earned and paid balances are supplied by the existing Commission centre. Period figures are dated ledger and paid payout entries.",
      meetings: "Confirmed meetings are counted by recorded confirmed start, not by request date.",
    },
    metrics: {
      registered: historicalCount,
      active,
      requestedMeetings: eventCount(meetingRequests, start, now),
      confirmedMeetings: eventCount(meetingConfirmed, start, now),
      acceptedContracts: eventCount(accepted, start, now),
      earnedPence: finance.earnedPence,
      paidPence: finance.paidPence,
      outstandingPence: finance.unpaidPence,
      earnedInPeriodPence: eventSumPence(ledger, start, now),
      paidInPeriodPence: eventSumPence(payouts, start, now),
    },
    distribution: currentStageDistribution([...status.entries()].map(([stage, count]) => ({ status: stage, count }))),
    trends: {
      registered: weeklySeries(registered, start ?? new Date(0), now),
      meetings: weeklySeries(meetingConfirmed, start ?? new Date(0), now),
      contracts: weeklySeries(accepted, start ?? new Date(0), now),
      earned: weeklySeries(ledger, start ?? new Date(0), now),
      paid: weeklySeries(payouts, start ?? new Date(0), now),
    },
    attention: { followUpsDue: followUps.length, pipelineUrl: "/partner/pipeline" },
    // Statuses and labels are read directly from the approved recognition system; 'reached' is not 'reward earned'.
    recognition: {
      programmeApproved: Boolean(programme.programme.approved),
      qualifiedClients: programme.qualifiedClients,
      milestones: programme.milestones,
      rewards: programme.rewards,
    },
  }
}
