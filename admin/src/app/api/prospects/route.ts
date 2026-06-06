import { NextRequest, NextResponse } from "next/server"
import { desc } from "drizzle-orm"
import { db } from "@/lib/db"
import { prospects } from "@/lib/schema"
import { parseProspectPayload } from "@/lib/prospects"

export const dynamic = "force-dynamic"

export async function GET() {
  const rows = await db.select().from(prospects).orderBy(desc(prospects.updatedAt))

  return NextResponse.json({ prospects: rows })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid prospect payload." }, { status: 400 })
  }

  const parsed = parseProspectPayload(body as Record<string, unknown>, "create")

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  if (!parsed.data.businessName) {
    return NextResponse.json({ error: "Business name is required." }, { status: 400 })
  }

  const [prospect] = await db
    .insert(prospects)
    .values({
      ...parsed.data,
      businessName: parsed.data.businessName,
      updatedAt: new Date(),
    })
    .returning()

  return NextResponse.json({ ok: true, prospect }, { status: 201 })
}
