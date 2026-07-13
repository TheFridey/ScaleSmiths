import { NextRequest, NextResponse } from "next/server"
import { auth } from "../../../../../../../auth"
import { answerForgeClarificationQuestion, buildPersistedForgeClarificationQueue } from "@/lib/server/forge-clarifications"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  const projectId = parseId((await params).id)
  if (!projectId) return NextResponse.json({ error: "Invalid Forge project id." }, { status: 400 })
  const result = await buildPersistedForgeClarificationQueue(projectId)
  return NextResponse.json(result)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  const projectId = parseId((await params).id)
  if (!projectId) return NextResponse.json({ error: "Invalid Forge project id." }, { status: 400 })
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const questionId = parseId(body?.questionId)
  const answer = typeof body?.answer === "string" ? body.answer : ""
  const approve = body?.approve !== false
  if (!questionId || answer.trim().length < 2) return NextResponse.json({ error: "A valid question id and answer are required." }, { status: 400 })
  const actor = session.user?.email ?? session.user?.name ?? "admin"
  try {
    const result = await answerForgeClarificationQuestion({
      projectId,
      questionId,
      answer,
      actor,
      approve,
      expiresAt: parseOptionalDate(body?.expiresAt),
      revalidateAfter: parseOptionalDate(body?.revalidateAfter),
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to record clarification answer." }, { status: 400 })
  }
}

function parseId(value: unknown) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function parseOptionalDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
