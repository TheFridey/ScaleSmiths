import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { eq } from "drizzle-orm"
import { ClientAnalyticsDashboard } from "@/components/client-analytics/ClientAnalyticsDashboard"
import { db } from "@/lib/db"
import { clients } from "@/lib/schema"
import { loadClientAnalyticsSummary, loadClientOptimisationProposals, loadClientWebsiteOutcomeEvaluation } from "@/lib/server/client-analytics"
import { guardPageCapability } from "@/lib/server/rbac"

export const metadata: Metadata = { title: "Client analytics" }
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export default async function ClientAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  await guardPageCapability("analytics.read")
  const clientId = Number((await params).id)
  if (!Number.isInteger(clientId) || clientId <= 0) notFound()
  const [client] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, clientId)).limit(1)
  if (!client) notFound()
  const [summary, outcome, optimisation] = await Promise.all([
    loadClientAnalyticsSummary(clientId),
    loadClientWebsiteOutcomeEvaluation(clientId),
    loadClientOptimisationProposals(clientId),
  ])
  return <ClientAnalyticsDashboard clientId={clientId} summary={summary} outcome={outcome} optimisation={optimisation} />
}
