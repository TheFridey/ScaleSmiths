import "server-only"

import { desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { outreachActivities, prospects } from "@/lib/schema"

export async function getSalesLeadEvidence(prospectId: number | null) {
  if (!prospectId) return null
  const [prospectRows, activities] = await Promise.all([
    db.select().from(prospects).where(eq(prospects.id, prospectId)).limit(1),
    db.select().from(outreachActivities).where(eq(outreachActivities.prospectId, prospectId))
      .orderBy(desc(outreachActivities.createdAt)).limit(8),
  ])
  const prospect = prospectRows[0]
  if (!prospect) return null
  return {
    painPoints: [prospect.painPoints, prospect.objectionNotes, prospect.opportunityNotes]
      .filter((value): value is string => Boolean(value?.trim())),
    discoveryNotes: activities.flatMap((activity) => [activity.subject, activity.body, activity.outcome])
      .filter((value): value is string => Boolean(value?.trim())).slice(0, 8),
    sourceRecords: [
      { label: `Prospect ${prospect.businessName}`, recordType: "prospect", recordId: prospect.id },
      ...activities.map((activity) => ({
        label: activity.subject ?? activity.outcome ?? activity.type,
        recordType: "outreach_activity",
        recordId: activity.id,
      })),
    ],
  }
}
