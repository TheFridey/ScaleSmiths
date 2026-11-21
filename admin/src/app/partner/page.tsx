import { guardPageCapability } from '@/lib/server/rbac'
import { ExpansionWorkspace } from '@/components/expansion/ExpansionWorkspace'
import { partnerAcademyEnabled, partnerKnowledgeEnabled, partnerResourcesEnabled } from '@/lib/server/empower-partner'
export default async function PartnerPage() {
  await guardPageCapability('expansion.partner')
  return <ExpansionWorkspace academy={partnerAcademyEnabled()} resources={partnerResourcesEnabled()} knowledge={partnerKnowledgeEnabled()} />
}
