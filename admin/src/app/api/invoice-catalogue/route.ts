import { asc } from "drizzle-orm"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { InvoiceDomainError } from "@/lib/invoices"
import { catalogueValues } from "@/lib/invoice-catalogue"
import { invoiceCatalogueItems } from "@/lib/schema"
import { guardApiCapability } from "@/lib/server/rbac"

export async function GET() { await guardApiCapability("finance.read"); return NextResponse.json({ ok: true, items: await db.select().from(invoiceCatalogueItems).orderBy(asc(invoiceCatalogueItems.position), asc(invoiceCatalogueItems.name)) }) }
export async function POST(request: Request) {
  try {
    await guardApiCapability("finance.write")
    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    if (!body) throw new InvoiceDomainError("Invalid catalogue payload.")
    const [item] = await db.insert(invoiceCatalogueItems).values(catalogueValues(body)).returning()
    return NextResponse.json({ ok: true, item }, { status: 201 })
  } catch (error) { return failure(error) }
}
function failure(error: unknown) { return error instanceof InvoiceDomainError ? NextResponse.json({ error: error.safeMessage }, { status: error.status }) : NextResponse.json({ error: "Unable to save catalogue item." }, { status: 500 }) }
