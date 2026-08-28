import "server-only"

import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { quoteRequests } from "@/lib/schema"

export async function countFailedQuoteEmails() {
  const rows = await db.select({ id: quoteRequests.id })
    .from(quoteRequests)
    .where(eq(quoteRequests.emailDeliveryStatus, "failed"))
    .limit(50)
  return rows.length
}
