import "server-only"
import { randomUUID } from "node:crypto"
import { sql, type SQL } from "drizzle-orm"
import { db, type AdminDatabaseTransaction } from "@/lib/db"
import { ExpansionError } from "@/lib/expansion"
import { hasCapability } from "@/lib/rbac"
import type { AdminRole } from "@/lib/admin-users"
import { contractMetrics, REVENUE_CATEGORIES } from "@/lib/command-centre"
import { historicalConversion, MIN_CLOSED_OUTCOMES, parseAssumptions, project, SCENARIOS, type Assumptions, type ForecastStage } from "@/lib/revenue-forecast"
import { getExpansionFinance } from "./expansion-finance"
import { requireCapability } from "./rbac"

/*
 * Operation Ascend B2.4: revenue intelligence. Actual figures are read from the authoritative records with the definitions
 * they already have: collected revenue is commercial_payments (reversals are negative rows), recurring revenue uses the
 * Command Centre's contractMetrics, commission uses getExpansionFinance (the Commission centre's own function). Forecasts
 * are hypothetical, computed per request from versioned founder assumptions, and never written anywhere financial.
 * Founders only, and only with finance access. OFF unless REVENUE_INTELLIGENCE_ENABLED=true.
 */
type Row = Record<string, unknown>
type Executor = Pick<AdminDatabaseTransaction, "execute">
export const revenueIntelligenceEnabled = () => process.env.REVENUE_INTELLIGENCE_ENABLED === "true"
const rows = async (tx: Executor, q: SQL): Promise<Row[]> => (await tx.execute(q)).rows as Row[]
const big = (v: unknown) => BigInt(String(v ?? 0))

async function founder() {
  if (!revenueIntelligenceEnabled()) throw new ExpansionError("Revenue intelligence is not available yet.", 404)
  return requireCapability("expansion.manage")
}
async function liveFinanceFounder(tx: Executor, actor: Awaited<ReturnType<typeof requireCapability>>) {
  const [u] = await rows(tx, sql`select role,active,session_version from admin_users where id=${actor.id} for share`)
  const role = u?.role as AdminRole
  if (!u?.active || u.session_version !== actor.sessionVersion || !hasCapability(role, "expansion.manage")) throw new ExpansionError("Workspace authority was revoked.", 403)
  if (!hasCapability(role, "finance.read")) throw new ExpansionError("Finance access is required for revenue intelligence.", 403)
}
const currentAssumptions = async (tx: Executor) => rows(tx, sql`select distinct on (scenario) id,scenario,version,qualified_bp,scope_submitted_bp,approved_bp,average_value_pence::text average_value_pence,
  monthly_retention_bp,horizon_months,rationale,created_at,(select display_name from admin_users u where u.id=a.created_by) created_by_name
  from expansion_forecast_assumptions a order by scenario, version desc`)

