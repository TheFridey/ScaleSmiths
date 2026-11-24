import { AdminIdentityError } from "@/lib/admin-users"
import { handlePublicPartnerRequest } from "@/lib/server/public-partner-request"
import { requestPasswordReset, resetPartnerPassword } from "@/lib/server/partner-recovery"

export const dynamic = "force-dynamic"

/** Operation EMPOWER B2.10: partner self-service password recovery. `request` always answers identically; `reset` uses a one-time link. */
export async function POST(request: Request) {
  return handlePublicPartnerRequest(request, "partner-password-reset", (p) => (p.action === "request" && typeof p.email === "string" ? p.email : ""), async (p) => {
    if (p.action === "request") return requestPasswordReset(p.email)
    if (p.action === "reset") { await resetPartnerPassword(p.token, p.password); return { ok: true } }
    throw new AdminIdentityError("Unknown action.")
  })
}
