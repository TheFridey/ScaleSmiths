import { NextRequest, NextResponse } from "next/server"
import { auth } from "../../../../../auth"
import { recordDeliveryCapacityAdjustment, recordDeliveryForecastActual } from "@/lib/server/delivery-capacity"
import { guardApiCapability } from "@/lib/server/rbac"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  await guardApiCapability("projects.write")

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid capacity payload." }, { status: 400 })
  const input = body as Record<string, unknown>

  if (input.action === "capacity_adjustment") {
    const weekStart = date(input.weekStart)
    const adjustmentType = adjustmentTypeOf(input.adjustmentType)
    const hours = integer(input.hours)
    const reason = text(input.reason)
    const confidence = confidenceOf(input.confidence)
    if (!weekStart || !adjustmentType || hours === null || !reason || reason.length < 6) {
      return NextResponse.json({ error: "Week, type, hours and reason are required." }, { status: 400 })
    }
    const row = await recordDeliveryCapacityAdjustment({
      weekStart,
      adjustmentType,
      staffName: text(input.staffName),
      role: text(input.role),
      hours,
      reason,
      confidence,
      actor: actor(session),
    })
    return NextResponse.json({ ok: true, adjustment: row }, { status: 201 })
  }

  if (input.action === "forecast_actual") {
    const periodStart = date(input.periodStart)
    const periodType = input.periodType === "month" ? "month" : "week"
    const forecastHours = integer(input.forecastHours)
    const actualHours = integer(input.actualHours)
    if (!periodStart || forecastHours === null || actualHours === null) {
      return NextResponse.json({ error: "Period, forecast hours and actual hours are required." }, { status: 400 })
    }
    const row = await recordDeliveryForecastActual({
      periodStart,
      periodType,
      forecastHours,
      actualHours,
      notes: text(input.notes),
      actor: actor(session),
    })
    return NextResponse.json({ ok: true, actual: row }, { status: 201 })
  }

  return NextResponse.json({ error: "Unsupported capacity action." }, { status: 400 })
}

function date(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function adjustmentTypeOf(value: unknown) {
  return value === "capacity_override" || value === "time_off" || value === "contractor_capacity" || value === "sales_commitment" || value === "actual_delivery" ? value : null
}

function confidenceOf(value: unknown) {
  return value === "low" || value === "high" || value === "medium" ? value : "medium"
}

function integer(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ""), 10)
  return Number.isInteger(parsed) ? parsed : null
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function actor(session: { user?: { email?: string | null; name?: string | null } } | null) {
  return session?.user?.email ?? session?.user?.name ?? "admin"
}
