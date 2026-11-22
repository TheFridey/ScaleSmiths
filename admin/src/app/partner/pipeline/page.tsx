import { notFound } from "next/navigation"
import { guardPageCapability } from "@/lib/server/rbac"
import { partnerAcademyEnabled, partnerKnowledgeEnabled, partnerResourcesEnabled } from "@/lib/server/empower-partner"
import { partnerWorkspaceEnabled } from "@/lib/server/empower-guidance"
import { partnerObjectionsEnabled } from "@/lib/server/empower-objections"
import { partnerPipelineEnabled } from "@/lib/server/partner-pipeline"
import { PartnerPipeline } from "@/components/ascend/PartnerPipeline"
export const dynamic = "force-dynamic"
/** The partner's own sales pipeline (Operation Ascend B2.1). 404 unless PARTNER_PIPELINE_ENABLED=true. */
export default async function PipelinePage() {
  await guardPageCapability("expansion.partner")
  if (!partnerPipelineEnabled()) notFound()
  const guidance = partnerWorkspaceEnabled()
  return <PartnerPipeline guidance={guidance} nav={{ academy: partnerAcademyEnabled(), resources: partnerResourcesEnabled(), knowledge: partnerKnowledgeEnabled(), objections: partnerObjectionsEnabled(), guidance, pipeline: true }} />
}
