import type { Metadata } from "next"
import { desc } from "drizzle-orm"
import { Messages } from "@/components/Messages"
import { db } from "@/lib/db"
import { quoteRequests } from "@/lib/schema"

export const metadata: Metadata = { title: "Messages" }
export const dynamic = "force-dynamic"

export default async function MessagesPage() {
  const leads = await db
    .select({
      id: quoteRequests.id,
      name: quoteRequests.name,
      email: quoteRequests.email,
      business: quoteRequests.business,
      websiteUrl: quoteRequests.websiteUrl,
      businessType: quoteRequests.businessType,
      projectType: quoteRequests.projectType,
      budget: quoteRequests.budget,
      launchTimeframe: quoteRequests.launchTimeframe,
      mainGoal: quoteRequests.mainGoal,
      needs: quoteRequests.needs,
      carePlanInterest: quoteRequests.carePlanInterest,
      preferredContactMethod: quoteRequests.preferredContactMethod,
      enquiryIntent: quoteRequests.enquiryIntent,
      leadQuality: quoteRequests.leadQuality,
      emailDeliveryStatus: quoteRequests.emailDeliveryStatus,
      emailFailureReason: quoteRequests.emailFailureReason,
      status: quoteRequests.status,
      brief: quoteRequests.brief,
      createdAt: quoteRequests.createdAt,
    })
    .from(quoteRequests)
    .orderBy(desc(quoteRequests.createdAt))

  return <Messages leads={leads} />
}
