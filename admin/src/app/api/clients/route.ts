import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { clients } from "@/lib/schema"

export const dynamic = "force-dynamic"

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid client payload." }, { status: 400 })
  }

  const name = optionalString(body.name)

  if (!name) {
    return NextResponse.json({ error: "Client name is required." }, { status: 400 })
  }

  const mrr = Number.parseInt(String(body.mrr ?? "0"), 10)

  const [client] = await db
    .insert(clients)
    .values({
      name,
      contactName: optionalString(body.contactName),
      contactEmail: optionalString(body.contactEmail),
      tier: optionalString(body.tier),
      mrr: Number.isFinite(mrr) ? Math.max(0, mrr) : 0,
      status: optionalString(body.status) ?? "active",
    })
    .returning({ id: clients.id })

  return NextResponse.json({ ok: true, clientId: client.id }, { status: 201 })
}
