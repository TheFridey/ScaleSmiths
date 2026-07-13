import type { Metadata } from "next"
import { DailyOperatingBrief } from "@/components/operations/DailyOperatingBrief"
import { loadDailyOperatingBrief } from "@/lib/server/operating-brief"

export const metadata: Metadata = { title: "Daily operating brief" }
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export default async function DailyOperatingBriefPage() {
  const brief = await loadDailyOperatingBrief()
  return <DailyOperatingBrief brief={brief} />
}
