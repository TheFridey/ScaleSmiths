import { NextRequest, NextResponse } from "next/server"
import { auth } from "../../../../../../../auth"
import { guardApiCapability } from "@/lib/server/rbac"
import { applyProjectEstimateManualAdjustment, createProjectEstimateSnapshot, recordProjectEstimateActuals } from "@/lib/server/project-estimator"

export const dynamic = "force-dynamic"

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  await guardApiCapability("forge.read")

  const projectId = projectIdOf((await params).id)
  if (!projectId) return NextResponse.json({ error: "Invalid Forge project id." }, { status: 400 })

  const snapshot = await createProjectEstimateSnapshot(projectId)
  if (!snapshot) return NextResponse.json({ error: "Forge project not found." }, { status: 404 })
  return NextResponse.json({ ok: true, snapshot }, { status: 201 })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  await guardApiCapability("forge.configure")

  const projectId = projectIdOf((await params).id)
  if (!projectId) return NextResponse.json({ error: "Invalid Forge project id." }, { status: 400 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid estimator payload." }, { status: 400 })
  const input = body as Record<string, unknown>

  if (input.action === "adjust") {
    const hours = nonNegativeInt(input.hours)
    const buildPrice = nonNegativeInt(input.buildPrice)
    const retainer = nonNegativeInt(input.retainer)
    const reason = text(input.reason)
    if (hours === null || buildPrice === null || retainer === null) return NextResponse.json({ error: "Manual estimate values must be zero or more." }, { status: 400 })
    if (!reason || reason.length < 8) return NextResponse.json({ error: "Manual adjustment reason is required." }, { status: 400 })
    const snapshot = await applyProjectEstimateManualAdjustment({ projectId, hours, buildPrice, retainer, reason, actor: actor(session) })
    if (!snapshot) return NextResponse.json({ error: "Forge project not found." }, { status: 404 })
    return NextResponse.json({ ok: true, snapshot })
  }

  if (input.action === "actuals") {
    const actualHours = nonNegativeInt(input.actualHours)
    const actualBuildPrice = nonNegativeInt(input.actualBuildPrice)
    const actualRetainer = nonNegativeInt(input.actualRetainer)
    if (actualHours === null || actualBuildPrice === null || actualRetainer === null) return NextResponse.json({ error: "Actual values must be zero or more." }, { status: 400 })
    const snapshot = await recordProjectEstimateActuals({ projectId, actualHours, actualBuildPrice, actualRetainer, notes: text(input.notes) })
    if (!snapshot) return NextResponse.json({ error: "Forge project not found." }, { status: 404 })
    return NextResponse.json({ ok: true, snapshot })
  }

  return NextResponse.json({ error: "Unsupported estimator action." }, { status: 400 })
}

function projectIdOf(value: string) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function nonNegativeInt(value: unknown) {
  if (value === undefined || value === null || value === "") return 0
  const parsed = Number.parseInt(String(value), 10)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function actor(session: { user?: { email?: string | null; name?: string | null } } | null) {
  return session?.user?.email ?? session?.user?.name ?? "admin"
}
