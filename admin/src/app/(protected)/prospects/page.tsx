import type { Metadata } from "next"
import { desc } from "drizzle-orm"
import { ProspectPipeline } from "@/components/ProspectPipeline"
import { db } from "@/lib/db"
import { outreachActivities, proposalTrackings, prospects, salesProposals } from "@/lib/schema"

export const metadata: Metadata = { title: "Prospect Pipeline" }
export const dynamic = "force-dynamic"

export default async function ProspectsPage() {
  const [prospectRows, activityRows, proposalRows, salesProposalRows] = await Promise.all([
    db.select().from(prospects).orderBy(desc(prospects.updatedAt)),
    db.select().from(outreachActivities).orderBy(desc(outreachActivities.createdAt)),
    db.select().from(proposalTrackings).orderBy(desc(proposalTrackings.createdAt)),
    db.select().from(salesProposals).orderBy(desc(salesProposals.updatedAt)),
  ])

  return (
    <ProspectPipeline
      initialProspects={prospectRows}
      initialActivities={activityRows}
      initialProposals={proposalRows}
      initialSalesProposals={salesProposalRows}
    />
  )
}
