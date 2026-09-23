import { NextResponse } from "next/server"
import { requireCurrentAdminUser } from "@/lib/server/admin-session"
import { createCursorAuthorizationCode, VentureOauthError } from "@/lib/server/venture-lab-oauth"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const actor = await requireCurrentAdminUser()
    const url = new URL(request.url)
    const redirectUri = required(url.searchParams, "redirect_uri")
    const result = await createCursorAuthorizationCode({
      clientId: required(url.searchParams, "client_id"),
      redirectUri,
      responseType: required(url.searchParams, "response_type"),
      codeChallenge: required(url.searchParams, "code_challenge"),
      codeChallengeMethod: required(url.searchParams, "code_challenge_method"),
      scope: url.searchParams.get("scope"),
      resource: url.searchParams.get("resource"),
      state: url.searchParams.get("state"),
      actor: {
        id: actor.id,
        role: actor.role,
        active: actor.active,
        mfaEnabled: actor.mfaEnabled,
      },
    })
    const target = new URL(redirectUri)
    target.searchParams.set("code", result.code)
    target.searchParams.set("state", result.state)
    return NextResponse.redirect(target, { status: 302 })
  } catch (error) {
    if (error instanceof VentureOauthError) {
      return NextResponse.json(
        { error: error.code, error_description: error.safeMessage },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      )
    }
    return NextResponse.json(
      { error: "server_error", error_description: "Unable to authorize Cursor connector." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    )
  }
}

function required(params: URLSearchParams, key: string) {
  const value = params.get(key)?.trim()
  if (!value) throw new VentureOauthError(400, "invalid_request", `${key} is required.`)
  return value
}
