import { guardPageCapability } from '@/lib/server/rbac'
import { ExpansionWorkspace } from '@/components/expansion/ExpansionWorkspace'
import { partnerAcademyEnabled } from '@/lib/server/empower-academy'
export default async function PartnerPage() {
  await guardPageCapability('expansion.partner')
  return <ExpansionWorkspace academy={partnerAcademyEnabled()} />
}
