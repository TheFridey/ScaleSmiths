import { partnerWorkspaceEnabled } from '@/lib/server/empower-guidance'
import { guardPageCapability } from '@/lib/server/rbac'
import { ExpansionWorkspace } from '@/components/expansion/ExpansionWorkspace'
import { partnerAcademyEnabled, partnerKnowledgeEnabled, partnerResourcesEnabled } from '@/lib/server/empower-partner'
import { partnerPipelineEnabled } from '@/lib/server/partner-pipeline'
export default async function PartnerPage() {
  await guardPageCapability('expansion.partner')
  return <ExpansionWorkspace academy={partnerAcademyEnabled()} resources={partnerResourcesEnabled()} knowledge={partnerKnowledgeEnabled()} unified={partnerWorkspaceEnabled()} pipeline={partnerPipelineEnabled()} />
}
