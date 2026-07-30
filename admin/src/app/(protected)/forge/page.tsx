import type { Metadata } from "next"
import { ForgeDashboard } from "@/components/forge/ForgeDashboard"
import { loadForgeDashboardPageData } from "@/lib/server/forge-page-data"

export const metadata: Metadata = { title: "Forge" }
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export default async function ForgePage() {
  const data = await loadForgeDashboardPageData()

  return <ForgeDashboard {...data} />
}
