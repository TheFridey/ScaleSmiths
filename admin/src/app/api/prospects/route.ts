import { NextRequest, NextResponse } from "next/server"
import { desc, isNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { prospects } from "@/lib/schema"
import { parseProspectPayload } from "@/lib/prospects"
import { guardApiCapability } from "@/lib/server/rbac"
import { commercialMutation } from "@/lib/server/command-centre"
import { CommercialError } from "@/lib/command-centre"
import { AdminIdentityError } from "@/lib/admin-users"

export const dynamic = "force-dynamic"

export async function GET() {
  await guardApiCapability("leads.read")
  const rows = await db
    .select()
    .from(prospects)
    .where(isNull(prospects.archivedAt))
    .orderBy(desc(prospects.updatedAt))

  return NextResponse.json({ prospects: rows })
}

export async function POST(request: NextRequest) {
  try {
    const actor = await guardApiCapability("leads.write")
    const body = await request.json().catch(() => null)

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid prospect payload." },
        { status: 400 },
      )
    }

    const parsed = parseProspectPayload(
      body as Record<string, unknown>,
      "create",
    )

    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    if (!parsed.data.businessName) {
      return NextResponse.json(
        { error: "Business name is required." },
        { status: 400 },
      )
    }

    const prospect = await commercialMutation(actor, {
      ...body,
      action: "createProspect",
    })

    return NextResponse.json({ ok: true, prospect }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof CommercialError ||
          error instanceof AdminIdentityError
            ? error.message
            : "Unable to create prospect.",
      },
      {
        status:
          error instanceof CommercialError ||
          error instanceof AdminIdentityError
            ? error.status
            : 503,
      },
    )
  }
}
