import { ClaimsReviewPanel } from "@/components/ClaimsReviewPanel"
import { hasCapability } from "@/lib/rbac"
import { guardPageCapability } from "@/lib/server/rbac"
import { listPublicClaimAudit, listPublicClaims } from "@/lib/server/public-claims"

export const dynamic = "force-dynamic"

export default async function ClaimsPage() {
  const actor = await guardPageCapability("claims.read")
  const [claims, audit] = await Promise.all([listPublicClaims(), listPublicClaimAudit()])

  return <ClaimsReviewPanel initialClaims={claims} initialAudit={audit} canManage={hasCapability(actor.role, "claims.manage")} />
}
