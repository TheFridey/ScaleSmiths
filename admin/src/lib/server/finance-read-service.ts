import "server-only"

import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { invoiceDeliveryAttempts } from "@/lib/schema"

export async function countFailedInvoiceDeliveries() {
  const rows = await db.select({ id: invoiceDeliveryAttempts.id })
    .from(invoiceDeliveryAttempts)
    .where(eq(invoiceDeliveryAttempts.state, "failed"))
    .limit(50)
  return rows.length
}
