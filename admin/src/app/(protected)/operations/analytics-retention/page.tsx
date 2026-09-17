import type { Metadata } from "next"
import { AnalyticsRetentionDashboard } from "@/components/operations/AnalyticsRetentionDashboard"
import { hasCapability } from "@/lib/rbac"
import { loadAnalyticsRetentionPublicState } from "@/lib/server/analytics-retention"
import { guardPageCapability } from "@/lib/server/rbac"

export const metadata: Metadata = { title: "Analytics retention" }
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export default async function AnalyticsRetentionPage() {
  const actor = await guardPageCapability("analytics.read")
  return <AnalyticsRetentionDashboard initialState={await loadAnalyticsRetentionPublicState()} canWrite={hasCapability(actor.role, "analytics.write")} />
}
