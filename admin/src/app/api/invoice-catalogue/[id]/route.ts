import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { InvoiceDomainError } from "@/lib/invoices"
import { invoiceCatalogueItems } from "@/lib/schema"
import { catalogueValues } from "@/lib/invoice-catalogue"
import { guardApiCapability } from "@/lib/server/rbac"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await guardApiCapability("finance.write")
    const id = Number((await params).id); if (!Number.isSafeInteger(id) || id <= 0) throw new InvoiceDomainError("Catalogue item id is invalid.")
    const body = await request.json().catch(() => null) as Record<string, unknown> | null; if (!body) throw new InvoiceDomainError("Invalid catalogue payload.")
    const [current] = await db.select().from(invoiceCatalogueItems).where(eq(invoiceCatalogueItems.id, id)); if (!current) throw new InvoiceDomainError("Catalogue item not found.", 404)
    const [item] = await db.update(invoiceCatalogueItems).set({ ...catalogueValues({ ...current, ...body }), updatedAt: new Date() }).where(eq(invoiceCatalogueItems.id, id)).returning()
    return NextResponse.json({ ok: true, item })
  } catch (error) { return error instanceof InvoiceDomainError ? NextResponse.json({ error: error.safeMessage }, { status: error.status }) : NextResponse.json({ error: "Unable to update catalogue item." }, { status: 500 }) }
}
