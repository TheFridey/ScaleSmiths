import { NextRequest, NextResponse } from "next/server"
import { auth } from "../../../../../../auth"
import { applyLeadScoreOverride, createLeadScoreSnapshot, recordLeadScoreOutcome } from "@/lib/server/lead-scoring"
import { optionalString } from "@/lib/prospects"
import type { LeadScoreOutcome } from "@/lib/lead-scoring"

export const dynamic = "force-dynamic"

const OUTCOMES: LeadScoreOutcome[] = ["won", "lost", "no_decision", "disqualified"]

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })

  const prospectId = await parseProspectId(params)
  if (!prospectId) return NextResponse.json({ error: "Invalid prospect id." }, { status: 400 })

  const snapshot = await createLeadScoreSnapshot(prospectId)
  if (!snapshot) return NextResponse.json({ error: "Prospect not found." }, { status: 404 })

  return NextResponse.json({ ok: true, snapshot }, { status: 201 })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })

  const prospectId = await parseProspectId(params)
  if (!prospectId) return NextResponse.json({ error: "Invalid prospect id." }, { status: 400 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid lead-score payload." }, { status: 400 })

  const input = body as Record<string, unknown>
  const action = optionalString(input.action)

  if (action === "override") {
    const overrideScore = Number(input.overrideScore)
    const reason = optionalString(input.reason)
    if (!Number.isInteger(overrideScore) || overrideScore < 0 || overrideScore > 100) return NextResponse.json({ error: "Override score must be between 0 and 100." }, { status: 400 })
    if (!reason || reason.length < 8) return NextResponse.json({ error: "Override reason is required." }, { status: 400 })

    const snapshot = await applyLeadScoreOverride({ prospectId, overrideScore, reason, actor: sessionActor(session) })
    if (!snapshot) return NextResponse.json({ error: "Prospect not found." }, { status: 404 })
    return NextResponse.json({ ok: true, snapshot })
  }

  if (action === "outcome") {
    const outcome = optionalString(input.outcome)
    if (!isOutcome(outcome)) return NextResponse.json({ error: "Outcome is invalid." }, { status: 400 })
    const outcomeValue = nonNegativeInt(input.outcomeValue)
    const outcomeRetainer = nonNegativeInt(input.outcomeRetainer)
    if (outcomeValue === null || outcomeRetainer === null) return NextResponse.json({ error: "Outcome values must be zero or more." }, { status: 400 })

    const snapshot = await recordLeadScoreOutcome({ prospectId, outcome, outcomeValue, outcomeRetainer, notes: optionalString(input.notes) })
    if (!snapshot) return NextResponse.json({ error: "Prospect not found." }, { status: 404 })
    return NextResponse.json({ ok: true, snapshot })
  }

  return NextResponse.json({ error: "Unsupported lead-score action." }, { status: 400 })
}

async function parseProspectId(params: Promise<{ id: string }>) {
  const { id } = await params
  const prospectId = Number(id)
  return Number.isInteger(prospectId) && prospectId > 0 ? prospectId : null
}

function sessionActor(session: { user?: { email?: string | null; name?: string | null } } | null) {
  return session?.user?.email ?? session?.user?.name ?? "admin"
}

function isOutcome(value: string | null): value is LeadScoreOutcome {
  return Boolean(value && OUTCOMES.includes(value as LeadScoreOutcome))
}

function nonNegativeInt(value: unknown) {
  if (value === undefined || value === null || value === "") return 0
  const parsed = Number.parseInt(String(value), 10)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}
