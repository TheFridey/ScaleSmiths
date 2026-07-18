import { NextRequest, NextResponse } from "next/server"
import { parsePublicClaimId, parsePublicClaimReviewInput } from "@/lib/public-claims"
import { guardApiCapability } from "@/lib/server/rbac"
import { createPublicClaim, listPublicClaimAudit, listPublicClaims, PublicClaimError } from "@/lib/server/public-claims"

export const dynamic = "force-dynamic"

export async function GET() {
  await guardApiCapability("claims.read")
  const [claims, audit] = await Promise.all([listPublicClaims(), listPublicClaimAudit()])
  return NextResponse.json({ ok: true, claims, audit })
}

export async function POST(request: NextRequest) {
  const actor = await guardApiCapability("claims.manage")
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const id = parsePublicClaimId(body?.id)
  const parsed = parsePublicClaimReviewInput(body)
  if (!id) return NextResponse.json({ error: "A stable lowercase claim ID is required." }, { status: 400 })
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  try {
    const claim = await createPublicClaim({ id, ...parsed.data }, actor.id)
    return NextResponse.json({ ok: true, claim }, { status: 201 })
  } catch (error) {
    return claimErrorResponse(error)
  }
}

function claimErrorResponse(error: unknown) {
  if (error instanceof PublicClaimError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
  return NextResponse.json({ error: "Unable to save the claim review." }, { status: 500 })
}
