import { NextRequest, NextResponse } from "next/server"
import { auth } from "../../../../../auth"
import { recordOperatingBriefAction } from "@/lib/server/operating-brief"
import { guardApiCapability } from "@/lib/server/rbac"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  await guardApiCapability("projects.write")

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid brief action payload." }, { status: 400 })
  const input = body as Record<string, unknown>
  const key = text(input.key)
  const hash = text(input.evidenceHash)
  const status = input.status === "dismissed" || input.status === "completed" || input.status === "snoozed" ? input.status : null
  const snoozedUntil = status === "snoozed" ? date(input.snoozedUntil) ?? addDays(new Date(), 1) : null
  if (!key || !hash || !status) return NextResponse.json({ error: "Recommendation key, evidence hash and status are required." }, { status: 400 })

  const row = await recordOperatingBriefAction({
    key,
    evidenceHash: hash,
    status,
    reason: text(input.reason),
    snoozedUntil,
    actor: actor(session),
  })
  return NextResponse.json({ ok: true, action: row }, { status: 201 })
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}
function date(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
function addDays(dateValue: Date, days: number) {
  const copy = new Date(dateValue)
  copy.setUTCDate(copy.getUTCDate() + days)
  return copy
}
function actor(session: { user?: { email?: string | null; name?: string | null } } | null) {
  return session?.user?.email ?? session?.user?.name ?? "admin"
}
