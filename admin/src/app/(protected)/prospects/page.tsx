import type { Metadata } from "next"
import { desc } from "drizzle-orm"
import { ProspectPipeline } from "@/components/ProspectPipeline"
import { db } from "@/lib/db"
import { outreachActivities, proposalTrackings, prospects } from "@/lib/schema"

export const metadata: Metadata = { title: "Prospect Pipeline" }
export const dynamic = "force-dynamic"

export default async function ProspectsPage() {
  const [prospectRows, activityRows, proposalRows] = await Promise.all([
    db.select().from(prospects).orderBy(desc(prospects.updatedAt)),
    db.select().from(outreachActivities).orderBy(desc(outreachActivities.createdAt)),
    db.select().from(proposalTrackings).orderBy(desc(proposalTrackings.createdAt)),
  ])

  return (
    <ProspectPipeline
      initialProspects={prospectRows}
      initialActivities={activityRows}
      initialProposals={proposalRows}
    />
  )
}
