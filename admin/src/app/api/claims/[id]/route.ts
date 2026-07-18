import { NextRequest, NextResponse } from "next/server"
import { parsePublicClaimId, parsePublicClaimReviewInput } from "@/lib/public-claims"
import { guardApiCapability } from "@/lib/server/rbac"
import { PublicClaimError, updatePublicClaim } from "@/lib/server/public-claims"

interface Context { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: Context) {
  const actor = await guardApiCapability("claims.manage")
  const id = parsePublicClaimId(decodeURIComponent((await context.params).id))
  const parsed = parsePublicClaimReviewInput(await request.json().catch(() => null))
  if (!id) return NextResponse.json({ error: "Invalid claim ID." }, { status: 400 })
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  try {
    const claim = await updatePublicClaim(id, parsed.data, actor.id)
    return NextResponse.json({ ok: true, claim })
  } catch (error) {
    if (error instanceof PublicClaimError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    return NextResponse.json({ error: "Unable to update the claim review." }, { status: 500 })
  }
}
