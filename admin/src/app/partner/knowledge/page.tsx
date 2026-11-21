import { partnerObjectionsEnabled } from "@/lib/server/empower-objections"
import { partnerWorkspaceEnabled } from "@/lib/server/empower-guidance"
import { notFound } from "next/navigation"
import { guardPageCapability } from "@/lib/server/rbac"
import { partnerAcademyEnabled, partnerKnowledgeEnabled, partnerResourcesEnabled } from "@/lib/server/empower-partner"
import { KnowledgeBase } from "@/components/empower/KnowledgeBase"
export const dynamic = "force-dynamic"
/** Partner Knowledge Base (Operation Empower B1.4). 404 unless PARTNER_KNOWLEDGE_BASE_ENABLED=true. */
export default async function KnowledgePage() {
  await guardPageCapability("expansion.partner")
  if (!partnerKnowledgeEnabled()) notFound()
  return <KnowledgeBase nav={{ academy: partnerAcademyEnabled(), resources: partnerResourcesEnabled(), knowledge: true, objections: partnerObjectionsEnabled(), guidance: partnerWorkspaceEnabled() }} />
}
