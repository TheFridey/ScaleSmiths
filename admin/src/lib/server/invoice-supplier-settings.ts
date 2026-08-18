import "server-only"

import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { parseInvoiceSupplierIdentity, type InvoiceSupplierIdentityInput } from "@/lib/invoice-supplier-settings"
import { invoiceSupplierSettings } from "@/lib/schema"

export async function loadInvoiceSupplierIdentity() {
  return (await db.select().from(invoiceSupplierSettings).where(eq(invoiceSupplierSettings.id, 1)).limit(1))[0] ?? null
}

export async function saveInvoiceSupplierIdentity(input: InvoiceSupplierIdentityInput) {
  const values = parseInvoiceSupplierIdentity(input)
  const [settings] = await db.insert(invoiceSupplierSettings).values({ id: 1, ...values })
    .onConflictDoUpdate({ target: invoiceSupplierSettings.id, set: { ...values, updatedAt: new Date() } }).returning()
  return settings
}