export async function revenueIntelligence(now = new Date()) {
  const actor = await founder()
  const data = await db.transaction(async (tx) => {
    await tx.execute(sql`set transaction isolation level repeatable read`)
    await liveFinanceFounder(tx, actor)
    const [collected] = await rows(tx, sql`select coalesce(sum(amount),0)::text total,
        coalesce(sum(amount) filter (where amount<0),0)::text reversals,
        coalesce(sum(amount) filter (where exists(select 1 from expansion_payment_events e where e.commercial_payment_id=p.id)),0)::text partner_attributed
      from commercial_payments p`)
    const byCategory = await rows(tx, sql`select category,coalesce(sum(amount),0)::text total from commercial_payments group by category`)
    const byMonth = await rows(tx, sql`select to_char(date_trunc('month', received_at at time zone 'Europe/London'),'YYYY-MM') as month_key,coalesce(sum(amount),0)::text total
      from commercial_payments where received_at >= date_trunc('month', (${now.toISOString()}::timestamptz at time zone 'Europe/London') - interval '11 months') at time zone 'Europe/London'
      group by 1 order by 1`)
    const [outstanding] = await rows(tx, sql`select count(*)::int invoices,coalesce(sum(greatest(0, i.total - coalesce((select sum(p.amount) from commercial_payments p where p.invoice_id=i.id),0))),0)::text total
      from invoices i where i.status='issued'`)
    const contracts = await rows(tx, sql`select client_id,category,status,monthly_amount,starts_at,ends_at from commercial_contracts`)
    const [stages] = await rows(tx, sql`select count(*) filter (where status='qualified')::int qualified,count(*) filter (where status='scope_submitted')::int scope_submitted,
        count(*) filter (where status='approved')::int approved,count(*) filter (where status='contract_accepted')::int accepted,count(*) filter (where status in ('closed_lost','withdrawn'))::int lost
      from expansion_opportunities`)
    const [accepted] = await rows(tx, sql`select count(*)::int n,coalesce(round(avg(c.one_off_amount)),0)::text avg_one_off from expansion_contracts ec join commercial_contracts c on c.id=ec.commercial_contract_id`)
    const [expected] = await rows(tx, sql`select count(*)::int n,coalesce(sum(amount),0)::text total from commercial_forecasts where expected_at between ${now.toISOString()}::timestamptz and ${now.toISOString()}::timestamptz + interval '3 months'`)
    return { collected, byCategory, byMonth, outstanding, contracts, stages, accepted, expected, assumptions: await currentAssumptions(tx) }
  })
  // The Commission centre's own figures, so this page can never disagree with it.
  const finance = await getExpansionFinance()
  const earned = (finance.partners as Row[]).reduce((t, p) => t + big(p.earned_pence), BigInt(0)), paid = (finance.partners as Row[]).reduce((t, p) => t + big(p.paid_pence), BigInt(0))
  const mrr = contractMetrics(data.contracts.map((c) => ({ clientId: Number(c.client_id), category: String(c.category), status: String(c.status), monthlyAmount: Number(c.monthly_amount), startsAt: String(c.starts_at), endsAt: c.ends_at ? String(c.ends_at) : null })), now)
  const categories = Object.fromEntries(data.byCategory.map((r) => [String(r.category), String(r.total)]))
  const sumOf = (keys: readonly string[]) => keys.reduce((t, k) => t + big(categories[k]), BigInt(0)).toString()
  const stageCounts: Record<ForecastStage, number> = { qualified: Number(data.stages.qualified), scope_submitted: Number(data.stages.scope_submitted), approved: Number(data.stages.approved) }
  const history = historicalConversion({ accepted: Number(data.stages.accepted), lost: Number(data.stages.lost) })
  const scenarios = SCENARIOS.map((scenario) => {
    const r = data.assumptions.find((a) => a.scenario === scenario)
    if (!r) return { scenario, assumptions: null, saved: null, projection: null }
    const assumptions: Assumptions = { scenario, stageBasisPoints: { qualified: Number(r.qualified_bp), scope_submitted: Number(r.scope_submitted_bp), approved: Number(r.approved_bp) },
      averageValuePence: String(r.average_value_pence), monthlyRetentionBasisPoints: Number(r.monthly_retention_bp), horizonMonths: Number(r.horizon_months) }
    return { scenario, assumptions, saved: { version: Number(r.version), rationale: String(r.rationale), by: r.created_by_name ? String(r.created_by_name) : null, at: new Date(String(r.created_at)).toISOString() },
      projection: project({ stageCounts, monthlyRecurringPence: String(mrr.mrr), assumptions }) }
  })
  return {
    generatedAt: now.toISOString(),
    actual: {
      collectedPence: String(data.collected.total), reversalsPence: String(data.collected.reversals), partnerAttributedPence: String(data.collected.partner_attributed),
      recurringCollectedPence: sumOf(["retainer", "premium_partnership"]), oneOffBuildCollectedPence: sumOf(["website_build"]),
      byCategory: REVENUE_CATEGORIES.map((c) => ({ category: c, pence: categories[c] ?? "0" })),
      byMonth: data.byMonth.map((m) => ({ month: String(m.month_key), pence: String(m.total) })),
      outstandingInvoicedPence: String(data.outstanding.total), outstandingInvoices: Number(data.outstanding.invoices),
      monthlyRecurringPence: String(mrr.mrr), retainedClients: mrr.retainedClients,
      commission: { earnedPence: earned.toString(), paidPence: paid.toString(), liabilityPence: (earned - paid).toString() },
    },
    forecastInputs: {
      stageCounts, history, minClosedOutcomes: MIN_CLOSED_OUTCOMES,
      acceptedContracts: Number(data.accepted.n), historicalAverageOneOffPence: Number(data.accepted.n) >= MIN_CLOSED_OUTCOMES ? String(data.accepted.avg_one_off) : null,
      commandCentreExpected: { count: Number(data.expected.n), pence: String(data.expected.total), note: "Founder-entered expected payments in the Command Centre for the next three months. Estimates, not collected revenue." },
    },
    scenarios,
  }
}

/** Saves a new version of one scenario's assumptions. Writes only expansion_forecast_assumptions and an audit entry. */
export async function saveForecastAssumptions(input: Record<string, unknown>) {
  const actor = await founder()
  const parsed = parseAssumptions(input)
  if (!parsed.ok) throw new ExpansionError(parsed.problem)
  if (typeof input.rationale !== "string" || input.rationale.trim().length < 3 || input.rationale.trim().length > 1000) throw new ExpansionError("Explain these assumptions (3 to 1000 characters).")
  const a = parsed.value
  return db.transaction(async (tx) => {
    await liveFinanceFounder(tx, actor)
    await tx.execute(sql`select pg_advisory_xact_lock(621908150)`)
    const [v] = await rows(tx, sql`select coalesce(max(version),0)::int v from expansion_forecast_assumptions where scenario=${a.scenario}`)
    const id = randomUUID(), version = Number(v.v) + 1
    await tx.execute(sql`insert into expansion_forecast_assumptions(id,scenario,version,qualified_bp,scope_submitted_bp,approved_bp,average_value_pence,monthly_retention_bp,horizon_months,rationale,created_by)
      values(${id},${a.scenario},${version},${a.stageBasisPoints.qualified},${a.stageBasisPoints.scope_submitted},${a.stageBasisPoints.approved},${a.averageValuePence}::bigint,${a.monthlyRetentionBasisPoints},${a.horizonMonths},${(input.rationale as string).trim()},${actor.id})`)
    await tx.execute(sql`insert into expansion_audit(actor_id,entity_id,action,details) values(${actor.id},${`forecast:${a.scenario}`},'forecast_assumptions_saved',${JSON.stringify({ id, version })}::jsonb)`)
    return { id, version }
  })
}
