import { notFound } from "next/navigation"
import { guardPageCapability } from "@/lib/server/rbac"
import { revenueIntelligenceEnabled } from "@/lib/server/revenue-intelligence"
import { RevenueIntelligence } from "@/components/ascend/RevenueIntelligence"
export const dynamic = "force-dynamic"
/** Operation Ascend B2.4: revenue intelligence and forecasting. 404 unless REVENUE_INTELLIGENCE_ENABLED=true; the API also requires finance access. */
export default async function RevenuePage() {
  await guardPageCapability("expansion.manage")
  if (!revenueIntelligenceEnabled()) notFound()
  return <RevenueIntelligence />
}
