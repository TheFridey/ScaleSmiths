import { AdminIdentityError } from "@/lib/admin-users"
import { handlePublicPartnerRequest } from "@/lib/server/public-partner-request"
import { confirmApplicationWithdrawal, previewApplicationWithdrawal, requestApplicationWithdrawal } from "@/lib/server/partner-recovery"

export const dynamic = "force-dynamic"

/** Operation EMPOWER B2.10: applicant self-withdrawal, proven by a one-time link sent to the application's email address. */
export async function POST(request: Request) {
  return handlePublicPartnerRequest(request, "partner-application-withdrawal", (p) => (p.action === "request" && typeof p.email === "string" ? p.email : ""), async (p) => {
    if (p.action === "request") return requestApplicationWithdrawal(p.email)
    if (p.action === "preview") return previewApplicationWithdrawal(p.token)
    if (p.action === "confirm") { await confirmApplicationWithdrawal(p.token); return { ok: true } }
    throw new AdminIdentityError("Unknown action.")
  })
}
