import type { Metadata } from "next"
import { desc } from "drizzle-orm"
import { DashboardContent } from "@/components/Dashboard"
import { db } from "@/lib/db"
import { clients, outreachActivities, proposalTrackings, prospects } from "@/lib/schema"
import { computeSalesMetrics } from "@/lib/prospects"

export const metadata: Metadata = { title: "Dashboard" }
export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const [rows, prospectRows, activityRows, proposalRows] = await Promise.all([
    db
      .select({
        name: clients.name,
        tier: clients.tier,
        mrr: clients.mrr,
        status: clients.status,
        progress: clients.progress,
      })
      .from(clients)
      .orderBy(desc(clients.createdAt)),
    db
      .select({
        stage: prospects.stage,
        estimatedProjectValue: prospects.estimatedProjectValue,
        estimatedMonthlyRetainer: prospects.estimatedMonthlyRetainer,
        nextFollowUpAt: prospects.nextFollowUpAt,
        discoveryCallAt: prospects.discoveryCallAt,
        proposalSentAt: prospects.proposalSentAt,
        wonAt: prospects.wonAt,
        lostAt: prospects.lostAt,
      })
      .from(prospects),
    db
      .select({
        direction: outreachActivities.direction,
        createdAt: outreachActivities.createdAt,
      })
      .from(outreachActivities),
    db
      .select({
        status: proposalTrackings.status,
        sentAt: proposalTrackings.sentAt,
      })
      .from(proposalTrackings),
  ])

  const todayLabel = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  return <DashboardContent clients={rows} salesMetrics={computeSalesMetrics(prospectRows, activityRows, proposalRows)} todayLabel={todayLabel} />
}
