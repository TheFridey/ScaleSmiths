import { partnerWorkspaceEnabled } from '@/lib/server/empower-guidance'
import { guardPageCapability } from '@/lib/server/rbac'
import { ExpansionWorkspace } from '@/components/expansion/ExpansionWorkspace'
import { partnerAcademyEnabled, partnerKnowledgeEnabled, partnerResourcesEnabled } from '@/lib/server/empower-partner'
import { partnerObjectionsEnabled } from '@/lib/server/empower-objections'
import { partnerPipelineEnabled } from '@/lib/server/partner-pipeline'
import { partnerPerformanceEnabled } from '@/lib/server/partner-performance'
export default async function PartnerPage() {
  await guardPageCapability('expansion.partner')
  return <ExpansionWorkspace academy={partnerAcademyEnabled()} resources={partnerResourcesEnabled()} knowledge={partnerKnowledgeEnabled()} objections={partnerObjectionsEnabled()} unified={partnerWorkspaceEnabled()} pipeline={partnerPipelineEnabled()} performance={partnerPerformanceEnabled()} />
}
