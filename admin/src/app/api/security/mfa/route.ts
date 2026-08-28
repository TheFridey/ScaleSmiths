import { NextResponse } from "next/server"
import { AdminIdentityError } from "@/lib/admin-users"
import { isMfaRequired, readStoredMfaState } from "@/lib/server/mfa"
import { activateAdminMfa, beginAdminMfaSetup } from "@/lib/server/admin-users"
import { requireCapability } from "@/lib/server/rbac"
import { checkDurableRateLimit } from "@/lib/server/rate-limit-store"

export const dynamic = "force-dynamic"

/** TOTP activation attempts permitted per account per window. */
const MFA_ACTIVATION_LIMIT = 10
const MFA_ACTIVATION_WINDOW_MS = 10 * 60 * 1000

export async function GET() {
  try {
    const user = await requireCapability("settings.manage")
    const state = readStoredMfaState(user.mfaState)
    return NextResponse.json({ enabled: user.mfaEnabled, pending: state?.status === "pending", required: isMfaRequired(user.role), graceUntil: process.env.ADMIN_MFA_BOOTSTRAP_GRACE_UNTIL ?? null, remainingRecoveryCodes: state?.status === "active" ? state.recoveryCodeHashes.length : null })
  } catch (error) { return responseError(error) }
}

export async function POST(request: Request) {
  try {
    const user = await requireCapability("settings.manage")
    const body = await request.json().catch(() => null) as { action?: unknown; code?: unknown } | null
    if (body?.action === "begin") return NextResponse.json(await beginAdminMfaSetup(user.id))
    if (body?.action === "verify" && typeof body.code === "string") {
      // A 6-digit TOTP is only 10^6 wide and this route sits outside the
      // middleware's Forge limiter, so without a limit a session holder could
      // brute-force activation. Keyed on the account, which is the identity the
      // code belongs to.
      const decision = await checkDurableRateLimit(`admin-mfa-activate:${user.id}`, MFA_ACTIVATION_LIMIT, MFA_ACTIVATION_WINDOW_MS)
      if (!decision.ok) {
        return NextResponse.json(
          { error: "Too many verification attempts. Please wait before trying again." },
          { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil(decision.retryAfterMs / 1000))) } },
        )
      }
      await activateAdminMfa(user.id, body.code)
      return NextResponse.json({ ok: true, sessionRevoked: true })
    }
    throw new AdminIdentityError("Invalid MFA action.")
  } catch (error) { return responseError(error) }
}

function responseError(error: unknown) {
  if (error instanceof AdminIdentityError) return NextResponse.json({ error: error.safeMessage }, { status: error.status })
  return NextResponse.json({ error: "Unable to update MFA." }, { status: 500 })
}
