import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { clients } from "@/lib/schema"
import { guardApiCapability } from "@/lib/server/rbac"
import { isClientServiceTier, isClientStatus } from "@/lib/clients"

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await guardApiCapability("clients.write")
  const { id: rawId } = await params
  const id = Number(rawId)

  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid client ID." }, { status: 400 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid client payload." }, { status: 400 })
  }

  const name = optionalString(body.name)
  const contactEmail = optionalString(body.contactEmail)
  const status = optionalString(body.status)
  const mrr = Number.parseInt(String(body.mrr ?? "0"), 10)

  if (!name) return NextResponse.json({ error: "Client name is required." }, { status: 400 })
  if (name.length > 160) return NextResponse.json({ error: "Client name must be 160 characters or fewer." }, { status: 400 })
  if (contactEmail && !/^\S+@\S+\.\S+$/.test(contactEmail)) return NextResponse.json({ error: "Enter a valid contact email." }, { status: 400 })
  if (!isClientStatus(status)) return NextResponse.json({ error: "Select a valid client status." }, { status: 400 })
  const tier = optionalString(body.tier)
  if (tier !== null && !isClientServiceTier(tier)) return NextResponse.json({ error: "Select a valid client service tier." }, { status: 400 })
  if (!Number.isFinite(mrr) || mrr < 0) return NextResponse.json({ error: "MRR must be zero or greater." }, { status: 400 })

  const [updated] = await db.update(clients).set({
    name,
    contactName: optionalString(body.contactName),
    contactEmail,
    tier,
    mrr,
    status,
    updatedAt: new Date(),
  }).where(eq(clients.id, id)).returning({ id: clients.id, name: clients.name })

  if (!updated) return NextResponse.json({ error: "Client not found." }, { status: 404 })
  return NextResponse.json({ ok: true, client: updated })
}
