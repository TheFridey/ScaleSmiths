import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { clients } from "@/lib/schema"
import { guardApiCapability } from "@/lib/server/rbac"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await guardApiCapability("finance.write")
  const id = Number((await params).id)
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!Number.isSafeInteger(id) || id <= 0 || !body) return NextResponse.json({ error: "Invalid client billing payload." }, { status: 400 })
  const [client] = await db.update(clients).set({
    contactName: optional(body.contactName), contactEmail: optional(body.contactEmail),
    billingAddressLine1: optional(body.billingAddressLine1), billingAddressLine2: optional(body.billingAddressLine2),
    billingCity: optional(body.billingCity), billingCounty: optional(body.billingCounty),
    billingPostcode: optional(body.billingPostcode), billingCountry: optional(body.billingCountry),
    portalClientId: optional(body.portalClientId), updatedAt: new Date(),
  }).where(eq(clients.id, id)).returning()
  return client ? NextResponse.json({ ok: true, client }) : NextResponse.json({ error: "Client not found." }, { status: 404 })
}
function optional(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : null }
