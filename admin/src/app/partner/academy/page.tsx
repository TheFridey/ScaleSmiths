import { notFound } from "next/navigation"
import { guardPageCapability } from "@/lib/server/rbac"
import { partnerAcademyEnabled } from "@/lib/server/empower-academy"
import { AcademyHome } from "@/components/empower/AcademyHome"
export const dynamic = "force-dynamic"
/** Partner Academy home (Operation Empower B1.2). 404 unless PARTNER_ACADEMY_ENABLED=true. */
export default async function AcademyPage() {
  await guardPageCapability("expansion.partner")
  if (!partnerAcademyEnabled()) notFound()
  return <AcademyHome />
}
