import type { Metadata } from "next"
import { desc, gte } from "drizzle-orm"
import { ExperienceAnalyticsDashboard } from "@/components/operations/ExperienceAnalyticsDashboard"
import { summarizeExperienceAnalytics } from "@/lib/experience-analytics"
import { db } from "@/lib/db"
import { experienceEvents } from "@/lib/schema"

export const metadata: Metadata = { title: "Experience analytics" }
export const dynamic = "force-dynamic"

export default async function ExperienceAnalyticsPage() {
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - 30)

  const rows = await db
    .select({
      eventName: experienceEvents.eventName,
      preference: experienceEvents.preference,
      deviceClass: experienceEvents.deviceClass,
      returningPreference: experienceEvents.returningPreference,
      completionDepth: experienceEvents.completionDepth,
      campaignSource: experienceEvents.campaignSource,
      campaignMedium: experienceEvents.campaignMedium,
      campaignName: experienceEvents.campaignName,
      occurredAt: experienceEvents.occurredAt,
    })
    .from(experienceEvents)
    .where(gte(experienceEvents.occurredAt, since))
    .orderBy(desc(experienceEvents.occurredAt))
    .limit(10_000)

  return <ExperienceAnalyticsDashboard summary={summarizeExperienceAnalytics(rows)} />
}
