import { NextResponse } from "next/server"
import { requireCurrentAdminUser } from "@/lib/server/admin-session"
import {
  createCursorAuthorizationCode,
  inspectCursorAuthorizationRequest,
  ventureOauthOrigin,
  VentureOauthError,
  type CursorAuthorizationInput,
} from "@/lib/server/venture-lab-oauth"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const actor = await requireCurrentAdminUser()
    const input = authorizationInput(new URL(request.url).searchParams, actor)
    const details = await inspectCursorAuthorizationRequest(input)
    return new NextResponse(consentHtml(details, input), {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "no-referrer",
      },
    })
  } catch (error) {
    return oauthError(error)
  }
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin")
    if (origin !== ventureOauthOrigin()) {
      throw new VentureOauthError(403, "access_denied", "OAuth approval must be submitted from the ScaleSmiths Admin origin.")
    }
    const actor = await requireCurrentAdminUser()
    const form = new URLSearchParams(await request.text())
    const input = authorizationInput(form, actor)
    const result = await createCursorAuthorizationCode(input)
    const target = new URL(input.redirectUri)
    target.searchParams.set("code", result.code)
    target.searchParams.set("state", result.state)
    return NextResponse.redirect(target, { status: 302 })
  } catch (error) {
    return oauthError(error)
  }
}

function authorizationInput(
  params: URLSearchParams,
  actor: { id: string },
): CursorAuthorizationInput {
  return {
    clientId: required(params, "client_id"),
    redirectUri: required(params, "redirect_uri"),
    responseType: required(params, "response_type"),
    codeChallenge: required(params, "code_challenge"),
    codeChallengeMethod: required(params, "code_challenge_method"),
    scope: params.get("scope"),
    resource: params.get("resource"),
    state: params.get("state"),
    actorId: actor.id,
  }
}

function consentHtml(
  details: { clientName: string; clientId: string; redirectUri: string; scope: string; resource: string },
  input: CursorAuthorizationInput,
) {
  const hidden = [
    ["client_id", input.clientId],
    ["redirect_uri", input.redirectUri],
    ["response_type", input.responseType],
    ["code_challenge", input.codeChallenge],
    ["code_challenge_method", input.codeChallengeMethod],
    ["scope", details.scope],
    ["resource", details.resource],
    ["state", input.state ?? ""],
  ].map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`).join("")

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Authorize Venture Director</title>
<style>
body{font-family:system-ui,sans-serif;background:#0b0d10;color:#f5f7fa;margin:0;min-height:100vh;display:grid;place-items:center;padding:24px}
main{max-width:620px;background:#141820;border:1px solid #29303d;border-radius:18px;padding:28px}
h1{margin-top:0}p,li{color:#c6ccd6;line-height:1.55}code{color:#fff}button{background:#fff;color:#0b0d10;border:0;border-radius:10px;padding:12px 18px;font-weight:700;cursor:pointer}
.notice{border:1px solid #314052;background:#10151c;border-radius:12px;padding:14px;margin:18px 0}
</style></head><body><main>
<h1>Authorize Nova Venture Director</h1>
<p><strong>${escapeHtml(details.clientName)}</strong> is asking to connect to Experiment #000 as the restricted <code>venture-director</code> service identity.</p>
<div class="notice"><strong>This does not grant financial authority.</strong></div>
<ul>
<li>Allowed: Venture dashboard reads, opportunity/evidence/proposal reads and proposals.</li>
<li>Not allowed: approvals, capital release, payments, secrets, deployment, policy/constitution changes, or arbitrary Admin APIs.</li>
<li>Emergency STOP and service revocation continue to apply immediately.</li>
</ul>
<p>OAuth scope: <code>${escapeHtml(details.scope)}</code><br>Resource: <code>${escapeHtml(details.resource)}</code></p>
<form method="post" action="/venture-lab/oauth/authorize">${hidden}<button type="submit">Authorize restricted Venture Director</button></form>
</main></body></html>`
}

function required(params: URLSearchParams, key: string) {
  const value = params.get(key)?.trim()
  if (!value) throw new VentureOauthError(400, "invalid_request", `${key} is required.`)
  return value
}

function oauthError(error: unknown) {
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

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!)
}
