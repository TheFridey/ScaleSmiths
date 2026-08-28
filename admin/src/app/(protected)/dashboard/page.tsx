import type { Metadata } from "next"
import { DashboardContent } from "@/components/Dashboard"
import { countFailedQuoteEmails } from "@/lib/server/acquisition-read-service"
import { listDashboardClients } from "@/lib/server/client-read-service"
import { getDeliveryDashboardSnapshot } from "@/lib/server/delivery-read-service"
import { countFailedInvoiceDeliveries } from "@/lib/server/finance-read-service"
import { getReportingDashboardSnapshot } from "@/lib/server/reporting-read-service"
import { getSalesDashboardSnapshot } from "@/lib/server/sales-read-service"

export const metadata: Metadata = { title: "Dashboard" }
export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const [clients, sales, delivery, reporting, failedQuoteEmails, failedInvoiceDeliveries] = await Promise.all([
    listDashboardClients(),
    getSalesDashboardSnapshot(now),
    getDeliveryDashboardSnapshot(),
    getReportingDashboardSnapshot(month, year),
    countFailedQuoteEmails(),
    countFailedInvoiceDeliveries(),
  ])

  const reportsDueThisMonth = clients
    .filter((client) => client.status !== "archived")
    .filter((client) => !client.portalClientId || !reporting.clientIdsWithCurrentReport.has(client.portalClientId))
    .map((client) => ({ id: client.id, name: client.name, tier: client.tier, status: client.status }))
    .slice(0, 8)

  const todayLabel = now.toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  })

  return (
    <DashboardContent
      clients={clients}
      salesMetrics={sales.metrics}
      todayLabel={todayLabel}
      operational={{
        ...delivery,
        failedQuoteEmails,
        failedInvoiceDeliveries,
        reportsDueThisMonth,
        proposalsMissing: sales.proposalsMissing,
        currentMonthReportCount: reporting.currentMonthReportCount,
      }}
    />
  )
}
